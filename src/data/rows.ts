/**
 * Database rows (snake_case, as PostgREST returns them) and their mapping to domain types.
 * Numeric columns arrive as strings: `num` turns them into numbers or null.
 */
import type {
  Checkin,
  Experience,
  Goal,
  GoalKind,
  HealthDay,
  LoggedSet,
  ProgramDay,
  Slot,
  Scan,
  SetKind,
  UserGoal,
  Workout,
} from '@/domain/types'

export const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

/* ─── Profile ─── */

export interface Profile {
  id: string
  displayName: string
  email: string | null
  heightCm: number | null
  birthDate: string | null
  sex: 'M' | 'F' | 'O' | null
  experience: Experience
  trainingGoal: Goal
  weeklyTarget: number
  barKg: number
  platesKg: number[]
  restSound: boolean
  activeProgramId: string | null
  targetKcal: number | null
  targetProtein: number | null
  targetCarbs: number | null
  targetFat: number | null
  onboarded: boolean
}

export interface ProfileRow {
  id: string
  display_name: string
  email: string | null
  height_cm: number | null
  birth_date: string | null
  sex: 'M' | 'F' | 'O' | null
  experience: Experience
  training_goal: Goal
  weekly_target: number
  bar_kg: string | number
  plates_kg: (string | number)[]
  rest_sound: boolean
  active_program_id: string | null
  target_kcal: number | null
  target_protein: number | null
  target_carbs: number | null
  target_fat: number | null
  onboarded: boolean
}

export const toProfile = (r: ProfileRow): Profile => ({
  id: r.id,
  displayName: r.display_name,
  email: r.email,
  heightCm: r.height_cm,
  birthDate: r.birth_date,
  sex: r.sex,
  experience: r.experience,
  trainingGoal: r.training_goal,
  weeklyTarget: r.weekly_target,
  barKg: num(r.bar_kg) ?? 20,
  platesKg: (r.plates_kg ?? []).map((p) => num(p) ?? 0).filter((p) => p > 0),
  restSound: r.rest_sound,
  activeProgramId: r.active_program_id,
  targetKcal: r.target_kcal,
  targetProtein: r.target_protein,
  targetCarbs: r.target_carbs,
  targetFat: r.target_fat,
  onboarded: r.onboarded,
})

export function profilePatch(p: Partial<Profile>): Partial<ProfileRow> {
  const out: Partial<ProfileRow> = {}
  if (p.displayName !== undefined) out.display_name = p.displayName
  if (p.heightCm !== undefined) out.height_cm = p.heightCm
  if (p.birthDate !== undefined) out.birth_date = p.birthDate
  if (p.sex !== undefined) out.sex = p.sex
  if (p.experience !== undefined) out.experience = p.experience
  if (p.trainingGoal !== undefined) out.training_goal = p.trainingGoal
  if (p.weeklyTarget !== undefined) out.weekly_target = p.weeklyTarget
  if (p.barKg !== undefined) out.bar_kg = p.barKg
  if (p.platesKg !== undefined) out.plates_kg = p.platesKg
  if (p.restSound !== undefined) out.rest_sound = p.restSound
  if (p.activeProgramId !== undefined) out.active_program_id = p.activeProgramId
  if (p.targetKcal !== undefined) out.target_kcal = p.targetKcal
  if (p.targetProtein !== undefined) out.target_protein = p.targetProtein
  if (p.targetCarbs !== undefined) out.target_carbs = p.targetCarbs
  if (p.targetFat !== undefined) out.target_fat = p.targetFat
  if (p.onboarded !== undefined) out.onboarded = p.onboarded
  return out
}

/* ─── Programs ─── */

export interface Program {
  id: string
  name: string
  templateId: string | null
  mesoWeeks: number
  startedOn: string
  days: ProgramDay[]
  archived: boolean
}

export interface ProgramRow {
  id: string
  user_id?: string
  name: string
  template_id: string | null
  meso_weeks: number
  started_on: string
  days: ProgramDay[]
  archived: boolean
}

export const toProgram = (r: ProgramRow): Program => ({
  id: r.id,
  name: r.name,
  templateId: r.template_id,
  mesoWeeks: r.meso_weeks,
  startedOn: r.started_on,
  days: Array.isArray(r.days) ? r.days : [],
  archived: r.archived,
})

