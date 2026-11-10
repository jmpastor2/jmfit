/**
 * How long ago each muscle group was last trained, and a session built from the ones waiting
 * longest. For someone who trains when they can, «legs: 27 days ago» says more than a weekly
 * volume table. Pure functions: the clock comes in as `now`.
 */
import { isEffectiveSet, localDateKey } from '@/domain/training'
import type { Exercise, LoggedSet, Muscle, Slot } from '@/domain/types'
import { slotFor } from '@/features/session/model'

export interface MuscleGroup {
  id: string
  label: string
  muscles: readonly Muscle[]
}

/** The groups a person thinks in at the gym (arms split: they are trained on purpose). */
export const FRESHNESS_GROUPS: readonly MuscleGroup[] = [
  { id: 'chest', label: 'Pecho', muscles: ['chest'] },
  { id: 'back', label: 'Espalda', muscles: ['back'] },
  { id: 'shoulders', label: 'Hombro', muscles: ['side_delts', 'front_delts', 'rear_delts'] },
  { id: 'biceps', label: 'Bíceps', muscles: ['biceps'] },
  { id: 'triceps', label: 'Tríceps', muscles: ['triceps'] },
  { id: 'quads', label: 'Cuádriceps', muscles: ['quads'] },
  { id: 'hamstrings', label: 'Femoral', muscles: ['hamstrings'] },
  { id: 'glutes', label: 'Glúteo', muscles: ['glutes'] },
  { id: 'calves', label: 'Gemelo', muscles: ['calves'] },
  { id: 'core', label: 'Core', muscles: ['abs'] },
]

/** Days without training a group from which it counts as neglected. */
export const STALE_DAYS = 10

export interface Freshness {
  group: MuscleGroup
  /** Whole local days since the last effective set with the group as main muscle; null = never. */
  days: number | null
}

type Lookup = (id: string) => Pick<Exercise, 'primary'>

const dayNumber = (d: Date) =>
  Math.round(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 86_400_000)

export function muscleFreshness(
  sets: readonly LoggedSet[],
  lookup: Lookup,
  now: Date,
): Freshness[] {
  const last = new Map<Muscle, string>()
  for (const s of sets) {
    if (!isEffectiveSet(s)) continue
    for (const m of lookup(s.exerciseId).primary) {
      if ((last.get(m) ?? '') < s.doneAt) last.set(m, s.doneAt)
    }
  }
  const today = dayNumber(now)
  return FRESHNESS_GROUPS.map((group) => {
    const latest = group.muscles.map((m) => last.get(m) ?? '').reduce((a, b) => (a > b ? a : b))
    return { group, days: latest ? Math.max(0, today - dayNumber(new Date(latest))) : null }
  })
}

/**
 * The groups to train next, longest ago first: trained at some point, and with two days of
 * rest behind them (yesterday's muscles are still recovering).
 */
export function stalest(fresh: readonly Freshness[], count: number): Freshness[] {
  return fresh
    .filter((f) => f.days != null && f.days >= 2)
    .toSorted((a, b) => b.days! - a.days!)
    .slice(0, count)
}

/**
 * A session for the groups waiting longest: for each, the exercise the person has done on most
 * days (their own choice of machine, not a catalog default), big lifts first.
 */
export function tailoredSession(
  sets: readonly LoggedSet[],
  lookup: (id: string) => Exercise,
  now: Date,
  count = 5,
): { slots: Slot[]; groups: MuscleGroup[] } {
  const days = new Map<string, Set<string>>()
  for (const s of sets) {
    if (!isEffectiveSet(s)) continue
    const seen = days.get(s.exerciseId) ?? new Set<string>()
    seen.add(localDateKey(new Date(s.doneAt)))
    days.set(s.exerciseId, seen)
  }
  const favourites = [...days.entries()]
    .toSorted((a, b) => b[1].size - a[1].size)
    .map(([id]) => lookup(id))

  const picked: Exercise[] = []
  const groups: MuscleGroup[] = []
  for (const { group } of stalest(muscleFreshness(sets, lookup, now), count)) {
    const exercise = favourites.find(
      (e) => group.muscles.includes(e.primary[0]!) && !picked.includes(e),
    )
    if (!exercise) continue
    picked.push(exercise)
    groups.push(group)
  }
  const ordered = picked.toSorted((a, b) => Number(b.compound) - Number(a.compound))
  return { slots: ordered.map((e) => slotFor(e)), groups }
}

/**
 * Weeks in a row with at least one finished session, up to the current one (a week still
 * without sessions does not break the run until it is over).
 */
export function weekStreak(
  workouts: readonly { startedAt: string; endedAt: string | null }[],
  now: Date,
): number {
  const monday = (d: Date) => dayNumber(d) - ((d.getDay() + 6) % 7)
  const weeks = new Set(workouts.filter((w) => w.endedAt).map((w) => monday(new Date(w.startedAt))))
  let week = monday(now)
  if (!weeks.has(week)) week -= 7
  let streak = 0
  while (weeks.has(week)) {
    streak++
    week -= 7
  }
  return streak
}
