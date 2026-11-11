import { describe, expect, it } from 'vitest'
import {
  dayStrain,
  maxHeartRate,
  sleepNeedMin,
  sleepPerformance,
  strainFromLoad,
  strainTarget,
  trimp,
  zoneLoad,
} from './strain'

const maxHr = maxHeartRate(35) // 184

describe('strain', () => {
  it('scores sessions by duration and heart rate reserve', () => {
    expect(maxHr).toBe(184)
    expect(trimp(60, 165, 68, maxHr)).toBeCloseTo(159.9, 1)
    expect(trimp(60, 68, 68, maxHr)).toBe(0)
    expect(trimp(null, 150, 68, maxHr)).toBeNull()
  })

  it('lands a football match near 15 and a weights hour with twenty sets near 9', () => {
    const football = dayStrain({
      sessions: [{ label: 'Fútbol', minutes: 60, avgHr: 165 }],
      effectiveSets: 0,
      steps: null,
      restingHr: 68,
      maxHr,
    })
    expect(football.strain).toBeGreaterThan(14)
    expect(football.strain).toBeLessThan(16)
    const gym = dayStrain({
      sessions: [{ label: 'Fuerza', minutes: 75, avgHr: 95 }],
      effectiveSets: 20,
      steps: 6000,
      restingHr: 68,
      maxHr,
    })
    expect(gym.strain).toBeGreaterThan(8)
    expect(gym.strain).toBeLessThan(11)
    expect(gym.parts[0]!.label).toBe('20 series efectivas')
  })

  it('uses the minutes in each zone when the band has them', () => {
    expect(zoneLoad({ light: 4, moderate: 2, vigorous: 2, peak: 52 })).toBeCloseTo(173.6, 1)
    expect(zoneLoad({})).toBeNull()
    expect(zoneLoad(null)).toBeNull()
    const match = dayStrain({
      sessions: [
        {
          label: 'Fútbol',
          minutes: 60,
          avgHr: 165,
          zones: { light: 4, moderate: 2, vigorous: 2, peak: 52 },
        },
      ],
      effectiveSets: 0,
      steps: null,
      restingHr: 68,
      maxHr,
    })
    expect(match.strain).toBeGreaterThan(15)
    expect(match.strain).toBeLessThan(17)
  })

  it('saturates towards 21 and never goes past it', () => {
    expect(strainFromLoad(0)).toBe(0)
    expect(strainFromLoad(10_000)).toBe(21)
    expect(strainFromLoad(240)).toBeGreaterThan(strainFromLoad(120))
  })

  it('aims higher the better the recovery', () => {
    expect(strainTarget(80)).toEqual({ min: 14, max: 18 })
    expect(strainTarget(50)).toEqual({ min: 10, max: 14 })
    expect(strainTarget(20)).toEqual({ min: 4, max: 10 })
    expect(strainTarget(null)).toBeNull()
  })
})

describe('sleep', () => {
  it('needs more after a hard day and scores hours against the need', () => {
    expect(sleepNeedMin(null)).toBe(450)
    expect(sleepNeedMin(15)).toBe(480)
    expect(sleepNeedMin(21)).toBe(510)
    expect(sleepPerformance(360, 480)).toBe(75)
    expect(sleepPerformance(600, 450)).toBe(100)
    expect(sleepPerformance(null, 450)).toBeNull()
  })
})
