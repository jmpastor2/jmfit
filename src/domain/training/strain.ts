/**
 * Daily strain and sleep, the way WHOOP and Bevel show them, from what the band records.
 * Pure functions.
 *
 * Strain (0–21) is the day's cardiovascular and muscular load:
 * - each session the band recorded scores Banister's TRIMP, minutes × HRr × 0.64·e^(1.92·HRr),
 *   where HRr is the average heart rate within the reserve between resting and maximum;
 * - each effective set logged in Forja adds load the heart rate of lifting does not show;
 * - steps beyond a sedentary day add a little.
 * The total maps onto 0–21 with a saturating curve: going from 18 to 19 costs far more than
 * from 4 to 5. A 60-minute football match at 165 bpm lands near 15; an hour of weights with
 * twenty hard sets near 9.
 *
 * Sleep is scored against what the body needed: a base need, plus extra after a hard day.
 */

/** Load per effective set: lifting tires far more than its average heart rate says. */
export const SET_LOAD = 2.5
/** Steps a sedentary day already has; only those beyond count. */
export const BASE_STEPS = 3000
/** Load per thousand steps beyond the base. */
export const STEP_LOAD = 2
/** Load that reaches 63 % of the scale (21 × (1 − 1/e) ≈ 13.3). */
export const STRAIN_SCALE = 120
export const STRAIN_MAX = 21

/** Maximum heart rate from age (Tanaka: 208 − 0.7 × age). */
export const maxHeartRate = (age: number) => Math.round(208 - 0.7 * age)

/** Banister TRIMP of one session; null without the numbers it needs. */
export function trimp(
  minutes: number | null,
  avgHr: number | null,
  restingHr: number,
  maxHr: number,
): number | null {
  if (!minutes || !avgHr || maxHr <= restingHr) return null
  const hrr = Math.min(1, Math.max(0, (avgHr - restingHr) / (maxHr - restingHr)))
  return minutes * hrr * 0.64 * Math.exp(1.92 * hrr)
}

export const strainFromLoad = (load: number) =>
  Math.round(STRAIN_MAX * (1 - Math.exp(-Math.max(0, load) / STRAIN_SCALE)) * 10) / 10

export interface StrainPart {
  label: string
  load: number
}

export interface DayStrain {
  strain: number
  parts: StrainPart[]
}

/** The strain of one day from its sessions, sets and steps. */
export function dayStrain(input: {
  sessions: readonly { label: string; minutes: number | null; avgHr: number | null }[]
  effectiveSets: number
  steps: number | null
  restingHr: number
  maxHr: number
}): DayStrain {
  const parts: StrainPart[] = []
  for (const s of input.sessions) {
    const t = trimp(s.minutes, s.avgHr, input.restingHr, input.maxHr)
    if (t) parts.push({ label: s.label, load: t })
  }
  if (input.effectiveSets > 0)
    parts.push({
      label: `${input.effectiveSets} series efectivas`,
      load: input.effectiveSets * SET_LOAD,
    })
  if (input.steps && input.steps > BASE_STEPS)
    parts.push({
      label: `${Math.round(input.steps / 100) / 10}k pasos`,
      load: ((input.steps - BASE_STEPS) / 1000) * STEP_LOAD,
    })
  const load = parts.reduce((a, p) => a + p.load, 0)
  return { strain: strainFromLoad(load), parts: parts.toSorted((a, b) => b.load - a.load) }
}

/**
 * The strain to aim for given the recovery (0–100): build when recovered, hold when not.
 * The bands follow WHOOP's guidance (green, yellow, red).
 */
export function strainTarget(recovery: number | null): { min: number; max: number } | null {
  if (recovery == null) return null
  if (recovery >= 67) return { min: 14, max: 18 }
  if (recovery >= 34) return { min: 10, max: 14 }
  return { min: 4, max: 10 }
}

/** Sleep a body needs: 7.5 h, plus up to an hour after a hard day. */
export const BASE_SLEEP_NEED_MIN = 450

export function sleepNeedMin(prevStrain: number | null): number {
  const extra = prevStrain != null ? Math.max(0, prevStrain - 10) * 6 : 0
  return Math.round(BASE_SLEEP_NEED_MIN + Math.min(60, extra))
}

/** Hours slept against the need, 0–100. */
export function sleepPerformance(sleepMin: number | null, needMin: number): number | null {
  if (sleepMin == null || needMin <= 0) return null
  return Math.min(100, Math.round((sleepMin / needMin) * 100))
}

/** Under this the night was probably not recorded in full (the band was off part of it). */
export const PARTIAL_NIGHT_MIN = 240
