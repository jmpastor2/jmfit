import { describe, expect, it } from 'vitest'
import type { Exercise, Slot } from '@/domain/types'
import { programVolume, volumeRows, volumeStatus } from './programVolume'

const ex: Record<string, Pick<Exercise, 'primary' | 'secondary'>> = {
  bench: { primary: ['chest'], secondary: ['front_delts', 'triceps'] },
  incline: { primary: ['chest', 'front_delts'], secondary: ['triceps'] },
  curl: { primary: ['biceps'], secondary: ['forearms', 'biceps'] },
}
const slot = (exerciseId: string, sets: number): Slot => ({
  id: exerciseId + sets,
  exerciseId,
  sets,
  repMin: 8,
  repMax: 12,
  rir: 2,
  restSec: 120,
})

describe('programVolume', () => {
  it('counts primary as 1 and secondary as 0.5 per set across days', () => {
    const v = programVolume(
      [{ slots: [slot('bench', 4), slot('curl', 3)] }, { slots: [slot('incline', 3)] }],
      (id) => ex[id],
    )
    expect(v.chest).toBe(7)
    expect(v.front_delts).toBe(2 + 3)
    expect(v.triceps).toBe(2 + 1.5)
    expect(v.biceps).toBe(3) // listed in both: primary only
    expect(v.forearms).toBe(1.5)
  })

  it('skips unknown exercises and zero sets', () => {
    expect(programVolume([{ slots: [slot('nope', 4), slot('bench', 0)] }], (id) => ex[id])).toEqual(
      {},
    )
  })
})

describe('volumeStatus', () => {
  const r = { mev: 8, mav: 16, mrv: 22 }
  it('classifies against MEV, MAV and MRV', () => {
    expect(volumeStatus(6, r)).toBe('low')
    expect(volumeStatus(8, r)).toBe('ok')
    expect(volumeStatus(16, r)).toBe('ok')
    expect(volumeStatus(18, r)).toBe('high')
    expect(volumeStatus(23, r)).toBe('over')
    expect(volumeStatus(30, { mev: 8, mav: 16 })).toBe('high')
  })
})

describe('volumeRows', () => {
  it('orders rows, includes landmark muscles with no sets and drops empty ones', () => {
    const rows = volumeRows(
      { biceps: 10, abs: 2 },
      { chest: { mev: 8, mav: 18 }, biceps: { mev: 8, mav: 20 }, calves: { mev: 0, mav: 12 } },
      ['chest', 'biceps', 'calves'],
    )
    expect(rows.map((r) => r.muscle)).toEqual(['chest', 'biceps', 'abs'])
    expect(rows[0]).toMatchObject({ sets: 0, status: 'low' })
    expect(rows[1]).toMatchObject({ sets: 10, status: 'ok' })
    expect(rows[2]).toMatchObject({ range: null, status: null })
  })
})
