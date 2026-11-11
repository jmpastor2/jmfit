/**
 * Sleep timing: how regular the nights are, how much sleep is owed, and when to go to bed
 * tonight. Pure functions over the nights the band recorded in full.
 *
 * Times are minutes after local midnight, unwrapped around 18:00 so a 23:30 bedtime and a
 * 00:30 one sit 60 minutes apart, not 23 hours.
 */
import { PARTIAL_NIGHT_MIN } from '@/domain/training'
import type { DayState } from './state'

/** Nights used for the habits: the last three weeks. */
export const HABIT_NIGHTS = 21
/** Time to fall asleep, added before the sleep need. */
export const FALL_ASLEEP_MIN = 15
/** Most of the debt that one night is asked to pay back. */
export const MAX_PAYBACK_MIN = 60

const DAY = 24 * 60

/** Local minutes of an instant, with evening hours (from 18:00) before midnight as negative. */
export function clockMin(iso: string): number {
  const d = new Date(iso)
  const m = d.getHours() * 60 + d.getMinutes()
  return m >= 18 * 60 ? m - DAY : m
}

/** «23:45» from clock minutes (negative = the evening before). */
export function clockText(min: number): string {
  const m = ((Math.round(min) % DAY) + DAY) % DAY
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`
}

const median = (xs: number[]) => {
  const s = xs.toSorted((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2
}
const sd = (xs: number[]) => {
  const m = xs.reduce((a, b) => a + b, 0) / xs.length
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length)
}

type Night = { start: number; end: number; minutes: number }

/** The recent nights recorded in full, with their bed and wake clock times. */
export function wholeNights(states: readonly DayState[]): Night[] {
  return states
    .slice(-HABIT_NIGHTS)
    .flatMap((s) =>
      s.sleepMin != null && s.sleepMin >= PARTIAL_NIGHT_MIN && s.sleepStart && s.sleepEnd
        ? [{ start: clockMin(s.sleepStart), end: clockMin(s.sleepEnd), minutes: s.sleepMin }]
        : [],
    )
}

export interface SleepHabits {
  /** Usual bed and wake times (clock minutes). */
  bed: number
  wake: number
  /** 0–100: how much bedtimes and wake times repeat night after night. */
  consistency: number
  /** Typical spread, in minutes, of bed and wake times. */
  spreadMin: number
  nights: number
}

/** Null with fewer than three whole nights: there is no habit to read yet. */
export function sleepHabits(states: readonly DayState[]): SleepHabits | null {
  const nights = wholeNights(states)
  if (nights.length < 3) return null
  const spread = (sd(nights.map((n) => n.start)) + sd(nights.map((n) => n.end))) / 2
  return {
    bed: median(nights.map((n) => n.start)),
    wake: median(nights.map((n) => n.end)),
    // An hour of spread costs a third; three hours or more, everything.
    consistency: Math.max(0, Math.min(100, Math.round(100 - spread / 1.8))),
    spreadMin: Math.round(spread),
    nights: nights.length,
  }
}

/** Sleep owed by the last three nights (whole ones), in minutes. */
export function sleepDebt(states: readonly DayState[]): number {
  return states
    .slice(-4)
    .filter((s) => s.sleepMin != null && s.sleepMin >= PARTIAL_NIGHT_MIN)
    .slice(-3)
    .reduce((a, s) => a + Math.max(0, s.sleepNeedMin - s.sleepMin!), 0)
}

export interface Bedtime {
  /** Clock minutes to be in bed. */
  bed: number
  wake: number
  /** Sleep to aim for tonight: the need after today's strain plus part of the debt. */
  needMin: number
  debtMin: number
}

/**
 * When to go to bed tonight to wake at `wakeAt` (clock minutes) or, without it, at the usual
 * time, having slept what is needed.
 */
export function bedtimeTonight(
  states: readonly DayState[],
  needTonightMin: number,
  wakeAt?: number | null,
): Bedtime | null {
  const habits = sleepHabits(states)
  if (!habits && wakeAt == null) return null
  const debt = sleepDebt(states)
  const need = needTonightMin + Math.min(MAX_PAYBACK_MIN, Math.round(debt / 2))
  const wake = wakeAt ?? habits!.wake
  return {
    bed: wake - need - FALL_ASLEEP_MIN,
    wake,
    needMin: need,
    debtMin: debt,
  }
}

const WAKE_KEY = 'forja.wake-at'

/** The wake time chosen for tomorrow (clock minutes), kept on this device; null = usual. */
export function savedWakeAt(): number | null {
  try {
    const v = localStorage.getItem(WAKE_KEY)
    return v == null ? null : Number(v)
  } catch {
    return null
  }
}

export function saveWakeAt(min: number | null) {
  try {
    if (min == null) localStorage.removeItem(WAKE_KEY)
    else localStorage.setItem(WAKE_KEY, String(min))
  } catch {
    /* private mode: the choice lasts while the screen is open */
  }
}
