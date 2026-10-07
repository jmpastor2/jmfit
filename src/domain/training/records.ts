/**
 * Personal records. Warm-up sets never count; `work`, `failure` and `drop` sets do (a drop set
 * is still a real effort). Sets without weight or reps (or reps < 1) are ignored. Weight 0 is
 * valid (bodyweight with no extra load) but can never beat anything on load-based records.
 */
import type { LoggedSet, PersonalRecord } from '../types'
import { MAX_EFFECTIVE_REPS, estimate1RM } from './e1rm'

interface ValidSet extends LoggedSet {
  weight: number
  reps: number
}

const EPS = 1e-9

export function isRecordEligible(s: LoggedSet): s is ValidSet {
  return (
    s.kind !== 'warmup' &&
    s.weight != null &&
    Number.isFinite(s.weight) &&
    s.weight >= 0 &&
    s.reps != null &&
    Number.isFinite(s.reps) &&
    s.reps >= 1
  )
}

const round1 = (n: number) => Math.round(n * 10) / 10
const round3 = (n: number) => Math.round(n * 1000) / 1000

/** e1RM of a logged set (RIR null → 0). */
function setE1rm(s: ValidSet): number | null {
  return estimate1RM(s.weight, s.reps, s.rir)
}

export interface DetectOptions {
  /**
   * When there is no prior data to beat, still report records with `previous: null`.
   * Default false: a first-ever set is a baseline, not a PR worth celebrating.
   */
  includeFirst?: boolean
}

/**
 * Records broken by `newSet` against `prior` sets of the same exercise:
 *  - `e1rm`: higher estimated 1RM (Epley with RIR; sets beyond 15 effective reps don't count).
 *  - `weight`: heaviest load for ≥ 1 rep.
 *  - `reps`: more reps than ever at this weight **or heavier** (`atWeight` = this weight).
 * Strictly greater beats; ties don't. Prior sets of other exercises, warm-ups and the set itself
 * (same id) are ignored.
 */
export function detectPRs(
  newSet: LoggedSet,
  prior: LoggedSet[],
  opts: DetectOptions = {},
): PersonalRecord[] {
  if (!isRecordEligible(newSet)) return []
  const base = prior.filter(
    (s): s is ValidSet =>
      s.id !== newSet.id && s.exerciseId === newSet.exerciseId && isRecordEligible(s),
  )
  const first = base.length === 0
  if (first && !opts.includeFirst) return []

  const out: PersonalRecord[] = []
  const rec = (
    kind: PersonalRecord['kind'],
    value: number,
    previous: number | null,
    atWeight?: number,
  ): PersonalRecord => ({
    exerciseId: newSet.exerciseId,
    kind,
    value,
    ...(atWeight != null ? { atWeight } : {}),
    setId: newSet.id,
    date: newSet.doneAt,
    previous,
  })

  // e1RM
  const e = setE1rm(newSet)
  if (e != null && e > 0) {
    const prevE = base.reduce<number | null>((m, s) => {
      const v = setE1rm(s)
      return v == null ? m : Math.max(m ?? 0, v)
    }, null)
    if (prevE == null ? opts.includeFirst : e > prevE + EPS) {
      out.push(rec('e1rm', round1(e), prevE == null ? null : round1(prevE)))
    }
  }

  // Heaviest weight
  if (newSet.weight > 0) {
    const prevW = base.length ? Math.max(...base.map((s) => s.weight)) : null
    if (prevW == null ? opts.includeFirst : newSet.weight > prevW + EPS) {
      out.push(rec('weight', round3(newSet.weight), prevW))
    }
  }

  // Reps at this weight or heavier
  const atOrAbove = base.filter((s) => s.weight >= newSet.weight - EPS)
  const prevR = atOrAbove.length ? Math.max(...atOrAbove.map((s) => s.reps)) : null
  if (prevR == null ? opts.includeFirst : newSet.reps > prevR) {
    out.push(rec('reps', newSet.reps, prevR, newSet.weight))
  }
  return out
}

export interface SetBest {
  value: number
  setId: string
  date: string
  weight: number
  reps: number
}

