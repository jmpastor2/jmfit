/**
 * Session summary: totals, comparison with the last time the same program day was done, the
 * records broken and the effective sets each muscle got. Pure functions.
 */
import type { WorkoutFull } from '@/data/rows'
import {
  SECONDARY_FACTOR,
  detectPRs,
  estimate1RM,
  isEffectiveSet,
  sessionVolumePR,
  tonnage,
  type TonnageOptions,
} from '@/domain/training'
import type { Exercise, LoggedSet, Muscle, PersonalRecord } from '@/domain/types'
import { lastSameDay, workoutKeyOf } from '@/features/train/dayMatch'
import { PR_RANK } from '@/features/train/history'

export interface SessionTotals {
  /** Work sets (everything but warm-ups). */
  sets: number
  reps: number
  tonnage: number
}

export function sessionTotals(
  sets: readonly LoggedSet[],
  opts: TonnageOptions = {},
): SessionTotals {
  const work = sets.filter((s) => s.kind !== 'warmup')
  return {
    sets: work.length,
    reps: work.reduce((t, s) => t + (s.reps != null && s.reps > 0 ? s.reps : 0), 0),
    tonnage: tonnage([...work], opts),
  }
}

/**
 * The last finished workout before `workout` of the same program day: same day id or, when the
 * day was re-created or the program changed, a similar plan (see `sameDayWorkouts`). Without a
 * plan, the last one with the same name. Null when there is none.
 */
export function previousSameDay(
  workout: WorkoutFull,
  workouts: readonly WorkoutFull[],
): WorkoutFull | null {
  return lastSameDay(workoutKeyOf(workout), workouts, {
    excludeId: workout.id,
    before: workout.startedAt,
  })
}

/**
 * Records broken in a session: every set against everything done before it (other sessions and
 * earlier sets of this one), plus session-volume records. One entry per exercise and kind, the
 * best value of the session. Ordered by exercise position, then by kind.
 */
export function sessionRecords(
  sessionSets: readonly LoggedSet[],
  allSets: readonly LoggedSet[],
): PersonalRecord[] {
  const ids = new Set(sessionSets.map((s) => s.id))
  const order = new Map<string, number>()
  for (const s of sessionSets) {
    const cur = order.get(s.exerciseId)
    if (cur == null || s.exerciseIndex < cur) order.set(s.exerciseId, s.exerciseIndex)
  }
  const sorted = sessionSets.toSorted(
    (a, b) => a.doneAt.localeCompare(b.doneAt) || a.setIndex - b.setIndex,
  )
  const before = allSets.filter((s) => !ids.has(s.id))
  const best = new Map<string, PersonalRecord>()
  const keep = (pr: PersonalRecord) => {
    const key = `${pr.exerciseId}\u0000${pr.kind}`
    const cur = best.get(key)
    if (!cur || pr.value > cur.value) {
      // The baseline is what stood before the session, not an earlier set of it.
      best.set(key, cur ? { ...pr, previous: cur.previous } : pr)
    }
  }
  sorted.forEach((s, i) => {
    if (s.kind === 'warmup') return
    const prior = [
      ...before.filter((p) => p.exerciseId === s.exerciseId && p.doneAt < s.doneAt),
      ...sorted.slice(0, i).filter((p) => p.exerciseId === s.exerciseId),
    ]
    for (const pr of detectPRs(s, prior)) keep(pr)
  })
  const start = sorted[0]?.doneAt
  if (start) {
    const earlier = before.filter((p) => p.doneAt < start)
    for (const pr of sessionVolumePR([...sessionSets], earlier)) keep(pr)
  }
  return [...best.values()].toSorted(
    (a, b) =>
      (order.get(a.exerciseId) ?? 0) - (order.get(b.exerciseId) ?? 0) ||
      PR_RANK[a.kind] - PR_RANK[b.kind],
  )
}

/**
 * Effective sets per muscle in the session: 1 for each primary muscle, 0.5 for each secondary
 * one (a muscle in both counts as primary). Sorted from most to least.
 */
