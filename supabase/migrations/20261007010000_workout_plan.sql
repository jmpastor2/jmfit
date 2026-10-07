-- The plan of a session (exercises, sets, rep ranges, rest) as it was when started, plus any
-- change made during it (a swapped machine, an extra exercise). Programs can change later
-- without rewriting the history of what was prescribed.
alter table workouts add column if not exists plan jsonb not null default '[]';
