/**
 * Session model: glue between the logged data and the training engine. Pure functions, so the
 * screen stays a thin view and the rules are testable.
 */
import { adjustNextSet, recommend, type HistorySession } from '@/domain/training'
import type {
  Exercise,
  LoggedSet,
  ProgramDay,
  ReadinessLevel,
  Recommendation,
  SetTarget,
  Slot,
} from '@/domain/types'
import type { WorkoutFull } from '@/data/rows'

export const newId = () => crypto.randomUUID()

/** Slots of a program day, copied with fresh ids so editing the session never edits the program. */
export function planFromDay(day: ProgramDay): Slot[] {
  return day.slots.map((s) => ({ ...s }))
}

export function slotFor(exercise: Exercise, partial: Partial<Slot> = {}): Slot {
  return {
    id: newId(),
    exerciseId: exercise.id,
    sets: exercise.compound ? 4 : 3,
    repMin: exercise.compound ? 6 : 10,
    repMax: exercise.compound ? 10 : 15,
    rir: exercise.compound ? 2 : 1,
    restSec: exercise.restSec,
    ...partial,
  }
}

/**
 * Earlier sessions of one exercise, most recent first: finished workouts only, the current one
 * excluded, each with the sets the engine looks at (warm-ups out).
 */
export function historyFor(
  exerciseId: string,
  sets: readonly LoggedSet[],
  workouts: readonly WorkoutFull[],
  currentWorkoutId: string | null,
): HistorySession[] {
  const finished = new Map(
    workouts.filter((w) => w.endedAt && w.id !== currentWorkoutId).map((w) => [w.id, w]),
  )
  const byWorkout = new Map<string, LoggedSet[]>()
  for (const s of sets) {
    if (s.exerciseId !== exerciseId || s.kind === 'warmup' || !finished.has(s.workoutId)) continue
    const list = byWorkout.get(s.workoutId)
    if (list) list.push(s)
    else byWorkout.set(s.workoutId, [s])
  }
  return [...byWorkout.entries()]
    .map(([wid, list]) => ({
      date: finished.get(wid)!.startedAt,
      sets: topSets(list.toSorted((a, b) => a.setIndex - b.setIndex)),
    }))
    .filter((h) => h.sets.length > 0)
    .sort((a, b) => b.date.localeCompare(a.date))
}

/** A set this much lighter than the heaviest of its session was a ramp-up or a drop set. */
export const TOP_SET_RATIO = 0.85

/**
 * The working sets of one session. People often ramp up (30 → 40 → 50 → 60 kg) and log every
 * step as a work set, or finish with a lighter drop set: copying that pyramid into the next
 * session (plus warm-ups on top) made no sense. Only the sets within 85 % of the heaviest load
 * count; the rest are re-labelled as warm-ups. Bodyweight sets (no load) are all kept.
 */
export function topSets(sets: readonly LoggedSet[]): LoggedSet[] {
  const max = Math.max(0, ...sets.map((s) => s.weight ?? 0))
  if (max <= 0) return [...sets]
  return sets.filter((s) => (s.weight ?? 0) >= max * TOP_SET_RATIO)
}

export interface RowState {
  target: SetTarget
  /** The set as logged, when done. */
  done: LoggedSet | null
}

export interface ExerciseBlock {
  index: number
  slot: Slot
  exercise: Exercise
  recommendation: Recommendation
  rows: RowState[]
  /** Number of done work sets / planned work sets. */
  doneWork: number
  plannedWork: number
}

/**
 * The rows of one exercise in the session: the engine's warm-ups and work targets, each paired
 * with the set logged for it, and the next pending work target adjusted to how the last work set
 * went. Sets logged beyond the plan (an extra set) are appended as rows of their own.
 */
