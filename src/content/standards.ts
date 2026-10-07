/**
 * Strength standards as 1RM / bodyweight ratios.
 *
 * Source: Strength Level (strengthlevel.com/strength-standards/<lift>/kg), "bodyweight ratio"
 * tables, read 2026-10-07:
 *   squat, bench-press, deadlift, military-press, bent-over-row.
 * Strength Level defines Beginner ≈ stronger than 5 % of lifters, Novice 20 %, Intermediate 50 %,
 * Advanced 80 %, Elite 95 %.
 *
 * Pull-ups: Strength Level only publishes weighted pull-up standards as added kg per bodyweight
 * band (strengthlevel.com/strength-standards/pull-ups/kg). We convert them to total-load ratios
 * ((bodyweight + added) / bodyweight) at the reference bodyweights of 80 kg (men) and 60 kg
 * (women). Men @80 kg: −2, +14, +33, +54, +75 kg. Women @60 kg: −16, −4, +9, +23, +38 kg.
 */

export type Sex = 'male' | 'female'
export type StrengthLevel = 'beginner' | 'novice' | 'intermediate' | 'advanced' | 'elite'

export const STRENGTH_LEVELS: readonly StrengthLevel[] = [
  'beginner',
  'novice',
  'intermediate',
  'advanced',
  'elite',
]

export const STRENGTH_LEVEL_LABEL: Record<StrengthLevel, string> = {
  beginner: 'Principiante',
  novice: 'Novato',
  intermediate: 'Intermedio',
  advanced: 'Avanzado',
  elite: 'Élite',
}

/** Ratios in STRENGTH_LEVELS order. */
type Ratios = readonly [number, number, number, number, number]

interface Standard {
  male: Ratios
  female: Ratios
  /** Bodyweight exercise: the e1rm passed in is the added load (lastre), bodyweight is added. */
  bodyweight?: true
}

const r2 = (x: number) => Math.round(x * 100) / 100
const pullUp = (bw: number, added: Ratios): Ratios =>
  added.map((a) => r2((bw + a) / bw)) as unknown as Ratios

export const STRENGTH_STANDARDS: Record<string, Standard> = {
  squat: { male: [0.75, 1.25, 1.75, 2.25, 2.75], female: [0.5, 0.75, 1.25, 1.75, 2.25] },
  'bench-press': { male: [0.5, 1.0, 1.25, 1.5, 2.0], female: [0.3, 0.5, 0.75, 1.1, 1.45] },
  deadlift: { male: [1.0, 1.5, 2.0, 2.5, 3.25], female: [0.75, 1.0, 1.5, 2.0, 2.5] },
  'overhead-press': { male: [0.4, 0.55, 0.8, 1.05, 1.3], female: [0.25, 0.35, 0.5, 0.7, 0.9] },
  'barbell-row': { male: [0.5, 0.75, 1.0, 1.5, 1.75], female: [0.3, 0.45, 0.7, 0.95, 1.25] },
  'pull-up': {
    male: pullUp(80, [-2, 14, 33, 54, 75]),
    female: pullUp(60, [-16, -4, 9, 23, 38]),
    bodyweight: true,
  },
}

export interface StrengthResult {
  /** Highest level reached; lifts below the beginner threshold still count as beginner. */
  level: StrengthLevel
  /** Total load / bodyweight. */
  ratio: number
  /** Next level and the e1rm (same units as the input: added load for bodyweight lifts). */
  next: { level: StrengthLevel; ratio: number; e1rm: number } | null
  /** 0–1 progress from the current threshold to the next one. */
  progress: number
}

/**
 * Classify an estimated 1RM. For bodyweight lifts (pull-ups) `e1rm` is the added load in kg
 * (negative = assistance). Returns null for exercises without a standard or invalid input.
 */
export function strengthLevel(
  exerciseId: string,
  e1rm: number,
  bodyweight: number,
  sex: Sex,
): StrengthResult | null {
  const std = STRENGTH_STANDARDS[exerciseId]
  if (!std || !(bodyweight > 0) || !Number.isFinite(e1rm)) return null
  const ratios = std[sex]
  const total = std.bodyweight ? e1rm + bodyweight : e1rm
  const ratio = total / bodyweight

  let idx = 0
  for (let i = 0; i < ratios.length; i++) if (ratio >= ratios[i]!) idx = i
  const level = STRENGTH_LEVELS[idx]!
  const nextIdx = ratio >= ratios[idx]! ? idx + 1 : idx
  const nextRatio = ratios[nextIdx]
  const nextLevel = STRENGTH_LEVELS[nextIdx]

  if (nextRatio === undefined || nextLevel === undefined) {
    return { level, ratio: r2(ratio), next: null, progress: 1 }
  }
  const from = nextIdx === idx ? 0 : ratios[idx]!
  const progress = Math.max(0, Math.min(1, (ratio - from) / (nextRatio - from)))
  const nextTotal = nextRatio * bodyweight
  return {
    level,
    ratio: r2(ratio),
    next: {
      level: nextLevel,
      ratio: nextRatio,
      e1rm: Math.round((std.bodyweight ? nextTotal - bodyweight : nextTotal) * 10) / 10,
    },
    progress,
  }
}
