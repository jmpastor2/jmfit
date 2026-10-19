-- Orbe (the home assistant on jmpserver) reads a training summary for its owner.
--
-- Only aggregates leave the database: counts, totals, averages and best lifts. Never single
-- sets, notes or raw health samples. The caller must present Orbe's key; the database keeps
-- only its SHA-256 in Vault, next to the owner's user id:
--
--   select vault.create_secret('<sha256 hex of the key>', 'orbe_key_sha256');
--   select vault.create_secret('<owner user id>', 'orbe_user_id');
--
-- Called over PostgREST with the public anon key: POST /rest/v1/rpc/orbe_summary
-- {"p_key": "...", "p_days": 7}. Without the right key it raises 42501.

create or replace function public.orbe_summary(p_key text, p_days int default 7)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hash text;
  v_user uuid;
  v_days int := greatest(1, least(coalesce(p_days, 7), 92));
  v_today date := (now() at time zone 'Europe/Madrid')::date;
  v_from_d date;
  v_from timestamptz;
  v_prev timestamptz;
  v_week timestamptz;
  v_out jsonb;
begin
  select s.decrypted_secret into v_hash from vault.decrypted_secrets s where s.name = 'orbe_key_sha256' limit 1;
  if v_hash is null or p_key is null
     or encode(extensions.digest(p_key, 'sha256'), 'hex') <> v_hash then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  select s.decrypted_secret::uuid into v_user from vault.decrypted_secrets s where s.name = 'orbe_user_id' limit 1;

  v_from_d := v_today - (v_days - 1);
  v_from := v_from_d::timestamp at time zone 'Europe/Madrid';
  v_prev := (v_from_d - v_days)::timestamp at time zone 'Europe/Madrid';
  v_week := date_trunc('week', v_today::timestamp) at time zone 'Europe/Madrid';

  with sessions as (
    select w.id, w.name, w.started_at, w.ended_at, w.session_rpe, w.deload,
           count(s.id) filter (where s.kind = 'work') as sets,
           coalesce(sum(s.weight * s.reps) filter (where s.kind = 'work'), 0) as volume
    from public.workouts w
    left join public.workout_sets s on s.workout_id = w.id and s.user_id = v_user
    where w.user_id = v_user and w.started_at >= v_prev
    group by w.id
  ),
  cur as (select * from sessions where started_at >= v_from),
  prv as (select * from sessions where started_at < v_from),
  last_w as (
    select w.id, w.name, w.started_at, w.ended_at
    from public.workouts w where w.user_id = v_user
    order by w.started_at desc limit 1
  ),
  last_ex as (
    select s.exercise_id, count(*) as sets, max(s.weight) as top_kg,
           (array_agg(s.reps order by s.weight desc nulls last, s.reps desc))[1] as top_reps
    from public.workout_sets s join last_w on last_w.id = s.workout_id
    where s.user_id = v_user and s.kind = 'work'
    group by s.exercise_id
  ),
  -- Estimated 1RM (Epley) per exercise, inside the period versus everything before it
  lifts as (
    select s.exercise_id,
           max(s.weight * (1 + s.reps / 30.0)) filter (where w.started_at >= v_from) as now_e1rm,
           max(s.weight * (1 + s.reps / 30.0)) filter (where w.started_at < v_from) as before_e1rm
    from public.workout_sets s join public.workouts w on w.id = s.workout_id
    where s.user_id = v_user and w.user_id = v_user and s.kind = 'work' and s.weight > 0 and s.reps > 0
    group by s.exercise_id
  )
  select jsonb_build_object(
    'period', jsonb_build_object('days', v_days, 'from', v_from_d, 'to', v_today),
    'sessions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', (c.started_at at time zone 'Europe/Madrid')::date,
        'name', c.name,
        'minutes', case when c.ended_at is not null then round(extract(epoch from c.ended_at - c.started_at) / 60) end,
        'work_sets', c.sets,
        'volume_kg', round(c.volume),
        'rpe', c.session_rpe,
        'deload', c.deload
      ) order by c.started_at) from cur c), '[]'::jsonb),
    'totals', jsonb_build_object(
      'sessions', (select count(*) from cur),
      'work_sets', (select coalesce(sum(sets), 0) from cur),
      'volume_kg', (select round(coalesce(sum(volume), 0)) from cur),
      'minutes', (select round(coalesce(sum(extract(epoch from ended_at - started_at)), 0) / 60) from cur where ended_at is not null)
    ),
    'previous_period', jsonb_build_object(
      'sessions', (select count(*) from prv),
      'volume_kg', (select round(coalesce(sum(volume), 0)) from prv)
    ),
    'this_week_sessions', (select count(*) from public.workouts w where w.user_id = v_user and w.started_at >= v_week),
    'weeks_trained_of_last_8', (
      select count(distinct date_trunc('week', w.started_at at time zone 'Europe/Madrid'))
      from public.workouts w
      where w.user_id = v_user and w.started_at >= (v_today - 55)::timestamp at time zone 'Europe/Madrid'
    ),
    'last_session', (
      select jsonb_build_object(
        'date', (l.started_at at time zone 'Europe/Madrid')::date,
        'name', l.name,
        'minutes', case when l.ended_at is not null then round(extract(epoch from l.ended_at - l.started_at) / 60) end,
        'exercises', coalesce((
          select jsonb_agg(jsonb_build_object('id', e.exercise_id, 'sets', e.sets, 'top_kg', e.top_kg, 'top_reps', e.top_reps)
                           order by e.sets desc, e.top_kg desc nulls last)
          from last_ex e), '[]'::jsonb)
      ) from last_w l),
    'improved_lifts', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.exercise_id, 'e1rm_kg', round(x.now_e1rm, 1), 'before_kg', round(x.before_e1rm, 1))
                       order by x.now_e1rm / x.before_e1rm desc)
      from lifts x where x.now_e1rm > x.before_e1rm), '[]'::jsonb),
    'health', (
      select case when count(*) = 0 then null else jsonb_build_object(
        'days', count(*),
        'sleep_min_avg', round(avg(h.sleep_min)),
        'steps_avg', round(avg(h.steps)),
        'resting_hr_avg', round(avg(h.resting_hr)),
        'hrv_ms_avg', round(avg(h.hrv_ms), 1),
        'weight_kg_last', (select h2.weight from public.health_daily h2
                           where h2.user_id = v_user and h2.weight is not null order by h2.date desc limit 1)
      ) end
      from public.health_daily h where h.user_id = v_user and h.date >= v_from_d),
    'activities', (
      select case when count(*) = 0 then null else jsonb_build_object(
        'count', count(*),
        'minutes', round(sum(a.duration_s) / 60.0),
        'km', round(sum(a.distance_m) / 1000.0, 1),
        'kinds', (select jsonb_object_agg(k.activity, k.n) from (
                    select a2.activity, count(*) as n from public.health_workouts a2
                    where a2.user_id = v_user and a2.started_at >= v_from group by a2.activity) k)
      ) end
      from public.health_workouts a where a.user_id = v_user and a.started_at >= v_from),
    'checkins', (
      select case when count(*) = 0 then null else jsonb_build_object(
        'count', count(*),
        'energy_avg', round(avg(c.energy), 1),
        'sleep_h_avg', round(avg(c.sleep_h), 1),
        'sleep_quality_avg', round(avg(c.sleep_quality), 1),
        'soreness_avg', round(avg(c.soreness), 1),
        'stress_avg', round(avg(c.stress), 1)
      ) end
      from public.checkins c where c.user_id = v_user and c.date >= v_from_d),
    'goals', jsonb_build_object(
      'active', (select count(*) from public.goals g where g.user_id = v_user and not g.archived and g.achieved_at is null),
      'next_deadline', (select min(g.deadline) from public.goals g
                        where g.user_id = v_user and not g.archived and g.achieved_at is null and g.deadline >= v_today)
    )
  ) into v_out;

  return v_out;
end;
$$;

revoke all on function public.orbe_summary(text, int) from public, authenticated;
grant execute on function public.orbe_summary(text, int) to anon, service_role;
