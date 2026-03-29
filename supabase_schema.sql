-- ═══════════════════════════════════════════════
--  JM FIT v3 · Supabase Schema
--  Pega esto en Supabase → SQL Editor → Run
-- ═══════════════════════════════════════════════

-- Habilitar RLS (Row Level Security) para todos
-- Cada usuario solo ve sus propios datos

-- ── SCANS BODITRAX ──────────────────────────────
CREATE TABLE IF NOT EXISTS scans (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date          DATE NOT NULL,
  peso          NUMERIC(5,2),
  grasa         NUMERIC(5,2),   -- % grasa corporal
  grasa_kg      NUMERIC(5,2),   -- masa grasa en kg
  musculo       NUMERIC(5,2),   -- masa muscular kg
  agua          NUMERIC(5,2),   -- agua total kg
  agua_pct      NUMERIC(5,2),   -- % agua
  agua_intra    NUMERIC(5,2),   -- agua intracelular kg
  agua_extra    NUMERIC(5,2),   -- agua extracelular kg
  hueso         NUMERIC(5,2),   -- masa ósea kg
  visceral      NUMERIC(4,1),   -- grasa visceral rating
  tmb           INTEGER,        -- tasa metabólica basal kcal
  edad_met      INTEGER,        -- edad metabólica
  imc           NUMERIC(5,2),   -- índice masa corporal
  score         INTEGER,        -- Boditrax Score
  masa_magra    NUMERIC(5,2),   -- fat free mass kg
  phase_angle   NUMERIC(4,2),   -- integridad celular
  leg_score     INTEGER,        -- leg muscle score
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- ── WORKOUT LOGS ────────────────────────────────
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

-- ── FOOD LOGS ───────────────────────────────────
CREATE TABLE IF NOT EXISTS food_logs (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  log_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  food_name     TEXT NOT NULL,
  quantity_g    NUMERIC(6,1),
  protein_g     NUMERIC(6,1),
  carbs_g       NUMERIC(6,1),
  fat_g         NUMERIC(6,1),
  kcal          INTEGER
);

-- ── ROW LEVEL SECURITY ──────────────────────────
ALTER TABLE scans        ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_logs    ENABLE ROW LEVEL SECURITY;

-- Políticas: cada usuario solo accede a sus datos
CREATE POLICY "scans_own"    ON scans
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "workouts_own" ON workout_logs
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "food_own"     ON food_logs
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── ÍNDICES ─────────────────────────────────────
CREATE INDEX IF NOT EXISTS scans_user_date        ON scans(user_id, date DESC);
CREATE INDEX IF NOT EXISTS workouts_user_date     ON workout_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS food_user_date         ON food_logs(user_id, log_date DESC);
