import { describe, expect, it } from 'vitest'
import type { LoggedSet } from '@/domain/types'
import {
  estimateMinutes,
  formatInt,
  formatLongDate,
  groupByMonth,
  prescription,
  recordsBySet,
  signed,
  workoutMinutes,
} from './history'

describe('formatting', () => {
  it('writes the long date', () => {
    expect(formatLongDate(new Date(2026, 9, 7))).toBe('Miércoles 7 oct')
  })
  it('groups thousands from five digits', () => {
    expect(formatInt(4320.4)).toBe('4320')
    expect(formatInt(12450)).toBe('12.450')
    expect(formatInt(-1234567)).toBe('-1.234.567')
  })
  it('signs changes', () => {
    expect(signed(2.5, String)).toBe('+2.5')
    expect(signed(-3, String)).toBe('-3')
    expect(signed(0, String)).toBe('0')
  })
  it('writes a prescription', () => {
    expect(prescription({ sets: 4, repMin: 6, repMax: 8 })).toBe('4 × 6–8')
    expect(prescription({ sets: 3, repMin: 10, repMax: 10 })).toBe('3 × 10')
  })
})

describe('durations', () => {
  it('estimates sets × (40 s + rest)', () => {
    // 4 × (40 + 140) = 720 s; 3 × (40 + 60) = 300 s → 17 min
    expect(
      estimateMinutes([
        { sets: 4, restSec: 140 },
        { sets: 3, restSec: 60 },
      ]),
    ).toBe(17)
  })
  it('measures finished sessions only', () => {
    expect(
      workoutMinutes({ startedAt: '2026-10-07T10:00:00Z', endedAt: '2026-10-07T11:05:00Z' }),
    ).toBe(65)
    expect(workoutMinutes({ startedAt: '2026-10-07T10:00:00Z', endedAt: null })).toBeNull()
    expect(
      workoutMinutes({ startedAt: '2026-10-07T10:00:00Z', endedAt: '2026-10-07T10:00:00Z' }),
    ).toBeNull()
  })
})

describe('groupByMonth', () => {
  it('groups finished sessions newest first', () => {
    const w = (startedAt: string, endedAt: string | null = startedAt) => ({ startedAt, endedAt })
    const groups = groupByMonth([
      w(new Date(2026, 8, 1, 10).toISOString()),
      w(new Date(2026, 9, 5, 10).toISOString()),
      w(new Date(2026, 9, 6, 10).toISOString(), null),
      w(new Date(2026, 9, 2, 10).toISOString()),
    ])
    expect(groups.map((g) => [g.label, g.items.length])).toEqual([
      ['Octubre 2026', 2],
      ['Septiembre 2026', 1],
    ])
  })
})

describe('recordsBySet', () => {
  it('judges each set against the earlier ones of its exercise', () => {
    const s = (
      id: string,
      exerciseId: string,
      weight: number,
      reps: number,
      doneAt: string,
    ): LoggedSet => ({
      id,
      workoutId: 'w',
      exerciseId,
      exerciseIndex: 0,
      setIndex: 0,
      kind: 'work',
      weight,
      reps,
      rir: null,
      doneAt,
    })
    const map = recordsBySet([
      s('a', 'bench', 80, 8, '2026-09-01T10:00:00Z'),
      s('b', 'bench', 85, 8, '2026-09-08T10:00:00Z'),
      s('c', 'bench', 70, 8, '2026-09-15T10:00:00Z'),
      s('d', 'curl', 15, 10, '2026-09-15T10:00:00Z'),
    ])
    expect(map.has('a')).toBe(false)
    expect(map.get('b')?.map((p) => p.kind)).toEqual(['e1rm', 'weight'])
    expect(map.has('c')).toBe(false)
    expect(map.has('d')).toBe(false)
  })
})
