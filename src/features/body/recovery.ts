/**
 * Recovery trends: last 30 days of one wearable/check-in measure, with the 7-day mean compared
 * to the 28-day mean. Pure: the reference day is passed in.
 */
import { addLocalDays, localDateKey } from '@/domain/training'
import type { HealthDay } from '@/domain/types'

export type RecoveryMetric = 'sleepMin' | 'restingHr' | 'hrvMs' | 'steps'

export const RECOVERY_DEFS: Record<
  RecoveryMetric,
  { label: string; unit: string; good: 'up' | 'down'; decimals: number }
> = {
  sleepMin: { label: 'Sueño', unit: 'h', good: 'up', decimals: 1 },
  restingHr: { label: 'FC en reposo', unit: 'lpm', good: 'down', decimals: 0 },
  hrvMs: { label: 'HRV', unit: 'ms', good: 'up', decimals: 0 },
  steps: { label: 'Pasos', unit: 'pasos', good: 'up', decimals: 0 },
}

export interface RecoveryStats {
  points: { x: string; y: number }[]
  mean7: number | null
  mean28: number | null
  /** Days with a value inside the 7- and 28-day windows. */
  n7: number
  n28: number
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

/** Value as shown: sleep in hours, the rest as stored. */
export function recoveryValue(d: HealthDay, metric: RecoveryMetric): number | null {
  const v = d[metric]
  if (v === null || v === undefined) return null
  return metric === 'sleepMin' ? v / 60 : v
}

export function recoveryStats(
  days: readonly HealthDay[],
  metric: RecoveryMetric,
  today: Date,
): RecoveryStats {
  const from30 = localDateKey(addLocalDays(today, -29))
  const from28 = localDateKey(addLocalDays(today, -27))
  const from7 = localDateKey(addLocalDays(today, -6))
  const to = localDateKey(today)
  const points: { x: string; y: number }[] = []
  const w7: number[] = []
  const w28: number[] = []
  for (const d of days) {
    if (d.date < from30 || d.date > to) continue
    const v = recoveryValue(d, metric)
    if (v === null) continue
    points.push({ x: d.date, y: v })
    if (d.date >= from28) w28.push(v)
    if (d.date >= from7) w7.push(v)
  }
  points.sort((a, b) => a.x.localeCompare(b.x))
  return { points, mean7: mean(w7), mean28: mean(w28), n7: w7.length, n28: w28.length }
}

/** Good or bad news when the 7-day mean moves away from the 28-day one by more than 3 %. */
export function trendTone(metric: RecoveryMetric, s: RecoveryStats): 'good' | 'bad' | 'neutral' {
  if (s.mean7 === null || s.mean28 === null || s.mean28 === 0 || s.n7 < 3) return 'neutral'
  const rel = (s.mean7 - s.mean28) / Math.abs(s.mean28)
  if (Math.abs(rel) < 0.03) return 'neutral'
  return rel > 0 === (RECOVERY_DEFS[metric].good === 'up') ? 'good' : 'bad'
}
