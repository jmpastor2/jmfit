/**
 * Per-exercise history derived from the logged sets: sessions, e1RM over time, current e1RM,
 * best sets for machines, main lifts and the chronological list of personal records. Pure functions (no clock).
 */
import { detectPRs, estimate1RM, isRecordEligible } from '@/domain/training'
import { STRENGTH_STANDARDS } from '@/content/standards'
import type { Equipment, Exercise, LoggedSet, PersonalRecord, Scan, Workout } from '@/domain/types'

const DAY_MS = 86_400_000
const round1 = (n: number) => Math.round(n * 10) / 10

/** e1RM of a set, warm-ups and invalid sets excluded (null). */
export function setE1rm(s: LoggedSet): number | null {
  if (!isRecordEligible(s)) return null
  const e = estimate1RM(s.weight, s.reps, s.rir)
  return e != null && e > 0 ? round1(e) : null
}

export interface ExerciseSession {
  workoutId: string
  /** Time of the first set of the exercise in that workout (or the workout start). */
  date: string
  workoutName: string | null
  /** Every set of the exercise in that workout, in order (warm-ups included). */
  sets: LoggedSet[]
  /** Best e1RM of the session, null when no set gives one. */
  bestE1rm: number | null
  /** The set that gave `bestE1rm`. */
  bestSet: LoggedSet | null
}

/** Sessions of one exercise, most recent first. */
export function exerciseSessions(
  exerciseId: string,
  sets: readonly LoggedSet[],
  workouts: readonly Pick<Workout, 'id' | 'name' | 'startedAt'>[] = [],
): ExerciseSession[] {
  const wById = new Map(workouts.map((w) => [w.id, w]))
  const groups = new Map<string, LoggedSet[]>()
  for (const s of sets) {
    if (s.exerciseId !== exerciseId) continue
    const list = groups.get(s.workoutId)
    if (list) list.push(s)
    else groups.set(s.workoutId, [s])
  }
  const out: ExerciseSession[] = []
  for (const [workoutId, list] of groups) {
    list.sort(
      // own array, built above
      (a, b) =>
        a.exerciseIndex - b.exerciseIndex ||
        a.setIndex - b.setIndex ||
        a.doneAt.localeCompare(b.doneAt),
    )
    let bestE1rm: number | null = null
    let bestSet: LoggedSet | null = null
    for (const s of list) {
      const e = setE1rm(s)
      if (e != null && (bestE1rm == null || e > bestE1rm)) {
        bestE1rm = e
        bestSet = s
      }
    }
    const w = wById.get(workoutId)
    const first = list.reduce((m, s) => (s.doneAt < m ? s.doneAt : m), list[0]!.doneAt)
    out.push({
      workoutId,
      date: w?.startedAt ?? first,
      workoutName: w?.name ?? null,
      sets: list,
      bestE1rm,
      bestSet,
    })
  }
  return out.toSorted((a, b) => b.date.localeCompare(a.date))
}

/** Points (oldest first) of the best e1RM of each session. */
export function e1rmSeries(
  sessions: readonly ExerciseSession[],
): { date: string; value: number }[] {
  return sessions
    .filter((s) => s.bestE1rm != null)
    .map((s) => ({ date: s.date, value: s.bestE1rm! }))
    .toSorted((a, b) => a.date.localeCompare(b.date))
}

/**
 * Best e1RM of an exercise over the `days` days ending at `at` (inclusive). Null when nothing in
 * that window.
 */
export function bestE1rmInWindow(
  exerciseId: string,
  sets: readonly LoggedSet[],
  at: Date,
  days = 28,
): number | null {
  const to = at.getTime()
  const from = to - days * DAY_MS
  let best: number | null = null
  for (const s of sets) {
    if (s.exerciseId !== exerciseId) continue
    const t = Date.parse(s.doneAt)
    if (!(t > from && t <= to)) continue
    const e = setE1rm(s)
    if (e != null && (best == null || e > best)) best = e
  }
  return best
}

/**
 * Current e1RM: the best of the last 4 weeks; if the exercise was not trained in that time,
 * the best of the most recent session (older, so callers should show its date).
 */
export function currentE1rm(
  exerciseId: string,
  sets: readonly LoggedSet[],
  now: Date,
): { value: number; date: string; recent: boolean } | null {
  const recent = bestE1rmInWindow(exerciseId, sets, now, 28)
  const series = e1rmSeries(exerciseSessions(exerciseId, sets))
  const last = series.at(-1)
  if (recent != null) return { value: recent, date: last?.date ?? now.toISOString(), recent: true }
  return last ? { value: last.value, date: last.date, recent: false } : null
}

/** Free weights: a 1RM estimate and the strength standards make sense here. */
const FREE_WEIGHT: ReadonlySet<Equipment> = new Set<Equipment>([
  'barbell',
  'dumbbell',
  'ez_bar',
  'smith',
])
/** Stacks, cables and lever machines: the load is machine-specific, so no 1RM nor level. */
const MACHINE: ReadonlySet<Equipment> = new Set<Equipment>(['machine', 'cable', 'plate_loaded'])

/**
 * How an exercise is tracked in the strength views: `strength` (free weights, and bodyweight
 * lifts with extra load that have a strength standard) gets 1RM and level; `machine` (machines,
 * cables, plate-loaded) gets its best set and the trend of that load; anything else (bands,
 * kettlebells, plain bodyweight, cardio) neither.
 */
