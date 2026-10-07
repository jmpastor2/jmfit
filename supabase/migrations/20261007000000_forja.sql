-- ═══════════════════════════════════════════════════════════════════════════
--  Forja 1.0 — guided training, records, goals, check-ins.
--  Additive: the v3 tables (profiles, scans, workout_logs, food_*) stay; the old
--  workout_logs rows are copied into the new model at the end.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Profile: what the training engine needs ───
alter table profiles
  add column if not exists experience text not null default 'intermediate'
    check (experience in ('novice','intermediate','advanced')),
  add column if not exists training_goal text not null default 'hypertrophy'
    check (training_goal in ('hypertrophy','strength','recomp','cut','maintenance','glutes')),
  add column if not exists weekly_target int not null default 4 check (weekly_target between 1 and 7),
  add column if not exists bar_kg numeric(4,1) not null default 20,
  add column if not exists plates_kg numeric(5,2)[] not null default '{25,20,15,10,5,2.5,1.25}',
  add column if not exists rest_sound boolean not null default true,
  add column if not exists active_program_id uuid;

-- ─── Scans: the old form stored 0 for "not measured" ───
update scans set grasa = null where grasa = 0;
update scans set grasa_kg = null where grasa_kg = 0;
update scans set musculo = null where musculo = 0;
update scans set agua = null where agua = 0;
update scans set agua_pct = null where agua_pct = 0;
update scans set hueso = null where hueso = 0;
update scans set visceral = null where visceral = 0;
update scans set tmb = null where tmb = 0;
update scans set edad_met = null where edad_met = 0;
update scans set imc = null where imc = 0;

