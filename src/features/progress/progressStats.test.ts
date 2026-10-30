import { describe, expect, it } from 'vitest'
import type { LoggedSet } from '@/domain/types'
import { machineRow, muscleSets, progressTally, strengthRow } from './progressStats'

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
    expect(r.since).toBeNull()
  })

  it('with a history under 8 weeks, compares with the first session', () => {
    const one = [set({ workoutId: 'a', weight: 75, reps: 6, doneAt: '2026-09-20T10:00:00' })]
    expect(strengthRow('bench-press', one, now)).toMatchObject({ before: null, since: null })
    const two = [
      ...one,
      set({ workoutId: 'b', weight: 90, reps: 5, doneAt: '2026-10-01T10:00:00' }),
    ]
    expect(strengthRow('bench-press', two, now)).toMatchObject({
      current: 105,
      before: 90,
      since: '2026-09-20T10:00:00',
    })
  })
})

describe('machineRow', () => {
  it('shows the best set and compares its load with 8 weeks earlier, no 1RM', () => {
    const sets = [
      set({
        exerciseId: 'pulldown',
        workoutId: 'a',
        weight: 60,
        reps: 12,
        doneAt: '2026-08-05T10:00:00',
      }),
      set({
        exerciseId: 'pulldown',
        workoutId: 'b',
        weight: 70,
        reps: 8,
        doneAt: '2026-10-01T10:00:00',
      }),
      set({
        exerciseId: 'pulldown',
        workoutId: 'b',
        weight: 70,
        reps: 10,
        doneAt: '2026-10-01T10:04:00',
      }),
      set({
        exerciseId: 'pulldown',
        workoutId: 'b',
        weight: 80,
        reps: 3,
        kind: 'warmup',
        doneAt: '2026-10-01T09:58:00',
      }),
    ]
    const r = machineRow('pulldown', sets, now)
    expect(r.current).toEqual({ weight: 70, reps: 10 })
    expect(r.before).toBe(60)
    expect(r.spark).toEqual([60, 70])
    expect(r.best).toEqual({ weight: 70, reps: 10, date: '2026-10-01T09:58:00' })
    expect(r.lastDate).toBe('2026-10-01T09:58:00')
  })

  it('keeps the best ever when nothing is recent', () => {
    const r = machineRow(
      'pulldown',
      [set({ exerciseId: 'pulldown', doneAt: '2026-05-01T10:00:00' })],
      now,
    )
    expect(r.current).toBeNull()
    expect(r.best?.weight).toBe(80)
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

describe('progressTally', () => {
  it('counts lifts up, held (within 1 %) and down, skipping those without comparison', () => {
    expect(
      progressTally([
        { current: 100, before: 90 },
        { current: 100, before: 99.5 },
        { current: 80, before: 90 },
        { current: 80, before: null },
      ]),
    ).toEqual({ up: 1, flat: 1, down: 1 })
  })
})