export const fromProgram = (p: Program): ProgramRow => ({
  id: p.id,
  name: p.name,
  template_id: p.templateId,
  meso_weeks: p.mesoWeeks,
  started_on: p.startedOn,
  days: p.days,
  archived: p.archived,
})

/* ─── Workouts & sets ─── */

export interface WorkoutRow {
  id: string
  name: string
  program_id: string | null
  day_id: string | null
  started_at: string
  ended_at: string | null
  notes: string | null
  session_rpe: string | number | null
  bodyweight: string | number | null
  deload: boolean
  plan: Slot[] | null
}

/** A session with the prescription it was run against (slots copied from the program day). */
export type WorkoutFull = Workout & { deload: boolean; plan: Slot[] }

export const toWorkout = (r: WorkoutRow): WorkoutFull => ({
  id: r.id,
  name: r.name,
  programId: r.program_id,
  dayId: r.day_id,
  startedAt: r.started_at,
  endedAt: r.ended_at,
  notes: r.notes,
  sessionRpe: num(r.session_rpe),
  bodyweight: num(r.bodyweight),
  deload: r.deload,
  plan: Array.isArray(r.plan) ? r.plan : [],
})

export const fromWorkout = (w: WorkoutFull): WorkoutRow => ({
  id: w.id,
  name: w.name,
  program_id: w.programId,
  day_id: w.dayId,
  started_at: w.startedAt,
  ended_at: w.endedAt,
  notes: w.notes,
  session_rpe: w.sessionRpe,
  bodyweight: w.bodyweight,
  deload: w.deload,
  plan: w.plan,
})

export interface SetRow {
  id: string
  workout_id: string
  exercise_id: string
  exercise_index: number
  set_index: number
  kind: SetKind
  weight: string | number | null
  reps: number | null
  rir: string | number | null
  done_at: string
}

export const toSet = (r: SetRow): LoggedSet => ({
  id: r.id,
  workoutId: r.workout_id,
  exerciseId: r.exercise_id,
  exerciseIndex: r.exercise_index,
  setIndex: r.set_index,
  kind: r.kind,
  weight: num(r.weight),
  reps: r.reps,
  rir: num(r.rir),
  doneAt: r.done_at,
})

export const fromSet = (s: LoggedSet): SetRow => ({
  id: s.id,
  workout_id: s.workoutId,
  exercise_id: s.exerciseId,
  exercise_index: s.exerciseIndex,
  set_index: s.setIndex,
  kind: s.kind,
  weight: s.weight,
  reps: s.reps,
  rir: s.rir,
  done_at: s.doneAt,
})

/* ─── Scans ─── */

export interface ScanRow {
  date: string
  peso: unknown
  grasa: unknown
  grasa_kg: unknown
  musculo: unknown
  agua: unknown
  agua_intra: unknown
  agua_extra: unknown
  hueso: unknown
  visceral: unknown
  tmb: unknown
  edad_met: unknown
  imc: unknown
  score: unknown
  masa_magra: unknown
  leg_score: unknown
}

export const toScan = (r: ScanRow): Scan => {
  const peso = num(r.peso)
  const grasaKg = num(r.grasa_kg)
  const grasa = num(r.grasa) ?? (grasaKg && peso ? Math.round((grasaKg / peso) * 1000) / 10 : null)
  return {
    date: r.date,
    peso,
    grasa,
    grasaKg: grasaKg ?? (grasa && peso ? Math.round(grasa * peso) / 100 : null),
    musculo: num(r.musculo),
    agua: num(r.agua),
    aguaIntra: num(r.agua_intra),
    aguaExtra: num(r.agua_extra),
    hueso: num(r.hueso),
    visceral: num(r.visceral),
    tmb: num(r.tmb),
    edadMet: num(r.edad_met),
    imc: num(r.imc),
    score: num(r.score),
    masaMagra: num(r.masa_magra),
    legScore: num(r.leg_score),
  }
}

export const fromScan = (s: Scan) => ({
  date: s.date,
  peso: s.peso,
  grasa: s.grasa,
  grasa_kg: s.grasaKg,
  musculo: s.musculo,
  agua: s.agua,
  agua_pct: s.agua && s.peso ? Math.round((s.agua / s.peso) * 1000) / 10 : null,
  agua_intra: s.aguaIntra,
  agua_extra: s.aguaExtra,
  hueso: s.hueso,
  visceral: s.visceral,
  tmb: s.tmb,
  edad_met: s.edadMet,
  imc: s.imc,
  score: s.score,
  masa_magra: s.masaMagra,
  leg_score: s.legScore,
})

