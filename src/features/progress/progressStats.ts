/**
 * Numbers behind the Progress tab: per-lift strength rows and weekly muscle volume views.
 * Pure functions: the clock comes in as `now`.
 */
import { addLocalDays, startOfLocalWeek, weeklySetsByMuscle } from '@/domain/training'
import type { Exercise, LoggedSet, Muscle } from '@/domain/types'
import {
  bestE1rmInWindow,
  bestSetInWindow,
  bestSetSeries,
  e1rmSeries,
  exerciseSessions,
} from '@/features/exercise/stats'

const DAY_MS = 86_400_000

/**
 * What the current figure is compared with: the same window 8 weeks back or, while the history
 * is shorter than that, the first session (`since` holds its date). Nothing with one session.
 */
function baseline(
  eightWeeksAgo: number | null,
  series: readonly { value: number; date: string }[],
): { before: number | null; since: string | null } {
  if (eightWeeksAgo != null) return { before: eightWeeksAgo, since: null }
  const first = series[0]
  return series.length >= 2 && first
    ? { before: first.value, since: first.date }
    : { before: null, since: null }
}

export interface StrengthRow {
  exerciseId: string
  /** Best e1RM of the last 4 weeks (null if not trained lately). */
  current: number | null
  /** Best e1RM of the 4 weeks that ended 8 weeks ago, or of the first session (see `since`). */
  before: number | null
  /** Date of the first session when that is the comparison (history under 8 weeks). */
  since: string | null
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
    ...baseline(
      bestE1rmInWindow(exerciseId, sets, new Date(now.getTime() - 56 * DAY_MS), 28),
      series,
    ),
    best,
    spark: series.slice(-16).map((p) => p.value),
    lastDate: series.at(-1)?.date ?? null,
  }
}

export interface MachineRow {
  exerciseId: string
  /** Best set (heaviest load, then most reps) of the last 4 weeks. */
  current: { weight: number; reps: number } | null
  /** Load of the best set of the 4 weeks that ended 8 weeks ago, or of the first session. */
  before: number | null
  /** Date of the first session when that is the comparison (history under 8 weeks). */
  since: string | null
  /** Best set ever, with its date: shown when there is nothing recent. */
  best: { weight: number; reps: number; date: string } | null
  /** Load of the best set of each session, oldest first (last 16 sessions). */
  spark: number[]
  lastDate: string | null
}

/** Machines and cables: best set (weight × reps) and the trend of that load, no 1RM. */
export function machineRow(exerciseId: string, sets: readonly LoggedSet[], now: Date): MachineRow {
  const series = bestSetSeries(exerciseSessions(exerciseId, sets))
  let best: MachineRow['best'] = null
  for (const p of series) {
    if (!best || p.value > best.weight || (p.value === best.weight && p.reps > best.reps)) {
      best = { weight: p.value, reps: p.reps, date: p.date }
    }
  }
  const cur = bestSetInWindow(exerciseId, sets, now, 28)
  const before = bestSetInWindow(exerciseId, sets, new Date(now.getTime() - 56 * DAY_MS), 28)
  return {
    exerciseId,
    current: cur ? { weight: cur.weight!, reps: cur.reps! } : null,
    ...baseline(before?.weight ?? null, series),
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
