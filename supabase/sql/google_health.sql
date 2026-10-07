-- Forja · Google Health API integration (Fitbit Air via Google Health API v4).
-- Used by the Edge Function supabase/functions/google-health. Idempotent: safe to re-run.
-- Writes happen only through the Edge Function with the service role; the app only reads.

-- ───────────── Connection state (one per user) ─────────────
create table if not exists health_connections (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  provider       text not null default 'google_health' check (provider in ('google_health')),
  status         text not null default 'connected'
                 check (status in ('connected', 'reauth_required', 'error')),
  scopes         text[] not null default '{}',
  connected_at   timestamptz not null default now(),
  last_sync_at   timestamptz,
  last_error     text,
  google_user_id text -- healthUserId from GET /v4/users/me/identity
);

alter table health_connections enable row level security;
drop policy if exists health_connections_read_own on health_connections;
create policy health_connections_read_own on health_connections
  for select using (auth.uid() = user_id);

-- ───────────── OAuth tokens (service role only) ─────────────
-- RLS on and NO policies: anon/authenticated can never read or write these rows.
create table if not exists health_tokens (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  refresh_token text not null,
  access_token  text,
  expires_at    timestamptz,
  updated_at    timestamptz not null default now()
);

alter table health_tokens enable row level security;
revoke all on table health_tokens from anon, authenticated;

-- ───────────── Daily metrics (matches HealthDay in src/domain/types.ts) ─────────────
create table if not exists health_daily (
  user_id     uuid not null references auth.users (id) on delete cascade,
  date        date not null,
  source      text not null check (source in ('google_health', 'manual')),
  sleep_min   integer,
  deep_min    integer,
  rem_min     integer,
  light_min   integer,
  awake_min   integer,
  resting_hr  integer,
  hrv_ms      numeric(6, 1),
  steps       integer,
  active_kcal integer,
  vo2max      numeric(4, 1),
  weight      numeric(5, 2),  -- kg
  body_fat    numeric(4, 1),  -- %
  raw         jsonb,
  updated_at  timestamptz not null default now(),
  primary key (user_id, date, source)
);

create index if not exists health_daily_user_date_idx on health_daily (user_id, date desc);

alter table health_daily enable row level security;
drop policy if exists health_daily_read_own on health_daily;
create policy health_daily_read_own on health_daily
  for select using (auth.uid() = user_id);
-- If the app later lets the user type manual rows (source = 'manual'), add:
--   create policy health_daily_write_manual on health_daily for all
--     using (auth.uid() = user_id and source = 'manual')
--     with check (auth.uid() = user_id and source = 'manual');

-- ───────────── Exercise sessions ─────────────
create table if not exists health_workouts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  source       text not null default 'google_health' check (source in ('google_health')),
  external_id  text not null, -- Google Health data point resource name
  activity     text not null, -- Exercise.exerciseType enum, e.g. WEIGHTLIFTING, RUNNING
  display_name text,
  started_at   timestamptz not null,
  duration_s   integer,       -- activeDuration (excludes pauses)
  avg_hr       integer,
  max_hr       integer,       -- not exposed by the API's exercise summary; stays null
  kcal         integer,
  distance_m   numeric(9, 1),
  updated_at   timestamptz not null default now(),
  unique (user_id, external_id)
);

create index if not exists health_workouts_user_started_idx
  on health_workouts (user_id, started_at desc);

alter table health_workouts enable row level security;
drop policy if exists health_workouts_read_own on health_workouts;
create policy health_workouts_read_own on health_workouts
  for select using (auth.uid() = user_id);

-- ───────────── Scheduled sync every 6 h (suggestion, NOT executed) ─────────────
-- Requires the pg_cron and pg_net extensions (Dashboard → Database → Extensions) and the
-- same CRON_SECRET stored in Vault:
--   select vault.create_secret('<CRON_SECRET>', 'google_health_cron_secret');
--
-- select cron.schedule(
--   'google-health-sync',
--   '15 */6 * * *',
--   $$
--   select net.http_post(
--     url     := 'https://jzhltzafdqipeortwdra.supabase.co/functions/v1/google-health?action=sync',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets
--                         where name = 'google_health_cron_secret')
--     ),
--     body    := '{}'::jsonb,
--     timeout_milliseconds := 60000
--   );
--   $$
-- );
--
-- To remove it: select cron.unschedule('google-health-sync');