export function liftKind(
  ex: Pick<Exercise, 'id' | 'equipment' | 'bodyweight'>,
): 'strength' | 'machine' | null {
  if (FREE_WEIGHT.has(ex.equipment)) return 'strength'
  if ((ex.equipment === 'bodyweight' || ex.bodyweight) && STRENGTH_STANDARDS[ex.id]) {
    return 'strength'
  }
  if (MACHINE.has(ex.equipment)) return 'machine'
  return null
}

/** Whether a 1RM estimate means something for this exercise. */
export const hasE1rm = (ex: Pick<Exercise, 'id' | 'equipment' | 'bodyweight'>) =>
  liftKind(ex) === 'strength'

export interface MainLift {
  exercise: Exercise
  /** Sessions with at least one valid work set. */
  sessions: number
}

function liftsOfKind(
  sets: readonly LoggedSet[],
  lookup: (id: string) => Exercise,
  kind: 'strength' | 'machine',
): MainLift[] {
  const sessions = new Map<string, Set<string>>()
  const kinds = new Map<string, boolean>()
  for (const s of sets) {
    const valid = kind === 'strength' ? setE1rm(s) != null : bestSetOf([s]) != null
    if (!valid) continue
    let ok = kinds.get(s.exerciseId)
    if (ok === undefined) {
      const ex = lookup(s.exerciseId)
      ok = ex.compound && liftKind(ex) === kind
      kinds.set(s.exerciseId, ok)
    }
    if (!ok) continue
    const ws = sessions.get(s.exerciseId) ?? new Set<string>()
    ws.add(s.workoutId)
    sessions.set(s.exerciseId, ws)
  }
  return [...sessions.entries()]
    .map(([id, ws]) => ({ exercise: lookup(id), sessions: ws.size }))
    .toSorted(
      (a, b) => b.sessions - a.sessions || a.exercise.name.localeCompare(b.exercise.name, 'es'),
    )
}

/**
 * Compound free-weight lifts (and weighted bodyweight lifts with a standard) with e1RM data,
 * most trained first (ties: name). Machines and cables are in `machineLifts`.
 */
export function mainLifts(
  sets: readonly LoggedSet[],
  lookup: (id: string) => Exercise,
): MainLift[] {
  return liftsOfKind(sets, lookup, 'strength')
}

/** Compound machine, cable and plate-loaded exercises with work sets, most trained first. */
export function machineLifts(
  sets: readonly LoggedSet[],
  lookup: (id: string) => Exercise,
): MainLift[] {
  return liftsOfKind(sets, lookup, 'machine')
}

/**
 * Best set by load: the heaviest weight, then the most reps at it (ties: the earliest).
 * Warm-ups and sets without weight > 0 and reps ≥ 1 are ignored.
 */
export function bestSetOf(sets: readonly LoggedSet[]): LoggedSet | null {
  let best: LoggedSet | null = null
  for (const s of sets) {
    if (!isRecordEligible(s) || !(s.weight > 0)) continue
    if (!best || s.weight > best.weight! || (s.weight === best.weight && s.reps > best.reps!)) {
      best = s
    }
  }
  return best
}

/** Points (oldest first) of the load of the best set of each session. */
export function bestSetSeries(
  sessions: readonly ExerciseSession[],
): { date: string; value: number; reps: number }[] {
  const out: { date: string; value: number; reps: number }[] = []
  for (const s of sessions) {
    const b = bestSetOf(s.sets)
    if (b) out.push({ date: s.date, value: b.weight!, reps: b.reps! })
  }
  return out.toSorted((a, b) => a.date.localeCompare(b.date))
}

/** Best set of an exercise over the `days` days ending at `at` (inclusive). */
export function bestSetInWindow(
  exerciseId: string,
  sets: readonly LoggedSet[],
  at: Date,
  days = 28,
): LoggedSet | null {
  const to = at.getTime()
  const from = to - days * DAY_MS
  return bestSetOf(
    sets.filter((s) => {
      if (s.exerciseId !== exerciseId) return false
      const t = Date.parse(s.doneAt)
      return t > from && t <= to
    }),
  )
}

/**
 * Every personal record in the history, oldest first: each set is compared with the sets of
 * the same exercise logged before it. A first-ever set is a baseline, not a record.
 */
export function prTimeline(sets: readonly LoggedSet[]): PersonalRecord[] {
  const sorted = sets
    .filter(isRecordEligible)
    .toSorted((a, b) => a.doneAt.localeCompare(b.doneAt) || a.setIndex - b.setIndex)
  const prior = new Map<string, LoggedSet[]>()
  const out: PersonalRecord[] = []
  for (const s of sorted) {
    const before = prior.get(s.exerciseId) ?? []
    out.push(...detectPRs(s, before))
    before.push(s)
    prior.set(s.exerciseId, before)
  }
  return out
}

/** Bodyweight for relative strength: the most recent of the last scan and the last logged one. */
export function latestBodyweight(
  scans: readonly Pick<Scan, 'date' | 'peso'>[],
  workouts: readonly Pick<Workout, 'startedAt' | 'bodyweight'>[],
): { value: number; date: string } | null {
  let best: { value: number; date: string } | null = null
  for (const s of scans) {
    if (s.peso != null && s.peso > 0 && (!best || s.date > best.date))
      best = { value: s.peso, date: s.date }
  }
  for (const w of workouts) {
    const d = w.startedAt.slice(0, 10)
    if (w.bodyweight != null && w.bodyweight > 0 && (!best || d > best.date)) {
      best = { value: w.bodyweight, date: d }
    }
  }
  return best
}
