-- Google Health: sync every morning at 08:00 Madrid time.
--
-- pg_cron runs in UTC, so 08:00 in Madrid is 07:00 UTC in winter and 06:00 UTC in summer. The
-- job runs at both hours: one of them is always 08:00 local, and a second sync an hour apart
-- costs nothing (it only re-reads the last 7 days). The function checks `x-cron-secret`, the
-- same CRON_SECRET the rest alarms use, already in Vault as `forja_cron_secret`.

select cron.unschedule('google-health-sync')
where exists (select 1 from cron.job where jobname = 'google-health-sync');

select cron.schedule(
  'google-health-sync',
  '0 6,7 * * *',
  $$
  select net.http_post(
    url     := 'https://jzhltzafdqipeortwdra.supabase.co/functions/v1/google-health?action=sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'forja_cron_secret')
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);
