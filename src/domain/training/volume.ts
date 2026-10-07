/**
 * Training volume: effective sets per muscle, tonnage, weekly trend and training-day strips.
 *
 * Time zone: weeks are Monday 00:00 → next Monday 00:00 and days are midnight to midnight in the
 * **local time zone of the runtime** (the user's phone), using `Date`'s local getters/setters, so
 * DST changes are handled by the platform (a week can be 167 or 169 hours long). Timestamps in
 * `LoggedSet.doneAt` / `Workout.startedAt` are ISO strings (UTC or with offset) and are converted
 * to local time before bucketing: a set done Monday 00:30 in Spain (Sunday 22:30 UTC in summer)
 * belongs to the new week.
 */
import type { Exercise, LoggedSet, Muscle, SetKind, Workout } from '../types'

/** Set kinds that count as effective (hard) sets. */
export const EFFECTIVE_KINDS: ReadonlySet<SetKind> = new Set<SetKind>(['work', 'failure', 'drop'])
/** Sets logged with more reps in reserve than this are not counted as effective. */
export const MAX_EFFECTIVE_RIR = 4
/** Weight of a set for a secondary muscle. */
export const SECONDARY_FACTOR = 0.5

/** True for sets that count towards weekly volume: hard kinds, reps ≥ 1, RIR ≤ 4 or unknown. */
export function isEffectiveSet(s: LoggedSet): boolean {
  if (!EFFECTIVE_KINDS.has(s.kind)) return false
  if (s.reps == null || !(s.reps >= 1)) return false
  return s.rir == null || s.rir <= MAX_EFFECTIVE_RIR
}

/** Local midnight of the given instant's day. */
export function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** Local Monday 00:00 of the week containing `d`. */
export function startOfLocalWeek(d: Date): Date {
  const day = startOfLocalDay(d)
  const offset = (day.getDay() + 6) % 7 // Monday = 0 … Sunday = 6
  return addLocalDays(day, -offset)
}

/** Calendar-day arithmetic in local time (DST-safe, unlike adding 86 400 000 ms). */
export function addLocalDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days, d.getHours(), d.getMinutes())
}

/** "YYYY-MM-DD" of the local day. */
export function localDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function inRange(iso: string, from: Date, to: Date): boolean {
  const t = new Date(iso).getTime()
  return Number.isFinite(t) && t >= from.getTime() && t < to.getTime()
}

/**
 * Effective sets per muscle in the week starting at `weekStart` (inclusive) and ending 7 local
 * days later (exclusive). `weekStart` is normalised to its local Monday 00:00, so any instant in
 * the week works. Primary muscles get 1 per set, secondary 0.5 (a muscle listed in both counts
 * as primary only). Sets of unknown exercises are skipped. Muscles with no sets are absent.
 */
export function weeklySetsByMuscle(
  sets: LoggedSet[],
  exercisesById: Record<string, Pick<Exercise, 'primary' | 'secondary'>>,
  weekStart: Date,
): Partial<Record<Muscle, number>> {
  const from = startOfLocalWeek(weekStart)
  const to = addLocalDays(from, 7)
  const out: Partial<Record<Muscle, number>> = {}
  for (const s of sets) {
    if (!isEffectiveSet(s) || !inRange(s.doneAt, from, to)) continue
    const ex = exercisesById[s.exerciseId]
    if (!ex) continue
    const primary = new Set(ex.primary)
    for (const m of primary) out[m] = (out[m] ?? 0) + 1
    for (const m of new Set(ex.secondary)) {
      if (!primary.has(m)) out[m] = (out[m] ?? 0) + SECONDARY_FACTOR
    }
  }
  return out
}

export interface TonnageOptions {
  /** User bodyweight in kg, added to the load of bodyweight exercises. */
  bodyweight?: number | null
  /** Needed to know which exercises are bodyweight ones. */
  exercisesById?: Record<string, Pick<Exercise, 'bodyweight'>>
}

/**
 * Tonnage (kg·reps) of the non-warm-up sets. For bodyweight exercises the logged weight is extra
 * load (lastre, null = 0) and `bodyweight` is added when both it and `exercisesById` are given;
 * otherwise only the lastre counts. Sets without reps add nothing.
 */
export function tonnage(sets: LoggedSet[], opts: TonnageOptions = {}): number {
  let total = 0
  for (const s of sets) {
    if (s.kind === 'warmup' || s.reps == null || !(s.reps > 0)) continue
    const isBw = Boolean(opts.exercisesById?.[s.exerciseId]?.bodyweight)
    const load = (s.weight ?? 0) + (isBw && opts.bodyweight ? opts.bodyweight : 0)
    if (!Number.isFinite(load) || load <= 0) continue
    total += load * s.reps
  }
  return Math.round(total * 100) / 100
}

export interface WeekPoint {
  /** Local Monday, "YYYY-MM-DD". */
  weekStart: string
  /** Effective sets (see {@link isEffectiveSet}). */
  sets: number
  tonnage: number
}

/**
 * The last `weeks` Monday–Sunday weeks, oldest first, the current (partial) week last.
 */
export function weeklyTrend(
  sets: LoggedSet[],
  weeks: number,
  now: Date,
  opts: TonnageOptions = {},
): WeekPoint[] {
  const n = Math.max(0, Math.floor(weeks))
  const current = startOfLocalWeek(now)
  const out: WeekPoint[] = []
  for (let i = n - 1; i >= 0; i--) {
    const from = addLocalDays(current, -7 * i)
    const to = addLocalDays(from, 7)
    const inWeek = sets.filter((s) => inRange(s.doneAt, from, to))
    out.push({
      weekStart: localDateKey(from),
      sets: inWeek.filter(isEffectiveSet).length,
      tonnage: tonnage(inWeek, opts),
    })
  }
  return out
}

/**
 * One boolean per local day for the last `days` days, oldest first, today last: true when a
 * workout started that day.
 */
export function trainingDays(
  workouts: Pick<Workout, 'startedAt'>[],
  days: number,
  now: Date,
): boolean[] {
  const n = Math.max(0, Math.floor(days))
  const trained = new Set<string>()
  for (const w of workouts) {
    const d = new Date(w.startedAt)
    if (Number.isFinite(d.getTime())) trained.add(localDateKey(d))
  }
  const today = startOfLocalDay(now)
  return Array.from({ length: n }, (_, i) =>
    trained.has(localDateKey(addLocalDays(today, i - n + 1))),
  )
}
