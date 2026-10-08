/**
 * Forja domain types. Shared by the content catalog, the training engine, the data layer and
 * the screens. Weights are always kilograms; durations seconds; dates ISO strings.
 */

/* ───────────── Muscles & exercises ───────────── */

export type Muscle =
  | 'chest'
  | 'back' // lats + mid back
  | 'traps'
  | 'front_delts'
  | 'side_delts'
  | 'rear_delts'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'adductors'
  | 'calves'
  | 'abs'
  | 'lower_back'

export type Equipment =
  | 'barbell'
  | 'dumbbell'
  | 'machine' // selectorized (pin stack)
  | 'plate_loaded' // Hammer Strength style
  | 'cable'
  | 'smith'
  | 'bodyweight'
  | 'kettlebell'
  | 'ez_bar'
  | 'band'
  | 'cardio'

/** Movement pattern: drives warm-ups, rest defaults and strength standards. */
export type Pattern =
  | 'horizontal_push'
  | 'vertical_push'
  | 'horizontal_pull'
  | 'vertical_pull'
  | 'squat'
  | 'hinge'
  | 'lunge'
  | 'isolation_upper'
  | 'isolation_lower'
  | 'core'
  | 'carry'
  | 'cardio'

export interface ExerciseVideo {
  /** YouTube video id (11 chars), verified to exist. */
  youtubeId: string
  title: string
  /** Channel name, shown as the source. */
  channel: string
  lang: 'es' | 'en'
  /** Second where the relevant part starts (long ranking videos). */
  start?: number
}

export interface Exercise {
  /** Stable slug, e.g. "bench-press". Never change once shipped: sets reference it. */
  id: string
  name: string
  /** Other names people use (search). */
  aliases?: string[]
  primary: Muscle[]
  secondary: Muscle[]
  equipment: Equipment
  pattern: Pattern
  /** Compound lifts get warm-up ramps, longer rest and appear in strength KPIs. */
  compound: boolean
  /** Smallest practical weight jump in kg (2.5 barbell, 2 dumbbells, 5 stack…). */
  increment: number
  /** Bodyweight exercises: load logged is extra load (lastre) on top of bodyweight. */
  bodyweight?: boolean
  /** Held for time (planks): `reps` of its sets are seconds. */
  timed?: boolean
  /** Default rest between work sets, seconds. */
  restSec: number
  /** 3–5 short technique cues, imperative, Spanish. */
  cues: string[]
  /** 2–3 frequent mistakes. */
  mistakes: string[]
  videos: ExerciseVideo[]
  /**
   * Modern variation popularised by a coach or creator (lat pull-around, Bayesian curl…):
   * who made it known and why it works. Shown in the library's «Novedades» section.
   */
  trend?: { by: string; why: string }
}

/* ───────────── Programs ───────────── */

export type Goal = 'hypertrophy' | 'strength' | 'recomp' | 'cut' | 'maintenance' | 'glutes'
export type Experience = 'novice' | 'intermediate' | 'advanced'

/** One exercise prescription inside a program day. */
export interface Slot {
  id: string
  exerciseId: string
  sets: number
  repMin: number
  repMax: number
  /** Target reps in reserve on work sets (0 = to failure). */
  rir: number
  restSec: number
  note?: string
  /** Same letter = superset, done back to back. */
  superset?: string
}

export interface ProgramDay {
  id: string
  name: string // "Empuje", "Pierna A"…
  focus: string // "Pecho · Hombro · Tríceps"
  /** 0 = Monday … 6 = Sunday; null = floating day. */
  weekday: number | null
  slots: Slot[]
}

export interface ProgramTemplate {
  id: string
  name: string
  description: string
  goal: Goal[]
  level: Experience[]
  daysPerWeek: number
  /** Weeks before a planned deload. */
  mesoWeeks: number
  days: ProgramDay[]
}

/* ───────────── Logged training ───────────── */