/* ─── Goals ─── */

export interface GoalRow {
  id: string
  kind: GoalKind
  exercise_id: string | null
  reps: number | null
  target: unknown
  start: unknown
  start_date: string
  deadline: string | null
  achieved_at: string | null
  archived?: boolean
}

export const toGoal = (r: GoalRow): UserGoal => ({
  id: r.id,
  kind: r.kind,
  exerciseId: r.exercise_id,
  reps: r.reps,
  target: num(r.target) ?? 0,
  start: num(r.start),
  startDate: r.start_date,
  deadline: r.deadline,
  achievedAt: r.achieved_at,
})

export const fromGoal = (g: UserGoal): GoalRow => ({
  id: g.id,
  kind: g.kind,
  exercise_id: g.exerciseId,
  reps: g.reps,
  target: g.target,
  start: g.start,
  start_date: g.startDate,
  deadline: g.deadline,
  achieved_at: g.achievedAt,
})

/* ─── Check-ins & wearable ─── */

export interface CheckinRow {
  date: string
  sleep_h: unknown
  sleep_quality: number | null
  energy: number | null
  soreness: number | null
  stress: number | null
  resting_hr?: number | null
  hrv_ms?: number | null
  steps?: number | null
}

export const toCheckin = (r: CheckinRow): Checkin => ({
  date: r.date,
  sleepH: num(r.sleep_h),
  sleepQuality: r.sleep_quality,
  energy: r.energy,
  soreness: r.soreness,
  stress: r.stress,
  restingHr: r.resting_hr ?? null,
  hrvMs: r.hrv_ms ?? null,
  steps: r.steps ?? null,
})

export const fromCheckin = (c: Checkin): CheckinRow => ({
  date: c.date,
  sleep_h: c.sleepH,
  sleep_quality: c.sleepQuality,
  energy: c.energy,
  soreness: c.soreness,
  stress: c.stress,
  resting_hr: c.restingHr ?? null,
  hrv_ms: c.hrvMs ?? null,
  steps: c.steps ?? null,
})

/** A check-in seen as a wearable day, so typed numbers feed the same readiness and charts. */
export const checkinAsHealthDay = (c: Checkin): HealthDay => ({
  date: c.date,
  source: 'manual',
  sleepMin: c.sleepH != null ? Math.round(c.sleepH * 60) : null,
  deepMin: null,
  remMin: null,
  lightMin: null,
  awakeMin: null,
  restingHr: c.restingHr ?? null,
  hrvMs: c.hrvMs ?? null,
  steps: c.steps ?? null,
  activeKcal: null,
  vo2max: null,
  weight: null,
  bodyFat: null,
})

export const toHealthDay = (r: Record<string, unknown>): HealthDay => ({
  date: String(r.date),
  source: r.source === 'manual' ? 'manual' : 'google_health',
  sleepMin: num(r.sleep_min),
  deepMin: num(r.deep_min),
  remMin: num(r.rem_min),
  lightMin: num(r.light_min),
  awakeMin: num(r.awake_min),
  restingHr: num(r.resting_hr),
  hrvMs: num(r.hrv_ms),
  steps: num(r.steps),
  activeKcal: num(r.active_kcal),
  vo2max: num(r.vo2max),
  weight: num(r.weight),
  bodyFat: num(r.body_fat),
})

/* ─── Gym machines ─── */

export interface GymMachine {
  id: string
  label: string
  brand: string | null
  exerciseId: string
  seatSetting: string | null
  notes: string | null
}

export interface GymMachineRow {
  id: string
  label: string
  brand: string | null
  exercise_id: string
  seat_setting: string | null
  notes: string | null
}

export const toMachine = (r: GymMachineRow): GymMachine => ({
  id: r.id,
  label: r.label,
  brand: r.brand,
  exerciseId: r.exercise_id,
  seatSetting: r.seat_setting,
  notes: r.notes,
})

export const fromMachine = (m: GymMachine): GymMachineRow => ({
  id: m.id,
  label: m.label,
  brand: m.brand,
  exercise_id: m.exerciseId,
  seat_setting: m.seatSetting,
  notes: m.notes,
})