export interface ExerciseBests {
  exerciseId: string
  /** Best estimated 1RM (rounded to 0.1 kg). */
  e1rm: SetBest | null
  /** Heaviest load lifted for ≥ 1 rep (0-only histories give null). */
  maxWeight: SetBest | null
  /** Best single-set volume, kg·reps. */
  bestSetVolume: SetBest | null
  /**
   * Rep-max table: for n in 1..15, the heaviest weight done for **at least** n reps.
   * Only keys with data are present.
   */
  repPRs: Record<number, number>
}

/**
 * Per-exercise bests over a set history. Ties keep the earliest set (by `doneAt`).
 * Warm-ups and invalid sets are excluded.
 */
export function bestsByExercise(sets: LoggedSet[]): Record<string, ExerciseBests> {
  const sorted = sets.filter(isRecordEligible).toSorted((a, b) => a.doneAt.localeCompare(b.doneAt))
  const out: Record<string, ExerciseBests> = {}
  for (const s of sorted) {
    const b = (out[s.exerciseId] ??= {
      exerciseId: s.exerciseId,
      e1rm: null,
      maxWeight: null,
      bestSetVolume: null,
      repPRs: {},
    })
    const ref = (value: number): SetBest => ({
      value,
      setId: s.id,
      date: s.doneAt,
      weight: s.weight,
      reps: s.reps,
    })
    const e = setE1rm(s)
    if (e != null && e > 0 && (b.e1rm == null || round1(e) > b.e1rm.value)) b.e1rm = ref(round1(e))
    if (s.weight > 0 && (b.maxWeight == null || s.weight > b.maxWeight.value + EPS)) {
      b.maxWeight = ref(s.weight)
    }
    const vol = round3(s.weight * s.reps)
    if (vol > 0 && (b.bestSetVolume == null || vol > b.bestSetVolume.value + EPS)) {
      b.bestSetVolume = ref(vol)
    }
    const upTo = Math.min(s.reps, MAX_EFFECTIVE_REPS)
    for (let n = 1; n <= upTo; n++) {
      const cur = b.repPRs[n]
      if (cur == null || s.weight > cur) b.repPRs[n] = s.weight
    }
  }
  return out
}

/**
 * Session volume records: for each exercise in `current` (one workout's sets), total kg·reps
 * compared with the best single workout of that exercise in `prior` (grouped by `workoutId`;
 * sets belonging to the current workouts are ignored there). The record points at the last set
 * of the exercise in the session. Zero volume never counts.
 */
export function sessionVolumePR(
  current: LoggedSet[],
  prior: LoggedSet[],
  opts: DetectOptions = {},
): PersonalRecord[] {
  const cur = current.filter(isRecordEligible)
  const currentWorkouts = new Set(cur.map((s) => s.workoutId))

  const best = new Map<string, number>()
  const perWorkout = new Map<string, number>()
  for (const s of prior.filter(isRecordEligible)) {
    if (currentWorkouts.has(s.workoutId)) continue
    const key = `${s.exerciseId}\u0000${s.workoutId}`
    const v = (perWorkout.get(key) ?? 0) + s.weight * s.reps
    perWorkout.set(key, v)
    best.set(s.exerciseId, Math.max(best.get(s.exerciseId) ?? 0, v))
  }

  const byEx = new Map<string, ValidSet[]>()
  for (const s of cur) byEx.set(s.exerciseId, [...(byEx.get(s.exerciseId) ?? []), s])

  const out: PersonalRecord[] = []
  for (const [exerciseId, list] of byEx) {
    const vol = round3(list.reduce((t, s) => t + s.weight * s.reps, 0))
    if (vol <= 0) continue
    const prev = best.has(exerciseId) ? round3(best.get(exerciseId) ?? 0) : null
    if (prev == null ? !opts.includeFirst : vol <= prev + EPS) continue
    const lastSet = [...list].toSorted(
      (a, b) => a.doneAt.localeCompare(b.doneAt) || a.setIndex - b.setIndex,
    )[list.length - 1]
    if (!lastSet) continue
    out.push({
      exerciseId,
      kind: 'volume',
      value: vol,
      setId: lastSet.id,
      date: lastSet.doneAt,
      previous: prev,
    })
  }
  return out
}
