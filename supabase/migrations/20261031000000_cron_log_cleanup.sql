-- Keep pg_cron's run log small.
--
-- pg_cron writes a row to cron.job_run_details on every run and never deletes it. With forja-rest-alarms
-- running every 5 seconds that is ~17,000 rows a day: by 31-oct-2026 the log was 1.5 GB of a 1.55 GB
-- database and Supabase warned that the organisation was over the free plan's size. The log was emptied
-- by hand that day; this job keeps it from growing again.
--
-- Every 15 minutes: successful runs older than an hour go; failed runs are kept 7 days to investigate.
-- Postgres reuses the freed space, so the table stays at a few MB.

do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'limpiar-historial-cron';
  perform cron.schedule(
    'limpiar-historial-cron',
    '*/15 * * * *',
    $cron$
    delete from cron.job_run_details
    where (status = 'succeeded' and end_time < now() - interval '1 hour')
       or end_time < now() - interval '7 days'
    $cron$
  );
end
$$;
