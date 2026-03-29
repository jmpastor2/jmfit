-- ═══════════════════════════════════════════════════════════════
--  JM FIT v3 MULTIUSUARIO · Supabase Schema
--  ⚠️  Ejecutar en Supabase → SQL Editor → Run
--  ⚠️  Si ya tienes tablas de v2, primero haz backup exportando JSON
-- ═══════════════════════════════════════════════════════════════

-- ┌──────────────────────────────────────────────┐
-- │  1. DROP old tables if migrating from v2     │
-- └──────────────────────────────────────────────┘
DROP TABLE IF EXISTS food_logs CASCADE;
DROP TABLE IF EXISTS workout_logs CASCADE;
DROP TABLE IF EXISTS scans CASCADE;

-- ┌──────────────────────────────────────────────┐
-- │  2. PROFILES — per-user config & onboarding  │
-- └──────────────────────────────────────────────┘
CREATE TABLE IF NOT EXISTS profiles (
  id              UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  display_name    TEXT NOT NULL DEFAULT '',
  email           TEXT,
  height_cm       INTEGER,
  birth_date      DATE,
  sex             TEXT CHECK (sex IN ('M','F','O')),
  goal            TEXT DEFAULT 'muscle_gain',  -- muscle_gain | glute_focus | strength | recomp | cut | general
  goal_detail     TEXT DEFAULT '',             -- free text, e.g. "fortalecer tren inferior y glúteos"
  training_days   INTEGER DEFAULT 5,
  training_split  TEXT DEFAULT 'push_pull_legs', -- push_pull_legs | upper_lower | full_body | bro_split | custom
  influencers     TEXT[] DEFAULT '{}',         -- array: ['CBum','Jeff Nippard','RP Strength']
  target_kcal     INTEGER DEFAULT 2500,
  target_protein  INTEGER DEFAULT 160,
  target_carbs    INTEGER DEFAULT 300,
  target_fat      INTEGER DEFAULT 70,
  avatar_url      TEXT,
  onboarded       BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ┌──────────────────────────────────────────────┐
-- │  3. SCANS — Boditrax body composition        │
-- └──────────────────────────────────────────────┘
CREATE TABLE IF NOT EXISTS scans (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date          DATE NOT NULL,
  peso          NUMERIC(5,2),
  grasa         NUMERIC(5,2),
  grasa_kg      NUMERIC(5,2),
  musculo       NUMERIC(5,2),
  agua          NUMERIC(5,2),
  agua_pct      NUMERIC(5,2),
  agua_intra    NUMERIC(5,2),
  agua_extra    NUMERIC(5,2),
  hueso         NUMERIC(5,2),
  visceral      NUMERIC(4,1),
  tmb           INTEGER,
  edad_met      INTEGER,
  imc           NUMERIC(5,2),
  score         INTEGER,
  masa_magra    NUMERIC(5,2),
  phase_angle   NUMERIC(4,2),
  leg_score     INTEGER,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- ┌──────────────────────────────────────────────┐
-- │  4. WORKOUT LOGS — exercise tracking         │
-- └──────────────────────────────────────────────┘
CREATE TABLE IF NOT EXISTS workout_logs (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  exercise      TEXT NOT NULL,
  weight_kg     NUMERIC(6,2),
  reps          INTEGER,
  sets          INTEGER,
  rpe           NUMERIC(3,1),
  rest_sec      INTEGER,
  notes         TEXT,
  checkin       TEXT,
  sleep_h       NUMERIC(3,1),
  energy        INTEGER,
  stress        INTEGER
);

-- ┌──────────────────────────────────────────────┐
-- │  5. FOOD ITEMS — shared food database        │
-- │     All users can see & use these            │
-- └──────────────────────────────────────────────┘
CREATE TABLE IF NOT EXISTS food_items (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name          TEXT NOT NULL,
  protein_per100  NUMERIC(6,1) DEFAULT 0,
  carbs_per100    NUMERIC(6,1) DEFAULT 0,
  fat_per100      NUMERIC(6,1) DEFAULT 0,
  kcal_per100     INTEGER DEFAULT 0,
  category      TEXT DEFAULT 'general', -- protein | carbs | fats | vegetables | fruits | dairy | supplements | general
  added_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_global     BOOLEAN DEFAULT TRUE,   -- visible to all users
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ┌──────────────────────────────────────────────┐
-- │  6. FOOD LOGS — daily nutrition tracking     │
-- └──────────────────────────────────────────────┘
CREATE TABLE IF NOT EXISTS food_logs (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  log_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  food_item_id  UUID REFERENCES food_items(id) ON DELETE SET NULL,
  food_name     TEXT NOT NULL,
  quantity_g    NUMERIC(6,1),
  protein_g     NUMERIC(6,1),
  carbs_g       NUMERIC(6,1),
  fat_g         NUMERIC(6,1),
  kcal          INTEGER,
  meal_slot     TEXT DEFAULT 'other' -- breakfast | mid_morning | lunch | pre_gym | post_gym | dinner | snack | other
);

-- ┌──────────────────────────────────────────────┐
-- │  7. ROUTINES — workout templates per user    │
-- └──────────────────────────────────────────────┘
CREATE TABLE IF NOT EXISTS routines (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  day_index     INTEGER NOT NULL CHECK (day_index BETWEEN 0 AND 6), -- 0=Lunes..6=Domingo
  day_label     TEXT NOT NULL,
  type          TEXT DEFAULT 'custom', -- push | pull | legs | upper | arms | rest | custom
  description   TEXT DEFAULT '',
  philosophy    TEXT DEFAULT '',
  exercises     JSONB DEFAULT '[]',   -- [{name, sets, star, cue, yt}]
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, day_index)
);

-- ┌──────────────────────────────────────────────┐
-- │  8. ROW LEVEL SECURITY                       │
-- └──────────────────────────────────────────────┘
ALTER TABLE profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE scans        ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_logs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE routines     ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read/update their own profile
CREATE POLICY "profiles_own" ON profiles
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Allow insert on signup (the trigger or app inserts with the user's own id)
CREATE POLICY "profiles_insert" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Scans: own data only
CREATE POLICY "scans_own" ON scans
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Workout logs: own data only
CREATE POLICY "workouts_own" ON workout_logs
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Food items: everyone can read global items, users can insert
CREATE POLICY "food_items_read" ON food_items
  FOR SELECT USING (is_global = TRUE OR added_by = auth.uid());

CREATE POLICY "food_items_insert" ON food_items
  FOR INSERT WITH CHECK (auth.uid() = added_by);

-- Food logs: own data only
CREATE POLICY "food_own" ON food_logs
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Routines: own data only
CREATE POLICY "routines_own" ON routines
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ┌──────────────────────────────────────────────┐
-- │  9. AUTO-CREATE PROFILE ON SIGNUP            │
-- └──────────────────────────────────────────────┘
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', SPLIT_PART(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ┌──────────────────────────────────────────────┐
-- │  10. SEED: Global food items database        │
-- └──────────────────────────────────────────────┘
INSERT INTO food_items (name, protein_per100, carbs_per100, fat_per100, kcal_per100, category, is_global) VALUES
  ('Pechuga de pollo', 31, 0, 3.6, 165, 'protein', TRUE),
  ('Pechuga de pavo', 29, 0, 1, 135, 'protein', TRUE),
  ('Salmón fresco', 25, 0, 13, 220, 'protein', TRUE),
  ('Atún en lata (agua)', 26, 0, 1, 116, 'protein', TRUE),
  ('Merluza', 17, 0, 1.5, 82, 'protein', TRUE),
  ('Huevo entero', 13, 1, 11, 155, 'protein', TRUE),
  ('Clara de huevo', 11, 1, 0, 52, 'protein', TRUE),
  ('Ternera magra', 26, 0, 7, 175, 'protein', TRUE),
  ('Cerdo lomo', 22, 0, 8, 165, 'protein', TRUE),
  ('Carne picada 5%', 23, 0, 5, 140, 'protein', TRUE),
  ('Queso cottage', 11, 3, 4, 98, 'dairy', TRUE),
  ('Yogur griego natural', 10, 4, 5, 100, 'dairy', TRUE),
  ('Requesón', 12, 3, 4, 100, 'dairy', TRUE),
  ('Arroz blanco cocido', 2.7, 28, 0.3, 130, 'carbs', TRUE),
  ('Arroz integral cocido', 2.6, 23, 1, 112, 'carbs', TRUE),
  ('Pasta cocida', 5, 31, 1, 158, 'carbs', TRUE),
  ('Patata cocida', 2, 17, 0.1, 77, 'carbs', TRUE),
  ('Batata / boniato', 1.6, 20, 0.1, 86, 'carbs', TRUE),
  ('Pan integral', 9, 41, 3, 247, 'carbs', TRUE),
  ('Avena', 17, 66, 7, 389, 'carbs', TRUE),
  ('Quinoa cocida', 4.4, 21, 1.9, 120, 'carbs', TRUE),
  ('Lentejas cocidas', 9, 20, 0.4, 116, 'carbs', TRUE),
  ('Garbanzos cocidos', 9, 27, 2.6, 164, 'carbs', TRUE),
  ('Aceite de oliva', 0, 0, 100, 900, 'fats', TRUE),
  ('Aguacate', 2, 9, 15, 160, 'fats', TRUE),
  ('Nueces', 15, 14, 65, 654, 'fats', TRUE),
  ('Almendras', 21, 22, 49, 579, 'fats', TRUE),
  ('Mantequilla cacahuete', 25, 20, 50, 588, 'fats', TRUE),
  ('Plátano', 1.1, 23, 0.3, 89, 'fruits', TRUE),
  ('Manzana', 0.3, 14, 0.2, 52, 'fruits', TRUE),
  ('Naranja', 0.9, 12, 0.1, 47, 'fruits', TRUE),
  ('Fresas', 0.7, 8, 0.3, 32, 'fruits', TRUE),
  ('Arándanos', 0.7, 14, 0.3, 57, 'fruits', TRUE),
  ('Espinacas', 2.9, 3.6, 0.4, 23, 'vegetables', TRUE),
  ('Lechuga romana', 1.2, 3.3, 0.3, 17, 'vegetables', TRUE),
  ('Tomate', 0.9, 3.9, 0.2, 18, 'vegetables', TRUE),
  ('Pepino', 0.7, 3.6, 0.1, 15, 'vegetables', TRUE),
  ('Zanahoria', 0.9, 10, 0.2, 41, 'vegetables', TRUE),
  ('Pimiento rojo', 1, 6, 0.3, 31, 'vegetables', TRUE),
  ('Cebolla', 1.1, 9, 0.1, 40, 'vegetables', TRUE),
  ('Leche desnatada', 3.4, 5, 0.1, 35, 'dairy', TRUE),
  ('Proteína whey', 80, 5, 3, 370, 'supplements', TRUE),
  ('Aceitunas', 0.8, 3.8, 15, 145, 'fats', TRUE),
  ('Jamón serrano', 30, 0, 10, 215, 'protein', TRUE),
  ('Pavo fiambre bajo grasa', 18, 1, 2, 95, 'protein', TRUE),
  ('Miel', 0.3, 82, 0, 304, 'carbs', TRUE)
ON CONFLICT DO NOTHING;

-- ┌──────────────────────────────────────────────┐
-- │  11. INDEXES                                 │
-- └──────────────────────────────────────────────┘
CREATE INDEX IF NOT EXISTS idx_scans_user_date    ON scans(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_workouts_user_date ON workout_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_food_user_date     ON food_logs(user_id, log_date DESC);
CREATE INDEX IF NOT EXISTS idx_routines_user      ON routines(user_id, day_index);
CREATE INDEX IF NOT EXISTS idx_food_items_global  ON food_items(is_global) WHERE is_global = TRUE;
