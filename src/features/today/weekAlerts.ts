/**
 * Warnings for the current week on Hoy: muscles falling behind what the program prescribes and
 * planned exercises that were skipped in the sessions already done. Pure functions.
 *
 * Weeks are local Monday 00:00 → next Monday (see `@/domain/training/volume`). A session belongs
 * to the week it started in; its sets stay with it even when logged after midnight.
 */
import type { WorkoutFull } from '@/data/rows'
import {
  SECONDARY_FACTOR,
  addLocalDays,
  startOfLocalWeek,
  weeklySetsByMuscle,
} from '@/domain/training'
import type { Exercise, LoggedSet, Muscle, ProgramDay } from '@/domain/types'

type MuscleInfo = Pick<Exercise, 'primary' | 'secondary'>
type Lookup = (id: string) => MuscleInfo

/** Weekday index with Monday = 0 … Sunday = 6. */
export const weekdayIndex = (d: Date) => (d.getDay() + 6) % 7

/** Muscle → sets of a list of slots: primary 1 per set, secondary 0.5 (primary wins). */
export function setsByMuscle(
  slots: readonly { exerciseId: string; sets: number }[],
  lookup: Lookup,
): Partial<Record<Muscle, number>> {
  const out: Partial<Record<Muscle, number>> = {}
  for (const s of slots) {
    const ex = lookup(s.exerciseId)
    const primary = new Set(ex.primary)
    for (const m of primary) out[m] = (out[m] ?? 0) + s.sets
    for (const m of new Set(ex.secondary)) {
      if (!primary.has(m)) out[m] = (out[m] ?? 0) + s.sets * SECONDARY_FACTOR
    }
  }
  return out
}

/**
 * Program days still ahead this week, in order. Fixed plans (days with a weekday): the days not
 * done whose weekday is later this week, or today when nothing was finished today. Floating plans:
 * the days not done, as many as calendar days remain.
 */
export function remainingDays(
  days: readonly ProgramDay[],
  doneDayIds: ReadonlySet<string>,
  now: Date,
  trainedToday: boolean,
): ProgramDay[] {
  const today = weekdayIndex(now)
  const pending = days.filter((d) => !doneDayIds.has(d.id))
  if (days.some((d) => d.weekday !== null)) {
    return pending
      .filter(
        (d) => d.weekday !== null && (d.weekday > today || (d.weekday === today && !trainedToday)),
      )
      .toSorted((a, b) => a.weekday! - b.weekday!)
  }
  const slotsLeft = 7 - today - (trainedToday ? 1 : 0)
  return pending.slice(0, Math.max(0, slotsLeft))
}

export interface VolumeGap {
  muscle: Muscle
  /** Effective sets done this week. */
  done: number
  /** Sets the program prescribes for the whole week. */
  planned: number
  /** Sets the days still ahead will add if done as planned. */
  ahead: number
  /** What is missing even if the rest of the week goes to plan: planned − done − ahead. */
  missing: number
  /** Days still ahead that train this muscle. */
  recoverDays: ProgramDay[]
}

export interface VolumeGapInput {
  days: readonly ProgramDay[]
  sets: readonly LoggedSet[]
  doneDayIds: ReadonlySet<string>
  trainedToday: boolean
  lookup: Lookup
  now: Date
  /** Muscles always shown when behind (the person's specialisation). */
  focus?: readonly Muscle[]
  /** How many of the other muscles to show. */
  limit?: number
}

/** Smallest shortfall worth a warning, in sets. */
export const MIN_GAP = 1

/**
 * Muscles that will end the week under what the program prescribes: the `limit` with the largest
 * shortfall plus every `focus` muscle that is short, largest first.
 */
export function volumeGaps(input: VolumeGapInput): VolumeGap[] {
  const { days, lookup, now } = input
  const planned = setsByMuscle(
    days.flatMap((d) => d.slots),
    lookup,
  )
  const ahead = remainingDays(days, input.doneDayIds, now, input.trainedToday)
  const aheadSets = setsByMuscle(
    ahead.flatMap((d) => d.slots),
    lookup,
  )
  const ids = new Set(input.sets.map((s) => s.exerciseId))
  const byId: Record<string, MuscleInfo> = {}
  for (const id of ids) byId[id] = lookup(id)
  const done = weeklySetsByMuscle([...input.sets], byId, startOfLocalWeek(now))

  const gaps: VolumeGap[] = []
  for (const [m, p] of Object.entries(planned) as [Muscle, number][]) {
    const d = done[m] ?? 0
    const a = aheadSets[m] ?? 0
    const missing = p - d - a
    if (missing < MIN_GAP) continue
    gaps.push({
      muscle: m,
      done: d,
      planned: p,
      ahead: a,
      missing,
      recoverDays: ahead.filter((day) => (setsByMuscle(day.slots, lookup)[m] ?? 0) > 0),
    })
  }
  gaps.sort((x, y) => y.missing - x.missing || x.muscle.localeCompare(y.muscle))
  const focus = new Set(input.focus ?? [])
  const top = gaps.filter((g) => !focus.has(g.muscle)).slice(0, input.limit ?? 3)
  const keep = new Set([...top, ...gaps.filter((g) => focus.has(g.muscle))])
  return gaps.filter((g) => keep.has(g))
}