-- ─── Custom exercises (the catalog lives in the app; these are the user's own) ───
create table if not exists custom_exercises (
  id          text primary key,              -- 'custom-<uuid>'
  user_id     uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name        text not null,
  primary_muscles   text[] not null default '{}',
  secondary_muscles text[] not null default '{}',
  equipment   text not null default 'machine',
  pattern     text not null default 'isolation_upper',
  compound    boolean not null default false,
  increment   numeric(4,2) not null default 2.5,
  bodyweight  boolean not null default false,
  rest_sec    int not null default 90,
  notes       text,
  created_at  timestamptz not null default now()
);

-- ─── Programs: days and slots as one validated JSON document ───
create table if not exists programs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name        text not null,
  template_id text,
  meso_weeks  int not null default 6 check (meso_weeks between 2 and 16),
  started_on  date not null default current_date,
  days        jsonb not null default '[]',
  archived    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists programs_user on programs(user_id, archived);

alter table profiles drop constraint if exists profiles_active_program_fk;
alter table profiles add constraint profiles_active_program_fk
  foreign key (active_program_id) references programs(id) on delete set null;

-- ─── Workouts and sets ───
create table if not exists workouts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name         text not null,
  program_id   uuid references programs(id) on delete set null,
  day_id       text,
  started_at   timestamptz not null default now(),
  ended_at     timestamptz,
  notes        text,
  session_rpe  numeric(3,1) check (session_rpe between 1 and 10),
  bodyweight   numeric(5,2),
  deload       boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists workouts_user_started on workouts(user_id, started_at desc);
-- At most one session in progress per person.
create unique index if not exists workouts_one_active on workouts(user_id) where ended_at is null;

create table if not exists workout_sets (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade default auth.uid(),
  workout_id      uuid not null references workouts(id) on delete cascade,
  exercise_id     text not null,
  exercise_index  int not null,
  set_index       int not null,
  kind            text not null default 'work' check (kind in ('warmup','work','drop','failure')),
  weight          numeric(6,2),
  reps            int check (reps >= 0),
  rir             numeric(3,1) check (rir between 0 and 10),
  done_at         timestamptz not null default now(),
  note            text
);
create index if not exists workout_sets_user_ex on workout_sets(user_id, exercise_id, done_at desc);
create index if not exists workout_sets_workout on workout_sets(workout_id);

-- ─── Goals ───
create table if not exists goals (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade default auth.uid(),
  kind         text not null check (kind in ('e1rm','lift','bodyweight','bodyfat','muscle','frequency')),
  exercise_id  text,
  reps         int,
  target       numeric(7,2) not null,
  start        numeric(7,2),
  start_date   date not null default current_date,
  deadline     date,
  achieved_at  timestamptz,
  archived     boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists goals_user on goals(user_id, archived);

-- ─── Daily check-in (readiness when the wearable has nothing) ───
create table if not exists checkins (
  user_id        uuid not null references auth.users(id) on delete cascade default auth.uid(),
  date           date not null,
  sleep_h        numeric(3,1),
  sleep_quality  int check (sleep_quality between 1 and 5),
  energy         int check (energy between 1 and 5),
  soreness       int check (soreness between 1 and 5),
  stress         int check (stress between 1 and 5),
  created_at     timestamptz not null default now(),
  primary key (user_id, date)
);

-- ─── Machines of the user's gym: a QR on the machine opens its exercise ───
create table if not exists gym_machines (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade default auth.uid(),
  label        text not null,              -- "Prensa 45° Hammer · fila 2"
  brand        text,
  exercise_id  text not null,
  seat_setting text,                       -- "Asiento 4 · respaldo 2"
  notes        text,
  created_at   timestamptz not null default now()
);

-- ─── Row level security: every table is private to its owner ───
do $$
declare t text;
begin
  foreach t in array array['custom_exercises','programs','workouts','workout_sets','goals','checkins','gym_machines']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || '_own', t);
    execute format(
      'create policy %I on %I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      t || '_own', t);
  end loop;
end $$;

-- A set can only point at one of the owner's own workouts.
create or replace function workout_sets_same_owner() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from workouts w where w.id = new.workout_id and w.user_id = new.user_id) then
    raise exception 'workout % does not belong to this user', new.workout_id;
  end if;
  return new;
end $$;
drop trigger if exists workout_sets_owner on workout_sets;
create trigger workout_sets_owner before insert or update on workout_sets
  for each row execute function workout_sets_same_owner();

-- Food items: let people fix or remove what they added themselves.
drop policy if exists food_items_update on food_items;
create policy food_items_update on food_items for update
  using (added_by = auth.uid()) with check (added_by = auth.uid());
drop policy if exists food_items_delete on food_items;
create policy food_items_delete on food_items for delete using (added_by = auth.uid());

-- ─── Copy the old free-text logs into the new model (one workout per user and day) ───
do $$
declare r record; wid uuid; ex_map jsonb := '{
  "remo bajo": "seated-cable-row",
  "remo a una mano": "one-arm-dumbbell-row",
  "remo en t": "t-bar-row",
  "dominadas máquina": "machine-pulldown",
  "serrator": "cable-serratus"
}';
begin
  if exists (select 1 from workout_sets) then return; end if;
  for r in
    select user_id, (created_at at time zone 'Europe/Madrid')::date as d, min(created_at) as t0
    from workout_logs group by 1, 2
  loop
    insert into workouts (user_id, name, started_at, ended_at)
      values (r.user_id, 'Sesión importada', r.t0, r.t0 + interval '1 hour')
      returning id into wid;
    insert into workout_sets (user_id, workout_id, exercise_id, exercise_index, set_index, kind, weight, reps, rir, done_at)
    select l.user_id, wid,
           coalesce(ex_map ->> lower(trim(l.exercise)), 'legacy-' || regexp_replace(lower(trim(l.exercise)), '[^a-z0-9]+', '-', 'g')),
           (dense_rank() over (order by l.created_at, l.id))::int - 1,
           g.n - 1, 'work', l.weight_kg, l.reps,
           case when l.rpe is not null then greatest(0, 10 - l.rpe) end,
           l.created_at
    from workout_logs l
    cross join lateral generate_series(1, greatest(coalesce(l.sets, 1), 1)) as g(n)
    where l.user_id = r.user_id and (l.created_at at time zone 'Europe/Madrid')::date = r.d;
  end loop;
end $$;

-- Carry the v3 onboarding answers into the new profile fields.
update profiles set weekly_target = least(greatest(training_days, 1), 7) where training_days is not null;
update profiles set training_goal = case goal
  when 'muscle_gain' then 'hypertrophy'
  when 'glute_focus' then 'glutes'
  when 'strength' then 'strength'
  when 'recomp' then 'recomp'
  when 'cut' then 'cut'
  else 'hypertrophy' end;
