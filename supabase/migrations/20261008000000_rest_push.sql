-- ═══════════════════════════════════════════════════════════════════════════
--  Rest alarms by Web Push. With the phone locked or the app in the background iOS stops
--  the page, so the in-app beep never sounds. The app stores when the current rest ends;
--  every 5 seconds pg_cron checks for a due alarm and, only then, calls the Edge Function
--  `rest-alarms`, which sends the push and clears the alarm.
--
--  One-time setup (Supabase Vault), run by hand with the real values:
--    select vault.create_secret('https://jzhltzafdqipeortwdra.supabase.co/functions/v1/rest-alarms', 'forja_rest_alarms_url');
--    select vault.create_secret('<CRON_SECRET>', 'forja_cron_secret');
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists push_subscriptions (
  endpoint    text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade default auth.uid(),
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now()
);
create index if not exists push_subscriptions_user on push_subscriptions(user_id);

-- One pending alarm per person: a new rest replaces the previous one.
create table if not exists rest_alarms (
  user_id     uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  fire_at     timestamptz not null,
  label       text not null default '',
  created_at  timestamptz not null default now()
);
create index if not exists rest_alarms_fire_at on rest_alarms(fire_at);

alter table push_subscriptions enable row level security;
alter table rest_alarms enable row level security;
drop policy if exists push_subscriptions_own on push_subscriptions;
create policy push_subscriptions_own on push_subscriptions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists rest_alarms_own on rest_alarms;
create policy rest_alarms_own on rest_alarms for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Cheap check every 5 seconds; the HTTP call only happens when an alarm is due.
do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'forja-rest-alarms';
  perform cron.schedule(
    'forja-rest-alarms',
    '5 seconds',
    $cron$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'forja_rest_alarms_url'),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'forja_cron_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 15000
    )
    where exists (select 1 from rest_alarms where fire_at <= now() + interval '1 second')
      and exists (select 1 from vault.decrypted_secrets where name = 'forja_rest_alarms_url')
      and exists (select 1 from vault.decrypted_secrets where name = 'forja_cron_secret');
    $cron$
  );
end $$;