const WEEKDAYS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']

const joinEs = (xs: string[]) =>
  xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} y ${xs.at(-1)}`

/** «Torso el viernes», «Torso hoy», «Brazos» (floating day). */
export function dayWhen(day: ProgramDay, now: Date): string {
  if (day.weekday === null) return day.name
  return day.weekday === weekdayIndex(now)
    ? `${day.name} hoy`
    : `${day.name} el ${WEEKDAYS[day.weekday]}`
}

/** «Te queda Torso el viernes para recuperar.» / «Ningún día de lo que queda lo trabaja.» */
export function recoverSentence(gap: VolumeGap, now: Date): string {
  const days = gap.recoverDays
  if (!days.length) return 'No queda ningún día del plan que lo trabaje esta semana.'
  const list = joinEs(days.map((d) => dayWhen(d, now)))
  return `Te ${days.length === 1 ? 'queda' : 'quedan'} ${list} para recuperar.`
}

/**
 * One line for the muscles nothing left this week can make up: a bar each for something that
 * cannot be acted on was noise. «Glúteos y cuádriceps se quedan cortos esta semana: ningún día
 * que queda los trabaja.»
 */
export function lostLine(gaps: readonly VolumeGap[], label: (m: Muscle) => string): string {
  const lost = gaps.filter((g) => !g.recoverDays.length).map((g) => label(g.muscle).toLowerCase())
  if (!lost.length) return ''
  const one = lost.length === 1
  const list = joinEs(lost)
  return `${list[0]!.toUpperCase()}${list.slice(1)} se ${one ? 'queda corto' : 'quedan cortos'} esta semana: ningún día que queda ${one ? 'lo' : 'los'} trabaja.`
}

export interface SkippedSlot {
  exerciseId: string
  slotId: string
}

export interface Substitution {
  planned: string
  done: string
}

export interface SessionSkips {
  workoutId: string
  workoutName: string
  startedAt: string
  skipped: SkippedSlot[]
  substituted: Substitution[]
}

/** Sets that show the exercise was trained: anything but warm-ups, with at least one rep. */
const isWorkSet = (s: LoggedSet) => s.kind !== 'warmup' && (s.reps ?? 0) >= 1

/**
 * Planned slots without a single work set in one session. A skipped slot whose exercise shares a
 * primary muscle with an exercise done in that session but absent from its plan counts as
 * substituted (each extra exercise replaces at most one slot, in plan order).
 */
export function sessionSkips(
  workout: WorkoutFull,
  sets: readonly LoggedSet[],
  lookup: Lookup,
): SessionSkips {
  const doneIds: string[] = []
  for (const s of sets) {
    if (s.workoutId === workout.id && isWorkSet(s) && !doneIds.includes(s.exerciseId))
      doneIds.push(s.exerciseId)
  }
  const plannedIds = new Set(workout.plan.map((s) => s.exerciseId))
  const extras = doneIds.filter((id) => !plannedIds.has(id))
  const used = new Set<string>()
  const skipped: SkippedSlot[] = []
  const substituted: Substitution[] = []
  for (const slot of workout.plan) {
    if (doneIds.includes(slot.exerciseId)) continue
    const prim = new Set(lookup(slot.exerciseId).primary)
    const sub = extras.find((id) => !used.has(id) && lookup(id).primary.some((m) => prim.has(m)))
    if (sub) {
      used.add(sub)
      substituted.push({ planned: slot.exerciseId, done: sub })
    } else {
      skipped.push({ exerciseId: slot.exerciseId, slotId: slot.id })
    }
  }
  return {
    workoutId: workout.id,
    workoutName: workout.name,
    startedAt: workout.startedAt,
    skipped,
    substituted,
  }
}

/** Finished sessions of the week of `now` with a plan, oldest first, and what each one skipped. */
export function weekSkips(
  workouts: readonly WorkoutFull[],
  sets: readonly LoggedSet[],
  lookup: Lookup,
  now: Date,
): SessionSkips[] {
  const from = startOfLocalWeek(now).getTime()
  const to = addLocalDays(startOfLocalWeek(now), 7).getTime()
  return workouts
    .filter((w) => {
      const t = Date.parse(w.startedAt)
      return w.endedAt && w.plan.length && t >= from && t < to
    })
    .toSorted((a, b) => a.startedAt.localeCompare(b.startedAt))
    .map((w) => sessionSkips(w, sets, lookup))
}

/** «Peso muerto rumano, Gemelos de pie (Pierna) · Curl martillo (Hombro y brazos)». */
export function skipsLine(skips: readonly SessionSkips[], name: (id: string) => string): string {
  return skips
    .filter((s) => s.skipped.length)
    .map(
      (s) =>
        `${[...new Set(s.skipped.map((x) => name(x.exerciseId)))].join(', ')} (${s.workoutName})`,
    )
    .join(' · ')
}
