-- ═══════════════════════════════════════════════════════════════════════════
--  Access by approval. Whoever signs up stays «pending» until an admin approves them,
--  and until then the database lets them read and write nothing: every table in public
--  gets a RESTRICTIVE policy `approved_only`, ANDed with the policies it already had.
--  The «pending» screen in the app is only the friendly face of this.
--
--  Accounts that existed before are approved the first time this runs. Admins are
--  marked by hand (kept out of here so no email is published):
--    update public.access set is_admin = true where user_id = '<uuid>';
--  Each new request posts a notice to ntfy when the Vault secret `access_ntfy_topic`
--  exists (without it nothing is sent and the rest works the same):
--    select vault.create_secret('<topic>', 'access_ntfy_topic');
--  A new table in public needs its own `approved_only`: run this file again.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────── 1 · Access table ───────────────────────────
create table if not exists public.access (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  status       text not null default 'pending'
               check (status in ('pending', 'approved', 'rejected')),
  is_admin     boolean not null default false,
  requested_at timestamptz not null default now(),
  decided_at   timestamptz
);
comment on table public.access is
  'Who may use the app: every sign-up starts pending until an admin approves it.';

alter table public.access enable row level security;

-- Each person can read their own row (the app shows «pending» from it). Nobody writes
-- it directly: the sign-up trigger creates it and decide_access() changes it.
drop policy if exists access_read_own on public.access;
create policy access_read_own on public.access for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.access from anon, authenticated;
grant select on public.access to authenticated;

insert into public.access (user_id, status, requested_at, decided_at)
select u.id, 'approved', u.created_at, now()
from auth.users u
where not exists (select 1 from public.access);

-- ─────────────────────────────── 2 · Checks ─────────────────────────────────
create or replace function public.is_approved()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.access a
    where a.user_id = auth.uid() and a.status = 'approved'
  )
$$;

create or replace function public.is_access_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.access a
    where a.user_id = auth.uid() and a.status = 'approved' and a.is_admin
  )
$$;

revoke execute on function public.is_approved() from public, anon;
revoke execute on function public.is_access_admin() from public, anon;
grant execute on function public.is_approved() to authenticated;
grant execute on function public.is_access_admin() to authenticated;

-- ─────────────────────────────── 3 · A lock on every table ──────────────────
do $$
declare
  t record;
begin
  for t in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p') and c.relname <> 'access'
  loop
    execute format('drop policy if exists approved_only on public.%I', t.relname);
    execute format(
      'create policy approved_only on public.%I as restrictive for all to authenticated '
      'using ((select public.is_approved())) with check ((select public.is_approved()))',
      t.relname
    );
  end loop;
end $$;

-- ─────────────────────────────── 4 · Request on sign-up ─────────────────────
create or replace function public.handle_access_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_topic text;
begin
  insert into public.access (user_id) values (new.id) on conflict (user_id) do nothing;

  -- The notice is best effort: it never stops anyone from signing up.
  begin
    select s.decrypted_secret into v_topic
    from vault.decrypted_secrets s
    where s.name = 'access_ntfy_topic'
    limit 1;
    if v_topic is not null then
      perform net.http_post(
        url := 'https://ntfy.sh',
        body := jsonb_build_object(
          'topic', v_topic,
          'title', 'Forja · solicitud de acceso',
          'message', 'Alguien ha pedido acceso. Ábrelo para aprobarlo o rechazarlo.',
          'click', 'https://jmpastor2.github.io/jmfit/#/access',
          'tags', jsonb_build_array('key')
        )
      );
    end if;
  exception when others then
    null;
  end;

  return new;
end $$;

revoke execute on function public.handle_access_request() from public, anon, authenticated;

drop trigger if exists on_auth_user_access on auth.users;
create trigger on_auth_user_access
  after insert on auth.users
  for each row execute function public.handle_access_request();

-- ─────────────────────────────── 5 · Admin panel ────────────────────────────
create or replace function public.access_requests()
returns table (
  user_id      uuid,
  email        text,
  display_name text,
  status       text,
  is_admin     boolean,
  requested_at timestamptz,
  decided_at   timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_access_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select a.user_id,
           u.email::text,
           coalesce(
             nullif(p.display_name, ''),
             nullif(u.raw_user_meta_data ->> 'display_name', ''),
             split_part(u.email::text, '@', 1)
           ),
           a.status,
           a.is_admin,
           a.requested_at,
           a.decided_at
    from public.access a
    join auth.users u on u.id = a.user_id
    left join public.profiles p on p.id = a.user_id
    order by (a.status = 'pending') desc, a.requested_at desc;
end $$;

create or replace function public.decide_access(p_user uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_access_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_status not in ('pending', 'approved', 'rejected') then
    raise exception 'invalid_status' using errcode = '22023';
  end if;
  if p_user = auth.uid() then
    raise exception 'self' using errcode = '22023';
  end if;
  update public.access
     set status = p_status,
         decided_at = case when p_status = 'pending' then null else now() end
   where user_id = p_user;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
end $$;

revoke execute on function public.access_requests() from public, anon;
revoke execute on function public.decide_access(uuid, text) from public, anon;
grant execute on function public.access_requests() to authenticated;
grant execute on function public.decide_access(uuid, text) to authenticated;