export function buildBlock(args: {
  index: number
  slot: Slot
  exercise: Exercise
  history: HistorySession[]
  logged: readonly LoggedSet[]
  deload: boolean
  readiness: ReadinessLevel
  bodyweight: number | null
}): ExerciseBlock {
  const { index, slot, exercise, history, logged, deload, readiness, bodyweight } = args
  const recommendation = recommend({
    slot,
    exercise,
    history,
    deload,
    readiness,
    ...(bodyweight ? { bodyweight } : {}),
  })
  const mine = logged
    .filter((s) => s.exerciseIndex === index)
    .sort((a, b) => a.setIndex - b.setIndex)
  const warm = mine.filter((s) => s.kind === 'warmup')
  const work = mine.filter((s) => s.kind !== 'warmup')

  const rows: RowState[] = []
  recommendation.warmups.forEach((t, i) => rows.push({ target: t, done: warm[i] ?? null }))
  // Extra warm-ups logged beyond the suggested ramp.
  warm.slice(recommendation.warmups.length).forEach((s) =>
    rows.push({
      // Ramp-up sets marked by hand may come with no suggested ramp to copy the target from.
      target: recommendation.warmups[0]
        ? { ...recommendation.warmups[0], setIndex: s.setIndex }
        : {
            setIndex: s.setIndex,
            kind: 'warmup',
            weight: s.weight,
            repMin: s.reps ?? 0,
            repMax: s.reps ?? 0,
            rir: 5,
          },
      done: s,
    }),
  )

  let previous: LoggedSet | null = null
  const workTargets = recommendation.work
  const count = Math.max(workTargets.length, work.length)
  for (let i = 0; i < count; i++) {
    const planned = workTargets[i] ?? workTargets[workTargets.length - 1]
    let target: SetTarget = planned
      ? { ...planned, setIndex: i }
      : {
          setIndex: i,
          kind: 'work',
          weight: null,
          repMin: slot.repMin,
          repMax: slot.repMax,
          rir: slot.rir,
        }
    const done = work[i] ?? null
    // The first pending set follows from how the previous one went.
    if (!done && previous) {
      target = adjustNextSet({
        target,
        done: { weight: previous.weight, reps: previous.reps, rir: previous.rir },
        increment: exercise.increment,
      })
    }
    rows.push({ target, done })
    if (done) previous = done
    else previous = null
  }

  return {
    index,
    slot,
    exercise,
    recommendation,
    rows,
    doneWork: work.length,
    plannedWork: workTargets.length,
  }
}

/** Next set index for an exercise inside the session (warm-ups and work share one sequence). */
export function nextSetIndex(logged: readonly LoggedSet[], exerciseIndex: number): number {
  const mine = logged.filter((s) => s.exerciseIndex === exerciseIndex)
  return mine.length ? Math.max(...mine.map((s) => s.setIndex)) + 1 : 0
}

/** Work sets of one exercise done in the session, in order (for intra-session numbering). */
export function workSetsOf(logged: readonly LoggedSet[], exerciseIndex: number): LoggedSet[] {
  return logged
    .filter((s) => s.exerciseIndex === exerciseIndex && s.kind !== 'warmup')
    .sort((a, b) => a.setIndex - b.setIndex)
}

export interface QuickFill {
  /** Sets to log, in order. */
  sets: LoggedSet[]
  /** What will be logged, for the button: «3 × 60 kg × 10». */
  summary: string
  /** Copied from the last set done, or taken from the prescription. */
  source: 'last' | 'target'
}

const fmt = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',')

/**
 * The work sets still pending in a block, ready to log in one tap: the same as the last work
 * set done, or the prescription when none is done yet (it needs a weight unless the exercise
 * is bodyweight or held). Null when there is nothing left or nothing sensible to copy.
 */
export function quickFill(
  block: ExerciseBlock,
  workoutId: string,
  logged: readonly LoggedSet[],
  now: Date,
): QuickFill | null {
  const pending = block.rows.filter((r) => !r.done && r.target.kind !== 'warmup')
  if (!pending.length) return null
  const lastDone = workSetsOf(logged, block.index).at(-1) ?? null
  const ex = block.exercise
  // Each pending set: a copy of the last one done, or its own prescription (7-6-6-6 stays so).
  let values: { weight: number | null; reps: number | null; rir: number | null }[]
  let source: QuickFill['source']
  if (lastDone && lastDone.reps != null) {
    values = pending.map(() => ({
      weight: lastDone.weight,
      reps: lastDone.reps,
      rir: lastDone.rir,
    }))
    source = 'last'
  } else {
    const firstWeight = pending.find((r) => r.target.weight != null)?.target.weight ?? null
    values = pending.map((r) => ({
      weight: ex.timed ? null : (r.target.weight ?? firstWeight),
      reps: r.target.repMin,
      rir: ex.timed ? null : r.target.rir,
    }))
    source = 'target'
    if (values.some((v) => v.weight == null) && !ex.bodyweight && !ex.timed) return null
  }
  const start = nextSetIndex(logged, block.index)
  const sets = values.map((v, i) => ({
    id: newId(),
    workoutId,
    exerciseId: ex.id,
    exerciseIndex: block.index,
    setIndex: start + i,
    kind: 'work' as const,
    ...v,
    // One second apart keeps their order when sorted by time.
    doneAt: new Date(now.getTime() + i * 1000).toISOString(),
  }))
  const reps = values.map((v) => v.reps ?? 0)
  const sameReps = reps.every((r) => r === reps[0])
  const repsText = sameReps ? String(reps[0]) : reps.join('-')
  const weights = values.map((v) => v.weight)
  const w = weights[0]
  const sameWeight = weights.every((x) => x === w)
  const what = ex.timed
    ? `${repsText} s`
    : w == null || (ex.bodyweight && w === 0) || !sameWeight
      ? `${repsText} reps`
      : sameReps
        ? `${fmt(w)} kg × ${repsText}`
        : `${fmt(w)} kg (${repsText})`
  return { sets, summary: sameReps ? `${sets.length} × ${what}` : what, source }
}