export function sessionMuscleSets(
  sets: readonly LoggedSet[],
  lookup: (id: string) => Pick<Exercise, 'primary' | 'secondary'>,
): { muscle: Muscle; sets: number }[] {
  const out = new Map<Muscle, number>()
  for (const s of sets) {
    if (!isEffectiveSet(s)) continue
    const ex = lookup(s.exerciseId)
    const primary = new Set(ex.primary)
    for (const m of primary) out.set(m, (out.get(m) ?? 0) + 1)
    for (const m of new Set(ex.secondary)) {
      if (!primary.has(m)) out.set(m, (out.get(m) ?? 0) + SECONDARY_FACTOR)
    }
  }
  return [...out.entries()]
    .map(([muscle, n]) => ({ muscle, sets: n }))
    .toSorted((a, b) => b.sets - a.sets)
}

/** Direction and tone of a change where more is better. */
export function changeOf(
  cur: number,
  prev: number,
): {
  direction: 'up' | 'down' | 'flat'
  tone: 'good' | 'bad' | 'neutral'
  diff: number
} {
  const diff = Math.round((cur - prev) * 100) / 100
  if (diff > 0) return { direction: 'up', tone: 'good', diff }
  if (diff < 0) return { direction: 'down', tone: 'bad', diff }
  return { direction: 'flat', tone: 'neutral', diff: 0 }
}

export interface ExerciseProgress {
  exerciseId: string
  today: { weight: number | null; reps: number }
  /** Best set of the last earlier session with this exercise, any program day. */
  before: { weight: number | null; reps: number; date: string } | null
  /** Better, equal (within 1 %) or worse than that best set. */
  trend: 'up' | 'flat' | 'down' | null
}

/** A set's performance: its 1RM (reps only, without RIR, so it measures what was lifted). */
const score = (s: Pick<LoggedSet, 'weight' | 'reps'>, loaded: boolean) =>
  loaded ? (estimate1RM(s.weight, s.reps, 0) ?? 0) : (s.reps ?? 0)

function bestSet(sets: readonly LoggedSet[], loaded: boolean): LoggedSet | null {
  let best: LoggedSet | null = null
  for (const s of sets) {
    if (s.kind === 'warmup' || !s.reps || s.reps < 1) continue
    if (!best || score(s, loaded) > score(best, loaded)) best = s
  }
  return best
}

/**
 * Exercise by exercise: the best set of this session against the best set of the last time the
 * exercise was done (whatever the day). The progression that matters for hypertrophy is there,
 * more than in the session's totals. Bodyweight exercises compare reps.
 */
export function exerciseProgress(
  sessionSets: readonly LoggedSet[],
  allSets: readonly LoggedSet[],
): ExerciseProgress[] {
  const workoutId = sessionSets[0]?.workoutId
  const start = sessionSets.reduce<string | null>(
    (m, s) => (m == null || s.doneAt < m ? s.doneAt : m),
    null,
  )
  const order = new Map<string, number>()
  for (const s of sessionSets) {
    if (s.kind === 'warmup') continue
    const cur = order.get(s.exerciseId)
    if (cur == null || s.exerciseIndex < cur) order.set(s.exerciseId, s.exerciseIndex)
  }
  const out: ExerciseProgress[] = []
  for (const id of [...order.keys()].toSorted((a, b) => order.get(a)! - order.get(b)!)) {
    const mine = sessionSets.filter((s) => s.exerciseId === id)
    const earlier = allSets.filter(
      (s) => s.exerciseId === id && s.workoutId !== workoutId && start != null && s.doneAt < start,
    )
    const lastWorkout = earlier.reduce<LoggedSet | null>(
      (m, s) => (s.kind !== 'warmup' && (!m || s.doneAt > m.doneAt) ? s : m),
      null,
    )?.workoutId
    const prevSets = earlier.filter((s) => s.workoutId === lastWorkout)
    const loaded = [...mine, ...prevSets].some((s) => s.kind !== 'warmup' && (s.weight ?? 0) > 0)
    const today = bestSet(mine, loaded)
    if (!today) continue
    const prev = bestSet(prevSets, loaded)
    let trend: ExerciseProgress['trend'] = null
    if (prev) {
      const a = score(today, loaded)
      const b = score(prev, loaded)
      trend = a > b * 1.01 ? 'up' : a < b * 0.99 ? 'down' : 'flat'
    }
    out.push({
      exerciseId: id,
      today: { weight: today.weight, reps: today.reps! },
      before: prev ? { weight: prev.weight, reps: prev.reps!, date: prev.doneAt } : null,
      trend,
    })
  }
  return out
}
