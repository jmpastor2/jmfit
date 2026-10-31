-- Database performance, from a review on 31-oct-2026 (the data is small; this keeps it fast as it grows).
--
-- Indexes for foreign keys that had none: joins and the ON DELETE checks on the parent no longer scan the table.
create index if not exists custom_exercises_user_id_idx on public.custom_exercises (user_id);
create index if not exists food_items_added_by_idx on public.food_items (added_by);
create index if not exists food_logs_food_item_id_idx on public.food_logs (food_item_id);
create index if not exists gym_machines_user_id_idx on public.gym_machines (user_id);
create index if not exists profiles_active_program_id_idx on public.profiles (active_program_id);
create index if not exists workouts_program_id_idx on public.workouts (program_id);

-- RLS: auth.uid() written bare is evaluated once per row; wrapped as (select auth.uid()) Postgres evaluates it
-- once per query (Supabase's "auth_rls_initplan" advice). Same rule, same result. Rewritten in place with
-- ALTER POLICY from each policy's own definition, so nothing else about the policies changes. Idempotent:
-- a policy that is already wrapped is left as it is.
do $$
declare
  p record;
  envolver constant text := '(select auth.uid())';
  usar text;
  comprobar text;
begin
  for p in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (coalesce(qual, '') ~ '(?<!SELECT )auth\.uid\(\)' or coalesce(with_check, '') ~ '(?<!SELECT )auth\.uid\(\)')
  loop
    usar := regexp_replace(p.qual, '(?<!SELECT )auth\.uid\(\)', envolver, 'g');
    comprobar := regexp_replace(p.with_check, '(?<!SELECT )auth\.uid\(\)', envolver, 'g');
    if usar is not null then
      execute format('alter policy %I on %I.%I using (%s)', p.policyname, p.schemaname, p.tablename, usar);
    end if;
    if comprobar is not null then
      execute format('alter policy %I on %I.%I with check (%s)', p.policyname, p.schemaname, p.tablename, comprobar);
    end if;
  end loop;
end
$$;
