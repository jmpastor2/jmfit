-- Morning notification after the 08:00 Google Health sync (Monday: the week). On by default,
-- switchable in Ajustes. `morning_push_on` keeps it to one a day across the 06:00 and 07:00 UTC runs.
alter table public.profiles add column if not exists morning_push boolean not null default true;
alter table public.health_connections add column if not exists morning_push_on date;
