import { describe, expect, it } from 'vitest'
import type { HealthDay } from '@/domain/types'
import { foodSummary } from './nutrition'

const day = (date: string, kcalIn: number | null, proteinG: number | null = null): HealthDay => ({
  date,
  source: 'google_health',
  sleepMin: null,
  deepMin: null,
  remMin: null,
  lightMin: null,
  awakeMin: null,
  restingHr: null,
  hrvMs: null,
  steps: 9000,
  activeKcal: null,
  vo2max: null,
  weight: null,
  bodyFat: null,
  kcalIn,
  proteinG,
  carbsG: null,
  fatG: null,
})
const now = new Date('2026-11-12T14:00:00')

describe('foodSummary', () => {
  it('stays hidden while no food is logged', () => {
    expect(
      foodSummary([day('2026-11-11', null)], now, { kcal: 2600, protein: null }, 76),
    ).toBeNull()
  })

  it('gives today, yesterday and the average of the complete days of the last week', () => {
    const s = foodSummary(
      [
        day('2026-11-03', 3000, 200), // more than a week ago: out
        day('2026-11-08', 2200, 120),
        day('2026-11-10', 2400, null),
        day('2026-11-11', 2000, 100),
        day('2026-11-12', 900, 60),
      ],
      now,
      { kcal: 2600, protein: null },
      76,
    )!
    expect(s.today).toEqual({ date: '2026-11-12', kcal: 900, protein: 60 })
    expect(s.yesterday).toMatchObject({ kcal: 2000, protein: 100 })
    expect(s.week).toEqual({ kcal: 2200, protein: 110, days: 3 })
    expect(s).toMatchObject({ kcalTarget: 2600, proteinTarget: 137, proteinEstimated: true })
  })

  it('uses the protein target from Ajustes when there is one', () => {
    const s = foodSummary([day('2026-11-11', 2000, 100)], now, { kcal: null, protein: 160 }, 76)!
    expect(s).toMatchObject({ proteinTarget: 160, proteinEstimated: false, today: null })
  })
})
