-- Food logged in Google Health, per day: energy eaten and macronutrients (nutrition-log
-- dailyRollUp, scope googlehealth.nutrition.readonly). Null on days with nothing logged.
alter table public.health_daily
  add column if not exists kcal_in   integer,
  add column if not exists protein_g numeric(6, 1),
  add column if not exists carbs_g   numeric(6, 1),
  add column if not exists fat_g     numeric(6, 1);
