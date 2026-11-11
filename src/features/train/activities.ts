/**
 * Sessions the band recorded outside Forja (football, a swim, padel…) and what they load.
 * Pure functions.
 *
 * Walks are left out: they are daily life, not training. A strength session the band recorded
 * at the time of a Forja session is that same session: it is not counted twice.
 */
import type { WorkoutFull } from '@/data/rows'
import type { HealthWorkout, Muscle } from '@/domain/types'

const STRENGTH = new Set(['STRENGTH_TRAINING', 'WEIGHTLIFTING', 'WEIGHTS'])
const NOT_TRAINING = new Set(['WALKING'])

/** Muscles a sport leaves tired: enough to not train them hard the next day. */
export const ACTIVITY_MUSCLES: Readonly<Record<string, readonly Muscle[]>> = {
  SOCCER: ['quads', 'hamstrings', 'glutes', 'calves'],
  RUNNING: ['quads', 'hamstrings', 'calves'],
  HIKING: ['quads', 'glutes', 'calves'],
  CYCLING: ['quads', 'glutes'],
  BASKETBALL: ['quads', 'calves'],
  SWIMMING: ['back', 'side_delts', 'front_delts'],
  RACKET_SPORTS: ['front_delts', 'side_delts'],
  TENNIS: ['front_delts', 'side_delts'],
}

/** Minutes either side of a Forja session within which a band strength session is that one. */
const SAME_SESSION_MIN = 45

export function otherActivities(
  health: readonly HealthWorkout[],
  workouts: readonly Pick<WorkoutFull, 'startedAt' | 'endedAt'>[],
): HealthWorkout[] {
  const spans = workouts.map((w) => {
    const start = Date.parse(w.startedAt)
    const end = w.endedAt ? Date.parse(w.endedAt) : start + 2 * 3_600_000
    return [start - SAME_SESSION_MIN * 60_000, end + SAME_SESSION_MIN * 60_000] as const
  })
  return health
    .filter((h) => !NOT_TRAINING.has(h.activity))
    .filter((h) => {
      if (!STRENGTH.has(h.activity)) return true
      const t = Date.parse(h.startedAt)
      return !spans.some(([a, b]) => t >= a && t <= b)
    })
    .toSorted((a, b) => b.startedAt.localeCompare(a.startedAt))
}

/** «Fútbol», or the activity id made readable when the band gave no name. */
export function activityName(h: Pick<HealthWorkout, 'name' | 'activity'>): string {
  if (h.name) return h.name
  const s = h.activity.replaceAll('_', ' ').toLowerCase()
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Sessions the band saw as muscle work, for «Hace cuánto entrenas cada músculo». */
export function activityLoads(
  acts: readonly HealthWorkout[],
): { muscles: readonly Muscle[]; at: string; name: string }[] {
  return acts
    .filter((a) => ACTIVITY_MUSCLES[a.activity] && (a.durationS ?? 0) >= 20 * 60)
    .map((a) => ({
      muscles: ACTIVITY_MUSCLES[a.activity]!,
      at: a.startedAt,
      name: activityName(a),
    }))
}
