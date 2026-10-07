/**
 * Numbers behind the Progress tab: per-lift strength rows and weekly muscle volume views.
 * Pure functions: the clock comes in as `now`.
 */
import { addLocalDays, startOfLocalWeek, weeklySetsByMuscle } from '@/domain/training'
import type { Exercise, LoggedSet, Muscle } from '@/domain/types'
import { bestE1rmInWindow, e1rmSeries, exerciseSessions } from '@/features/exercise/stats'

const DAY_MS = 86_400_000

export interface StrengthRow {
  exerciseId: string
  /** Best e1RM of the last 4 weeks (null if not trained lately). */
  current: number | null
  /** Best e1RM of the 4 weeks that ended 8 weeks ago. */
  before: number | null
  /** Best e1RM ever, with its date: shown when there is nothing recent. */
  best: { value: number; date: string } | null
  /** Session bests, oldest first (last 16 sessions). */
  spark: number[]
  lastDate: string | null
}

export function strengthRow(
  exerciseId: string,
  sets: readonly LoggedSet[],
  now: Date,
): StrengthRow {
  const series = e1rmSeries(exerciseSessions(exerciseId, sets))
  const best = series.reduce<{ value: number; date: string } | null>(
    (m, p) => (!m || p.value > m.value ? { value: p.value, date: p.date } : m),
    null,
  )
  return {
    exerciseId,
    current: bestE1rmInWindow(exerciseId, sets, now, 28),
    before: bestE1rmInWindow(exerciseId, sets, new Date(now.getTime() - 56 * DAY_MS), 28),
    best,
    spark: series.slice(-16).map((p) => p.value),
    lastDate: series.at(-1)?.date ?? null,
  }
}

export type WeekView = 'this' | 'last' | 'avg4'

/**
 * Effective sets per muscle for the chosen week: this week (so far), last week, or the average
 * of the last 4 complete weeks.
 */
export function muscleSets(
  sets: LoggedSet[],
  byId: Record<string, Pick<Exercise, 'primary' | 'secondary'>>,
  now: Date,
  view: WeekView,
): Partial<Record<Muscle, number>> {
  const thisWeek = startOfLocalWeek(now)
  if (view === 'this') return weeklySetsByMuscle(sets, byId, thisWeek)
  if (view === 'last') return weeklySetsByMuscle(sets, byId, addLocalDays(thisWeek, -7))
  const sum: Partial<Record<Muscle, number>> = {}
  for (let i = 1; i <= 4; i++) {
    const w = weeklySetsByMuscle(sets, byId, addLocalDays(thisWeek, -7 * i))
    for (const [m, v] of Object.entries(w) as [Muscle, number][]) sum[m] = (sum[m] ?? 0) + v
  }
  for (const m of Object.keys(sum) as Muscle[]) sum[m] = Math.round((sum[m]! / 4) * 10) / 10
  return sum
}
