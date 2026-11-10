/**
 * Which program day comes next, and whether the plan fits how often the person really trains.
 * Pure functions: the clock comes in as `now`.
 *
 * A plan with weekdays (Monday push, Tuesday pull…) only works for someone who trains on those
 * days. Training whenever possible, the calendar proposed the wrong day every time and the days
 * late in the week were never reached. So the calendar rules only while it is being kept; off
 * it, the next day is the one after the last done, in program order.
 */
import type { Program, WorkoutFull } from '@/data/rows'
import { localDateKey } from '@/domain/training'
import type { ProgramDay } from '@/domain/types'
import { dayKeyOf, lastSameDay } from './dayMatch'

const DAY_MS = 86_400_000
const weekdayOf = (d: Date) => (d.getDay() + 6) % 7
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

export interface NextDay {
  /** The day to train, or null on a rest day of a calendar being kept. */
  day: ProgramDay | null
  /** `rotation`: off the calendar (or a plan without weekdays), following the program order. */
  mode: 'calendar' | 'rotation'
  /** The last program day done, when there is one. */
  last: { day: ProgramDay; workout: WorkoutFull } | null
}

/** The most recent session of any day of the program (in progress ones count). */
function lastDone(program: Program, workouts: readonly WorkoutFull[]): NextDay['last'] {
  const ids = program.days.map((d) => d.id)
  let out: NextDay['last'] = null
  for (const day of program.days) {
    const otherDayIds = new Set(ids.filter((id) => id !== day.id))
    const workout = lastSameDay(dayKeyOf(day), workouts, { otherDayIds, includeUnfinished: true })
    if (workout && (!out || workout.startedAt > out.workout.startedAt)) out = { day, workout }
  }
  return out
}

/**
 * The calendar is being kept when the last session was done on its own weekday, less than a
 * week ago, and no planned day has gone by since.
 */
function onCalendar(program: Program, last: NonNullable<NextDay['last']>, now: Date): boolean {
  const done = startOfDay(new Date(last.workout.startedAt))
  if (last.day.weekday !== weekdayOf(done)) return false
  const gap = Math.round((startOfDay(now).getTime() - done.getTime()) / DAY_MS)
  if (gap >= 7) return false
  const planned = new Set(program.days.map((d) => d.weekday))
  for (let i = 1; i < gap; i++) {
    if (planned.has(weekdayOf(new Date(done.getTime() + i * DAY_MS)))) return false
  }
  return true
}

export function nextProgramDay(
  program: Program | null,
  workouts: readonly WorkoutFull[],
  now: Date,
): NextDay {
  if (!program?.days.length) return { day: null, mode: 'calendar', last: null }
  const { days } = program
  const last = lastDone(program, workouts)
  const fixed = days.some((d) => d.weekday !== null)
  const today = days.find((d) => d.weekday === weekdayOf(now)) ?? null
  if (fixed && (!last || onCalendar(program, last, now))) {
    return { day: today, mode: 'calendar', last }
  }
  if (!last) return { day: days[0]!, mode: 'rotation', last }
  // Trained today already: that day stays, the next one is for tomorrow.
  const sameDay = localDateKey(new Date(last.workout.startedAt)) === localDateKey(now)
  const at = days.indexOf(last.day)
  return { day: sameDay ? last.day : days[(at + 1) % days.length]!, mode: 'rotation', last }
}

/** The days still to come from `next`, in program order, at most `count`. */
export function daysAhead(program: Program, next: ProgramDay | null, count: number): ProgramDay[] {
  const at = next ? program.days.indexOf(next) : -1
  if (at === -1) return []
  const n = Math.max(0, Math.min(count, program.days.length))
  return Array.from({ length: n }, (_, i) => program.days[(at + i) % program.days.length]!)
}

export interface Cadence {
  /** Finished sessions per week over the last four weeks. */
  perWeek: number
  /** Days it takes to go through the whole program at that pace. */
  cycleDays: number
}

/**
 * How often the person really trains, once there are three weeks of history. With a five-day
 * split done twice a week each session comes round every 17 days: too little for a muscle to
 * grow, and the reason to move to a plan with fewer days.
 */
export function cadence(
  program: Pick<Program, 'days'>,
  workouts: readonly WorkoutFull[],
  now: Date,
): Cadence | null {
  const finished = workouts.filter((w) => w.endedAt)
  const first = finished.reduce<number | null>((m, w) => {
    const t = Date.parse(w.startedAt)
    return m == null || t < m ? t : m
  }, null)
  if (first == null || now.getTime() - first < 21 * DAY_MS || !program.days.length) return null
  const since = now.getTime() - 28 * DAY_MS
  const count = finished.filter((w) => Date.parse(w.startedAt) >= since).length
  if (!count) return null
  const perWeek = count / 4
  return { perWeek, cycleDays: Math.round((program.days.length / perWeek) * 7) }
}

/**
 * The days per week a plan should have for that pace. Two sessions a week still go to a
 * three-day plan (done in order, it trains everything every ten days); under that, two days.
 */
export const realDaysPerWeek = (perWeek: number) =>
  perWeek < 1.75 ? 2 : Math.max(3, Math.ceil(perWeek))

/** A plan fits while a full round of its days takes no more than ten days. */
export const fitsCadence = (c: Cadence) => c.cycleDays <= 10

/** Sessions in the last three weeks under which a deload week is not earned. */
export const DELOAD_MIN_SESSIONS = 8

/** Finished sessions in the 21 days before `now`: the fatigue a deload is there to clear. */
export function deloadEarned(workouts: readonly WorkoutFull[], now: Date): boolean {
  const since = now.getTime() - 21 * DAY_MS
  return (
    workouts.filter((w) => w.endedAt && Date.parse(w.startedAt) >= since).length >=
    DELOAD_MIN_SESSIONS
  )
}
