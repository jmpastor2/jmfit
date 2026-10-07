-- Morning numbers typed from the wearable's own app while Google Health API access is closed to
-- new projects: resting heart rate, overnight HRV and yesterday's steps.
alter table checkins
  add column if not exists resting_hr int check (resting_hr between 25 and 150),
  add column if not exists hrv_ms int check (hrv_ms between 5 and 300),
  add column if not exists steps int check (steps between 0 and 100000);
