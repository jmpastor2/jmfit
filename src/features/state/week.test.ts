import { describe, expect, it } from 'vitest'
import type { DayState } from './state'
import { weekReport } from './week'

const day = (i: number, over: Partial<DayState> = {}): DayState => {
  const d = new Date(2026, 10, 12 - 13 + i)
  const date = `2026-11-${String(d.getDate()).padStart(2, '0')}`
  return {
    date,
    recovery: 60,
    recoveryFactors: [],
    strain: 8,
    strainParts: [],
    sleepMin: 440,
    sleepNeedMin: 450,
    sleepScore: 97,
    partialNight: false,
    sleepStart: `${date}T00:00:00`,
    sleepEnd: `${date}T07:20:00`,
    deepMin: null,
    remMin: null,
    hrv: 30,
    restingHr: 66,
    steps: 8000,
    zones: null,
    vo2max: null,
    ...over,
  }
}

describe('weekReport', () => {
  it('needs a week of days', () => {
    expect(
      weekReport({ states: [day(0)], gymDates: [], sportDates: [], food: [], proteinTarget: null }),
    ).toBeNull()
  })

  it('compares with the week before and says what would help most', () => {
    const states = Array.from({ length: 14 }, (_, i) =>
      i < 7
        ? day(i)
        : day(i, {
            recovery: 45,
            sleepMin: i % 2 ? 200 : 380,
            partialNight: i % 2 === 1,
          }),
    )
    const r = weekReport({
      states,
      gymDates: ['2026-11-09'],
      sportDates: ['2026-11-10'],
      food: [{ date: '2026-11-11', kcal: 2100, protein: 100 }],
      proteinTarget: 160,
    })!
    expect(r.now).toMatchObject({ recovery: 45, gym: 1, sports: 1, partialNights: 4, protein: 100 })
    expect(r.before).toMatchObject({ recovery: 60, sleep: 440, partialNights: 0 })
    expect(r.tips).toHaveLength(3)
    expect(r.tips[0]).toMatch(/^4 de 7 noches/)
    expect(r.tips.join(' ')).toMatch(/Proteína media de 100 g/)
  })
})
