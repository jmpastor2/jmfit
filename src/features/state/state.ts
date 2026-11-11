/**
 * The body's state day by day, WHOOP-style: recovery (0–100), strain (0–21) and sleep against
 * what was needed, from the band, the check-ins and the sets logged in Forja. Pure functions.
 */
import {
  PARTIAL_NIGHT_MIN,
  addLocalDays,
  computeReadiness,
  dayStrain,
  isEffectiveSet,
  localDateKey,
  maxHeartRate,
  sleepNeedMin,
  sleepPerformance,
  type StrainPart,
} from '@/domain/training'
import type { Checkin, HealthDay, HealthWorkout, LoggedSet } from '@/domain/types'

export interface DayState {
  date: string
  /** 0–100, null without enough data. */
  recovery: number | null
  recoveryFactors: string[]
  strain: number
  strainParts: StrainPart[]
  sleepMin: number | null
  sleepNeedMin: number
  /** Sleep against the need, 0–100. */
  sleepScore: number | null
  /** Few hours recorded: the band was probably off part of the night. */
  partialNight: boolean
  /** When the night started and ended (instants), when the band knows. */
  sleepStart: string | null
  sleepEnd: string | null
  deepMin: number | null
  remMin: number | null
  hrv: number | null
  restingHr: number | null
  steps: number | null
}

const isWholeNight = (d: HealthDay | null) => d?.sleepMin != null && d.sleepMin >= PARTIAL_NIGHT_MIN

/**
 * A night the band recorded only in part says nothing about how well it was slept: it is left
 * out of the recovery score (and of the baseline it compares against).
 */
const wholeNight = (d: HealthDay): HealthDay =>
  d.sleepMin != null && d.sleepMin < PARTIAL_NIGHT_MIN
    ? { ...d, sleepMin: null, deepMin: null, remMin: null, lightMin: null, awakeMin: null }
    : d

/** Resting heart rate used for strain when the day has none: the recent median, or 60. */
function typicalRestingHr(days: readonly HealthDay[]): number {
  const xs = days
    .map((d) => d.restingHr)
    .filter((x): x is number => x != null)
    .toSorted((a, b) => a - b)
  return xs.length ? xs[Math.floor(xs.length / 2)]! : 60
}

const ageAt = (birthDate: string | null, now: Date) => {
  if (!birthDate) return 35
  const b = new Date(birthDate + 'T00:00:00')
  return Math.max(16, Math.floor((now.getTime() - b.getTime()) / (365.25 * 86_400_000)))
}

/** The last `count` days up to `now` (oldest first). */
export function dailyState(input: {
  days: readonly HealthDay[]
  workouts: readonly HealthWorkout[]
  sets: readonly LoggedSet[]
  checkins: readonly Checkin[]
  birthDate: string | null
  now: Date
  count?: number
}): DayState[] {
  const { now, count = 28 } = input
  const byDate = new Map(input.days.map((d) => [d.date, d]))
  const maxHr = maxHeartRate(ageAt(input.birthDate, now))
  const restFallback = typicalRestingHr(input.days)
  const sessionsOn = new Map<string, HealthWorkout[]>()
  for (const w of input.workouts) {
    const k = localDateKey(new Date(w.startedAt))
    sessionsOn.set(k, [...(sessionsOn.get(k) ?? []), w])
  }
  const setsOn = new Map<string, number>()
  for (const s of input.sets) {
    if (!isEffectiveSet(s)) continue
    const k = localDateKey(new Date(s.doneAt))
    setsOn.set(k, (setsOn.get(k) ?? 0) + 1)
  }

  const out: DayState[] = []
  let prevStrain: number | null = null
  // One extra day first: its strain sets the sleep need of the first day shown.
  for (let i = count; i >= 0; i--) {
    const date = localDateKey(addLocalDays(now, -i))
    const day = byDate.get(date) ?? null
    const strain = dayStrain({
      sessions: (sessionsOn.get(date) ?? []).map((w) => ({
        label: w.name ?? w.activity,
        minutes: w.durationS ? w.durationS / 60 : null,
        avgHr: w.avgHr,
      })),
      effectiveSets: setsOn.get(date) ?? 0,
      steps: day?.steps ?? null,
      restingHr: day?.restingHr ?? restFallback,
      maxHr,
    })
    const need = sleepNeedMin(prevStrain)
    prevStrain = strain.strain
    if (i === count) continue
    const checkin = input.checkins.find((c) => c.date === date) ?? null
    // One signal alone swings the score to the ends (a long night reads 100 %): it needs two of
    // HRV and resting pulse against a week of history, a whole night, the morning check-in.
    const past = input.days.filter((d) => d.date < date)
    const withHistory = (pick: (d: HealthDay) => number | null) =>
      day != null && pick(day) != null && past.filter((d) => pick(d) != null).length >= 7
    const signals = [
      withHistory((d) => d.hrvMs),
      withHistory((d) => d.restingHr),
      isWholeNight(day),
      checkin != null,
    ].filter(Boolean).length
    const enough = signals >= 2
    const readiness = computeReadiness({
      today: day && wholeNight(day),
      baseline: past.map(wholeNight),
      checkin,
    })

    const sleepMin = day?.sleepMin ?? null
    out.push({
      date,
      recovery: enough ? readiness.score : null,
      recoveryFactors: readiness.factors,
      strain: strain.strain,
      strainParts: strain.parts,
      sleepMin,
      sleepNeedMin: need,
      sleepScore: sleepPerformance(sleepMin, need),
      partialNight: sleepMin != null && sleepMin < PARTIAL_NIGHT_MIN,
      sleepStart: day?.sleepStart ?? null,
      sleepEnd: day?.sleepEnd ?? null,
      deepMin: day?.deepMin ?? null,
      remMin: day?.remMin ?? null,
      hrv: day?.hrvMs ?? null,
      restingHr: day?.restingHr ?? null,
      steps: day?.steps ?? null,
    })
  }
  return out
}

/** Average of the non-null values of the last `n` days (rounded to `digits`). */
export function recentMean(
  states: readonly DayState[],
  pick: (s: DayState) => number | null,
  n: number,
  digits = 0,
): number | null {
  const xs = states
    .slice(-n)
    .map(pick)
    .filter((x): x is number => x != null)
  if (!xs.length) return null
  const f = 10 ** digits
  return Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * f) / f
}

/** «Verde / Amarilla / Roja» band of a recovery score. */
export const recoveryBand = (r: number | null): 'high' | 'mid' | 'low' | null =>
  r == null ? null : r >= 67 ? 'high' : r >= 34 ? 'mid' : 'low'
