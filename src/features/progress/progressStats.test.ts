import { describe, expect, it } from 'vitest'
import type { LoggedSet } from '@/domain/types'
import { muscleSets, strengthRow } from './progressStats'

let n = 0
const set = (over: Partial<LoggedSet>): LoggedSet => ({
  id: `s${n++}`,
  workoutId: 'w1',
  exerciseId: 'bench-press',
  exerciseIndex: 0,
  setIndex: 0,
  kind: 'work',
  weight: 80,
  reps: 10,
  rir: 0,
  doneAt: '2026-09-01T10:00:00',
  ...over,
})

// Wednesday.
const now = new Date('2026-10-07T12:00:00')

describe('strengthRow', () => {
  it('compares the last 4 weeks with 8 weeks earlier', () => {
    const sets = [
      set({ workoutId: 'a', weight: 75, reps: 6, doneAt: '2026-08-05T10:00:00' }),
      set({ workoutId: 'b', weight: 90, reps: 5, doneAt: '2026-10-01T10:00:00' }),
    ]
    const r = strengthRow('bench-press', sets, now)
    expect(r.current).toBe(105)
    expect(r.before).toBe(90)
    expect(r.spark).toEqual([90, 105])
    expect(r.best).toEqual({ value: 105, date: '2026-10-01T10:00:00' })
  })
})

describe('muscleSets', () => {
  const byId = { 'bench-press': { primary: ['chest' as const], secondary: ['triceps' as const] } }
  const sets = [
    set({ doneAt: '2026-10-06T10:00:00' }),
    set({ doneAt: '2026-10-06T10:05:00' }),
    set({ doneAt: '2026-09-29T10:00:00' }),
    set({ doneAt: '2026-09-15T10:00:00' }),
  ]
  it('this week, last week and the 4-week average', () => {
    expect(muscleSets(sets, byId, now, 'this')).toEqual({ chest: 2, triceps: 1 })
    expect(muscleSets(sets, byId, now, 'last')).toEqual({ chest: 1, triceps: 0.5 })
    expect(muscleSets(sets, byId, now, 'avg4')).toEqual({ chest: 0.5, triceps: 0.3 })
  })
})
