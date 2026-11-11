-- Heart rate zones from Google Health (time-in-heart-rate-zone), per band session and per day:
-- minutes in each Fitbit zone, {"light": 4, "moderate": 2, "vigorous": 2, "peak": 52}.
alter table public.health_workouts add column if not exists zones jsonb;
alter table public.health_daily add column if not exists zones jsonb;

-- Journal: what the day had (alcohol, a late dinner…), to see what moves the next recovery.
create table if not exists public.journal (
  user_id    uuid not null references auth.users (id) on delete cascade default auth.uid(),
  date       date not null,
  tags       text[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);
alter table public.journal enable row level security;
drop policy if exists journal_own on public.journal;
create policy journal_own on public.journal
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- Same lock as every table of the app: unapproved accounts read and write nothing.
drop policy if exists approved_only on public.journal;
create policy approved_only on public.journal as restrictive
  for all to authenticated
  using ((select public.is_approved()))
  with check ((select public.is_approved()));
