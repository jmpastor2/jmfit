import { describe, expect, it } from 'vitest'
import { activeMinutes, loadBalance, vo2Level, weekActiveMinutes } from './fitness'
import type { DayState } from './state'

const days = (strains: number[], zones: DayState['zones'] = null) =>
  strains.map((strain, i) => ({ date: String(i), strain, zones }) as DayState)

describe('fitness markers', () => {
  it('counts active minutes the WHO way (vigorous double)', () => {
    expect(activeMinutes({ light: 300, moderate: 29, vigorous: 10, peak: 54 })).toBe(29 + 128)
    expect(activeMinutes(null)).toBe(0)
    expect(weekActiveMinutes(days([1, 1], { moderate: 20 }))).toBe(40)
    expect(weekActiveMinutes(days([1, 1]))).toBeNull()
  })

  it('reads the load balance over four weeks', () => {
    expect(loadBalance(days(Array(27).fill(8)))).toBeNull()
    expect(loadBalance(days(Array(28).fill(8)))).toEqual({ ratio: 1, zone: 'optimal' })
    expect(loadBalance(days([...Array(21).fill(4), ...Array(7).fill(14)]))!.zone).toBe('danger')
    expect(loadBalance(days([...Array(21).fill(10), ...Array(7).fill(3)]))!.zone).toBe('low')
  })

  it('places a VO2 max by age and sex', () => {
    expect(vo2Level(42.8, 35, 'M')).toEqual({ level: 'Bueno', next: 46 })
    expect(vo2Level(55, 25, 'M')).toEqual({ level: 'Superior', next: null })
    expect(vo2Level(30, 35, 'F')).toEqual({ level: 'Justo', next: 34 })
  })
})
