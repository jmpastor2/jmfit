-- Orbe's «¿qué entreno me toca?» follows the app's rotation (src/features/train/rotation.ts).
--
-- The first version mirrored the old weekday logic: a program with weekdays answered the day
-- planned for each date. Training whenever possible (two sessions a week on a five-day plan), that
-- was wrong every time. Now the calendar rules only while it is kept: the last session was done on
-- its own weekday, under a week ago, and no planned day has gone by since. Otherwise (and always
-- for programs without weekdays) the answer is the day after the last one done, in program order:
-- mode 'rotation', `pending_this_week` lists every day in that order and `next` is the first.
-- `last_done` says which day was last and when. Same key, grants and output fields as before.

create or replace function public.orbe_plan(p_key text, p_days int default 7)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hash text;
  v_user uuid;
  v_days int := greatest(1, least(coalesce(p_days, 7), 14));
  v_today date := (now() at time zone 'Europe/Madrid')::date;
  v_monday date := date_trunc('week', (now() at time zone 'Europe/Madrid'))::date;
  v_prog public.programs%rowtype;
  v_fixed boolean;
  v_days_arr jsonb;
  v_done jsonb;
  v_schedule jsonb := '[]';
  v_pending jsonb;
  v_d date;
  v_wd int;
  v_day jsonb;
  v_target int;
  v_n int;
  v_last jsonb;          -- the last program day done: {order, weekday, name, date}
  v_last_date date;
  v_on_calendar boolean := false;
  v_next_order int := 1;
begin
  select s.decrypted_secret into v_hash from vault.decrypted_secrets s where s.name = 'orbe_key_sha256' limit 1;
  if v_hash is null or p_key is null
     or encode(extensions.digest(p_key, 'sha256'), 'hex') <> v_hash then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  select s.decrypted_secret::uuid into v_user from vault.decrypted_secrets s where s.name = 'orbe_user_id' limit 1;

  select p.* into v_prog
  from public.profiles pr join public.programs p on p.id = pr.active_program_id
  where pr.id = v_user;
  select pr.weekly_target into v_target from public.profiles pr where pr.id = v_user;

  if v_prog.id is null then
    return jsonb_build_object('program', null, 'today', v_today, 'weekly_target', v_target);
  end if;

  -- The day plan, trimmed to what a voice answer needs
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', d->>'id', 'name', d->>'name', 'focus', d->>'focus',
           'weekday', (d->>'weekday')::int, 'order', o,
           'exercises', (select coalesce(jsonb_agg(jsonb_build_object(
                           'exercise', s->>'exerciseId', 'sets', (s->>'sets')::int,
                           'rep_min', (s->>'repMin')::int, 'rep_max', (s->>'repMax')::int,
                           'rir', (s->>'rir')::numeric) order by so), '[]')
                         from jsonb_array_elements(coalesce(d->'slots', '[]')) with ordinality as x(s, so))
         ) order by o), '[]')
  into v_days_arr
  from jsonb_array_elements(v_prog.days) with ordinality as t(d, o);

  v_fixed := exists (select 1 from jsonb_array_elements(v_days_arr) d where d->>'weekday' is not null);

  -- Sessions this week (Monday 00:00 Madrid) and which program day each one covered
  select coalesce(jsonb_agg(jsonb_build_object(
           'name', w.name,
           'date', (w.started_at at time zone 'Europe/Madrid')::date,
           'finished', w.ended_at is not null,
           'day_id', coalesce(w.day_id, (select d->>'id' from jsonb_array_elements(v_days_arr) d
                                         where lower(d->>'name') = lower(w.name) limit 1))
         ) order by w.started_at), '[]')
  into v_done
  from public.workouts w
  where w.user_id = v_user and w.started_at >= (v_monday::timestamp at time zone 'Europe/Madrid');

  v_n := jsonb_array_length(v_days_arr);

  -- The last session of any day of the program, whenever it was (by day_id, or by name)
  select jsonb_build_object('order', (d->>'order')::int, 'weekday', d->>'weekday', 'name', d->>'name',
                            'date', (w.started_at at time zone 'Europe/Madrid')::date)
  into v_last
  from public.workouts w
  join jsonb_array_elements(v_days_arr) d
    on d->>'id' = w.day_id::text or (w.day_id is null and lower(d->>'name') = lower(w.name))
  where w.user_id = v_user
  order by w.started_at desc
  limit 1;

  if v_last is not null then
    v_last_date := (v_last->>'date')::date;
    v_next_order := ((v_last->>'order')::int % v_n) + 1;
    -- The calendar is being kept: done on its own weekday, under a week ago, no planned day gone by
    v_on_calendar := v_fixed
      and (v_last->>'weekday') is not null
      and (v_last->>'weekday')::int = extract(isodow from v_last_date)::int - 1
      and v_today - v_last_date < 7
      and not exists (
        select 1 from generate_series(v_last_date + 1, v_today - 1, interval '1 day') g(x)
        join jsonb_array_elements(v_days_arr) d on (d->>'weekday')::int = extract(isodow from g.x)::int - 1);
  end if;

  -- Off the calendar a fixed plan is followed in order, like a floating one
  if v_fixed and v_last is not null and not v_on_calendar then
    v_fixed := false;
  end if;

  if v_fixed then
    for i in 0 .. v_days - 1 loop
      v_d := v_today + i;
      v_wd := (extract(isodow from v_d)::int) - 1;   -- 0 = Monday … 6 = Sunday, like the app
      v_day := null;
      select d into v_day from jsonb_array_elements(v_days_arr) d where (d->>'weekday')::int = v_wd limit 1;
      v_schedule := v_schedule || jsonb_build_array(jsonb_build_object(
        'date', v_d, 'weekday', v_wd, 'rest', v_day is null,
        'day', case when v_day is null then null else v_day - 'id' - 'order' end));
    end loop;
  end if;

  -- Rotation: every day in order, starting with the one after the last done (across weeks)
  select coalesce(jsonb_agg(d - 'id' order by (((d->>'order')::int - v_next_order + v_n) % v_n)), '[]')
  into v_pending
  from jsonb_array_elements(v_days_arr) d;

  return jsonb_build_object(
    'program', v_prog.name,
    'mode', case when v_fixed then 'fixed' else 'rotation' end,
    'today', v_today,
    'weekly_target', v_target,
    'week_sessions', v_done,
    'trained_today', exists (select 1 from jsonb_array_elements(v_done) w where (w->>'date')::date = v_today),
    'schedule', case when v_fixed then v_schedule else null end,
    'pending_this_week', case when v_fixed then null else v_pending end,
    'next', case when v_fixed then null else v_pending->0 end,
    'last_done', v_last - 'order' - 'weekday',
    'note', case when v_fixed then null
                 else 'Sin calendario: toca el primer día de pending_this_week, el siguiente al último hecho; se entrena cuando se puede.' end,
    'rotation', case when v_fixed then null
                     else (select jsonb_agg(d->>'name' order by (d->>'order')::int) from jsonb_array_elements(v_days_arr) d) end
  );
end;
$$;

revoke all on function public.orbe_plan(text, int) from public, authenticated;
grant execute on function public.orbe_plan(text, int) to anon, service_role;