export type SetKind = 'warmup' | 'work' | 'drop' | 'failure'

export interface LoggedSet {
  id: string
  workoutId: string
  exerciseId: string
  /** Order of the exercise inside the workout. */
  exerciseIndex: number
  /** Order of the set inside that exercise. */
  setIndex: number
  kind: SetKind
  weight: number | null
  reps: number | null
  rir: number | null
  /** ISO timestamp the set was completed. */
  doneAt: string
}

export interface Workout {
  id: string
  name: string
  programId: string | null
  dayId: string | null
  startedAt: string
  endedAt: string | null
  notes: string | null
  /** Session RPE 1–10, asked at the end. */
  sessionRpe: number | null
  bodyweight: number | null
}

/* ───────────── Engine outputs ───────────── */

export interface SetTarget {
  setIndex: number
  kind: SetKind
  weight: number | null
  repMin: number
  repMax: number
  rir: number
}

export type ProgressionReason =
  | 'first_time' // no history: find a working weight
  | 'add_weight' // all sets at top of range → go up
  | 'add_reps' // keep weight, chase reps
  | 'hold' // performance dipped once: repeat
  | 'reduce' // two dips in a row / fatigue: back off
  | 'deload' // planned deload week

export interface Recommendation {
  exerciseId: string
  reason: ProgressionReason
  /** Human sentence in Spanish, e.g. "Subes a 82,5 kg: hiciste 4×10 a RIR 2 la última vez". */
  message: string
  warmups: SetTarget[]
  work: SetTarget[]
  /** Last time this exercise was trained, for the "la última vez" line. */
  last: {
    date: string
    sets: { weight: number | null; reps: number | null; rir: number | null }[]
  } | null
}

export type PrKind = 'e1rm' | 'weight' | 'reps' | 'volume'

export interface PersonalRecord {
  exerciseId: string
  kind: PrKind
  value: number
  /** For rep PRs: the weight the reps were done at. */
  atWeight?: number
  setId: string
  date: string
  previous: number | null
}

/* ───────────── Body & recovery ───────────── */

export interface Scan {
  date: string
  peso: number | null
  grasa: number | null // %
  grasaKg: number | null
  musculo: number | null
  agua: number | null
  aguaIntra: number | null
  aguaExtra: number | null
  hueso: number | null
  visceral: number | null
  tmb: number | null
  edadMet: number | null
  imc: number | null
  score: number | null
  masaMagra: number | null
  legScore: number | null
}

export interface HealthDay {
  date: string
  source: 'google_health' | 'manual'
  sleepMin: number | null
  deepMin: number | null
  remMin: number | null
  lightMin: number | null
  awakeMin: number | null
  restingHr: number | null
  hrvMs: number | null
  steps: number | null
  activeKcal: number | null
  vo2max: number | null
  weight: number | null
  bodyFat: number | null
}

export interface Checkin {
  date: string
  sleepH: number | null
  /** 1–5 each. */
  sleepQuality: number | null
  energy: number | null
  soreness: number | null
  stress: number | null
  /** Typed from the wearable's app when it cannot be synced. */
  restingHr?: number | null
  hrvMs?: number | null
  steps?: number | null
}

export type ReadinessLevel = 'push' | 'normal' | 'easy' | 'unknown'

export interface Readiness {
  score: number | null // 0–100
  level: ReadinessLevel
  /** Spanish lines explaining what moved the score. */
  factors: string[]
}

/* ───────────── Goals ───────────── */

export type GoalKind =
  | 'e1rm' // exercise estimated 1RM
  | 'lift' // lift X kg for N reps
  | 'bodyweight'
  | 'bodyfat'
  | 'muscle'
  | 'frequency' // sessions per week

export interface UserGoal {
  id: string
  kind: GoalKind
  exerciseId: string | null
  reps: number | null
  target: number
  start: number | null
  startDate: string
  deadline: string | null
  achievedAt: string | null
}
