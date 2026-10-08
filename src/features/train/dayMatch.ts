/**
 * Which past sessions count as «the same day» of a program. The link is the day id, but ids are
 * lost when a day is deleted and re-created or the program is swapped, so when no session has
 * the id we fall back to the plan: sessions whose exercises overlap the day's by at least 60 %
 * (Jaccard), preferring those with the same day name. Pure functions.
 */
import type { WorkoutFull } from '@/data/rows'

/** Minimum Jaccard overlap of exercise ids for a session without the day id to match. */
export const DAY_MATCH_MIN_OVERLAP = 0.6

/** What identifies a program day: its id, its name and its exercises. */
export interface DayKey {
  dayId: string | null
  name: string
  exerciseIds: readonly string[]
}

export interface DayMatchOptions {
  /** The session being looked from (never matches itself). */
  excludeId?: string
  /** Only sessions started strictly before this ISO time. */
  before?: string
  /** Count sessions still in progress (default: only finished ones). */
  includeUnfinished?: boolean
  /**
   * Ids of the other days of the same program: a session linked to one of them belongs to that
   * day, so it never matches this one by overlap.
   */
  otherDayIds?: ReadonlySet<string>
}

/** |A ∩ B| / |A ∪ B| of two id lists (duplicates ignored); 0 when both are empty. */
export function jaccard(a: readonly string[], b: readonly string[]): number {
  const sa = new Set(a)
  const sb = new Set(b)
  if (!sa.size && !sb.size) return 0
  let common = 0
  for (const x of sa) if (sb.has(x)) common++
  return common / (sa.size + sb.size - common)
}

const normName = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase()

/** The key of a program day. */
export const dayKeyOf = (day: {
  id: string
  name: string
  slots: readonly { exerciseId: string }[]
}): DayKey => ({ dayId: day.id, name: day.name, exerciseIds: day.slots.map((s) => s.exerciseId) })

/** The key of a session (its day id, its name and the exercises of its plan). */
export const workoutKeyOf = (w: WorkoutFull): DayKey => ({
  dayId: w.dayId,
  name: w.name,
  exerciseIds: w.plan.map((s) => s.exerciseId),
})

/**
 * Past sessions of the same day, newest first:
 * 1. those with the same day id;
 * 2. if none, those whose plan shares ≥ 60 % of the exercise ids (Jaccard) — only the ones with
 *    the same day name when any of them has it;
 * 3. a key without exercises (a free session) matches sessions without day id and the same name.
 * The session in `excludeId` and unfinished sessions (unless asked) are ignored.
 */
export function sameDayWorkouts(
  key: DayKey,
  workouts: readonly WorkoutFull[],
  opts: DayMatchOptions = {},
): WorkoutFull[] {
  const pool = workouts
    .filter(
      (w) =>
        w.id !== opts.excludeId &&
        (opts.includeUnfinished || w.endedAt) &&
        (opts.before == null || w.startedAt < opts.before),
    )
    .toSorted((a, b) => b.startedAt.localeCompare(a.startedAt))

  if (key.dayId) {
    const byId = pool.filter((w) => w.dayId === key.dayId)
    if (byId.length) return byId
  }

  const name = normName(key.name)
  if (!key.exerciseIds.length) {
    return name ? pool.filter((w) => !w.dayId && normName(w.name) === name) : []
  }

  const close = pool.filter(
    (w) =>
      !(w.dayId && opts.otherDayIds?.has(w.dayId)) &&
      jaccard(
        key.exerciseIds,
        w.plan.map((s) => s.exerciseId),
      ) >= DAY_MATCH_MIN_OVERLAP,
  )
  const named = name ? close.filter((w) => normName(w.name) === name) : []
  return named.length ? named : close
}

/** The most recent session of the same day, or null. */
export function lastSameDay(
  key: DayKey,
  workouts: readonly WorkoutFull[],
  opts: DayMatchOptions = {},
): WorkoutFull | null {
  return sameDayWorkouts(key, workouts, opts)[0] ?? null
}
