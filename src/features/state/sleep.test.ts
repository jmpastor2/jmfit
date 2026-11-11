import { describe, expect, it } from 'vitest'
import { bedtimeTonight, clockMin, clockText, sleepDebt, sleepHabits } from './sleep'
import type { DayState } from './state'

const night = (date: string, bed: string, wake: string, sleepMin: number): DayState => ({
  date,
  recovery: null,
  recoveryFactors: [],
  strain: 8,
  strainParts: [],
  sleepMin,
  sleepNeedMin: 450,
  sleepScore: null,
  partialNight: sleepMin < 240,
  sleepStart: new Date(bed).toISOString(),
  sleepEnd: new Date(wake).toISOString(),
  deepMin: null,
  remMin: null,
  hrv: null,
  restingHr: null,
  steps: null,
})

describe('clock', () => {
  it('keeps evening and early hours on one line', () => {
    expect(clockMin('2026-11-10T23:30:00')).toBe(-30)
    expect(clockMin('2026-11-11T00:30:00')).toBe(30)
    expect(clockText(-30)).toBe('23:30')
    expect(clockText(450)).toBe('7:30')
  })
})

describe('sleep habits', () => {
  const regular = [
    night('2026-11-08', '2026-11-07T23:30:00', '2026-11-08T07:30:00', 450),
    night('2026-11-09', '2026-11-08T23:45:00', '2026-11-09T07:40:00', 440),
    night('2026-11-10', '2026-11-09T23:15:00', '2026-11-10T07:20:00', 420),
    night('2026-11-11', '2026-11-11T00:00:00', '2026-11-11T07:30:00', 400),
  ]
  it('reads the usual times and scores a steady routine high', () => {
    const h = sleepHabits(regular)!
    expect(clockText(h.bed)).toBe('23:38')
    expect(clockText(h.wake)).toBe('7:30')
    expect(h.consistency).toBeGreaterThan(85)
  })

  it('scores an irregular one low and ignores nights recorded in part', () => {
    const h = sleepHabits([
      night('2026-11-07', '2026-11-07T00:50:00', '2026-11-07T13:05:00', 648),
      night('2026-11-08', '2026-11-08T06:44:00', '2026-11-08T13:17:00', 380),
      night('2026-11-09', '2026-11-09T01:40:00', '2026-11-09T05:58:00', 230),
      night('2026-10-30', '2026-10-30T05:39:00', '2026-10-30T11:05:00', 287),
      night('2026-10-28', '2026-10-28T01:01:00', '2026-10-28T07:54:00', 403),
    ])!
    expect(h.nights).toBe(4)
    expect(h.consistency).toBeLessThan(40)
    expect(sleepHabits(regular.slice(0, 2))).toBeNull()
  })

  it('owes what the last nights fell short and pays half of it back tonight', () => {
    expect(sleepDebt(regular)).toBe(10 + 30 + 50)
    const b = bedtimeTonight(regular, 480)!
    expect(b).toMatchObject({ needMin: 480 + 45, debtMin: 90 })
    expect(clockText(b.bed)).toBe('22:30')
  })
})
