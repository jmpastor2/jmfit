/**
 * Fitness markers from the band, each with a reference that is not ours: the WHO's weekly
 * active minutes, the acute:chronic load ratio of sports science, and VO₂ max levels by age
 * (ACSM). Pure functions.
 */
import type { ZoneMinutes } from '@/domain/types'
import type { DayState } from './state'

/** WHO: at least 150 minutes a week of moderate activity (vigorous counts double). */
export const WHO_ACTIVE_MIN = 150

/** Moderate minutes plus twice the vigorous and peak ones, the WHO's equivalence. */
export function activeMinutes(zones: ZoneMinutes | null | undefined): number {
  if (!zones) return 0
  return (zones.moderate ?? 0) + 2 * ((zones.vigorous ?? 0) + (zones.peak ?? 0))
}

/** Active minutes of the last seven days (null without any zone data in them). */
export function weekActiveMinutes(states: readonly DayState[]): number | null {
  const week = states.slice(-7)
  if (!week.some((s) => s.zones)) return null
  return week.reduce((a, s) => a + activeMinutes(s.zones), 0)
}

export interface LoadBalance {
  /** Average strain of the last 7 days over that of the last 28. */
  ratio: number
  zone: 'low' | 'optimal' | 'high' | 'danger'
}

/**
 * Acute:chronic workload ratio (Gabbett): 0.8–1.3 builds fitness with the lowest injury risk;
 * above 1.5 the load is rising faster than the body has adapted to; under 0.8 fitness fades.
 * Needs four weeks.
 */
export function loadBalance(states: readonly DayState[]): LoadBalance | null {
  if (states.length < 28) return null
  const avg = (xs: readonly DayState[]) => xs.reduce((a, s) => a + s.strain, 0) / xs.length
  const chronic = avg(states.slice(-28))
  if (chronic <= 0) return null
  const ratio = Math.round((avg(states.slice(-7)) / chronic) * 100) / 100
  const zone = ratio < 0.8 ? 'low' : ratio <= 1.3 ? 'optimal' : ratio <= 1.5 ? 'high' : 'danger'
  return { ratio, zone }
}

/** ACSM VO₂ max levels (ml/kg/min), lower bounds by age band and sex. */
const VO2_BANDS: Record<'M' | 'F', { upTo: number; bounds: [number, number, number, number] }[]> = {
  M: [
    { upTo: 29, bounds: [38, 43, 49, 54] },
    { upTo: 39, bounds: [35, 41, 46, 51] },
    { upTo: 49, bounds: [33, 38, 43, 48] },
    { upTo: 59, bounds: [30, 35, 40, 45] },
    { upTo: 200, bounds: [26, 31, 36, 41] },
  ],
  F: [
    { upTo: 29, bounds: [31, 36, 41, 46] },
    { upTo: 39, bounds: [29, 34, 39, 44] },
    { upTo: 49, bounds: [27, 32, 37, 42] },
    { upTo: 59, bounds: [24, 29, 33, 37] },
    { upTo: 200, bounds: [22, 26, 30, 34] },
  ],
}
export const VO2_LEVELS = ['Bajo', 'Justo', 'Bueno', 'Excelente', 'Superior'] as const

/** Level of a VO₂ max for an age and sex, with the value to reach the next one. */
export function vo2Level(
  vo2: number,
  age: number,
  sex: 'M' | 'F',
): { level: (typeof VO2_LEVELS)[number]; next: number | null } {
  const { bounds } = VO2_BANDS[sex].find((b) => age <= b.upTo)!
  const i = bounds.filter((b) => vo2 >= b).length
  return { level: VO2_LEVELS[i]!, next: bounds[i] ?? null }
}
