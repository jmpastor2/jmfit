import { describe, expect, it } from 'vitest'
import type { Checkin } from '@/domain/types'
import { checkinWrites, emptyCheckin, stepsToPrefill, type CheckinForm } from './checkin'

const dates = { today: '2026-10-08', yesterday: '2026-10-07' }
const form = (over: Partial<CheckinForm> = {}): CheckinForm => ({
  sleepH: 7.5,
  sleepQuality: 4,
  energy: 3,
  soreness: 2,
  stress: 2,
  restingHr: 52,
  hrvMs: 60,
  steps: 9500,
  ...over,
})
const row = (date: string, over: Partial<Checkin> = {}): Checkin => ({
  ...emptyCheckin(date),
  ...over,
})

describe('checkinWrites', () => {
  it('saves the check-in today and the steps on yesterday, creating that row', () => {
    const w = checkinWrites(form(), dates, { today: null, yesterday: null })
    expect(w.today).toEqual({
      date: '2026-10-08',
      sleepH: 7.5,
      sleepQuality: 4,
      energy: 3,
      soreness: 2,
      stress: 2,
      restingHr: 52,
      hrvMs: 60,
      steps: null,
    })
    expect(w.yesterday).toEqual({ ...emptyCheckin('2026-10-07'), steps: 9500 })
  })

  it("keeps the other fields of yesterday's row", () => {
    const y = row('2026-10-07', { sleepH: 6, energy: 2, restingHr: 55, steps: 4000 })
    const w = checkinWrites(form(), dates, { today: null, yesterday: y })
    expect(w.yesterday).toEqual({ ...y, steps: 9500 })
  })

  it('does not rewrite yesterday when the steps did not change', () => {
    const y = row('2026-10-07', { steps: 9500 })
    expect(checkinWrites(form(), dates, { today: null, yesterday: y }).yesterday).toBeNull()
    expect(
      checkinWrites(form({ steps: null }), dates, { today: null, yesterday: null }).yesterday,
    ).toBeNull()
  })

  it('clears yesterday when the steps are erased', () => {
    const y = row('2026-10-07', { sleepH: 7, steps: 8000 })
    expect(
      checkinWrites(form({ steps: null }), dates, { today: null, yesterday: y }).yesterday,
    ).toEqual({ ...y, steps: null })
  })

  it('only steps: nothing written for today unless a row already exists', () => {
    const blank = form({
      sleepH: null,
      sleepQuality: null,
      energy: null,
      soreness: null,
      stress: null,
      restingHr: null,
      hrvMs: null,
    })
    expect(checkinWrites(blank, dates, { today: null, yesterday: null }).today).toBeNull()
    // An old row with steps saved on today's date: they move to yesterday.
    const old = row('2026-10-08', { steps: 9500 })
    const w = checkinWrites(blank, dates, { today: old, yesterday: null })
    expect(w.today?.steps).toBeNull()
    expect(w.yesterday?.steps).toBe(9500)
  })
})

describe('stepsToPrefill', () => {
  it("prefers yesterday's row, then what an old version saved today", () => {
    expect(stepsToPrefill(row('t', { steps: 1 }), row('y', { steps: 2 }))).toBe(2)
    expect(stepsToPrefill(row('t', { steps: 1 }), row('y'))).toBe(1)
    expect(stepsToPrefill(null, null)).toBeNull()
  })
})
