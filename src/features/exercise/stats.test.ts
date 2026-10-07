import { describe, expect, it } from 'vitest'
import type { Exercise, LoggedSet } from '@/domain/types'
import {
  bestE1rmInWindow,
  currentE1rm,
  e1rmSeries,
  exerciseSessions,
  latestBodyweight,
  mainLifts,
  prTimeline,
  setE1rm,
} from './stats'

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
  doneAt: '2026-09-01T10:00:00Z',
  ...over,
})

describe('setE1rm', () => {
  it('ignores warm-ups and uses Epley with RIR', () => {
    expect(setE1rm(set({ kind: 'warmup' }))).toBeNull()
    expect(setE1rm(set({ weight: 90, reps: 8, rir: 2 }))).toBe(120)
  })
})

describe('exerciseSessions', () => {
  const sets = [
    set({ workoutId: 'a', weight: 80, reps: 10, doneAt: '2026-08-01T10:00:00Z' }),
    set({ workoutId: 'a', weight: 85, reps: 8, setIndex: 1, doneAt: '2026-08-01T10:05:00Z' }),
    set({ workoutId: 'b', weight: 90, reps: 5, doneAt: '2026-08-08T10:00:00Z' }),
    set({ workoutId: 'b', exerciseId: 'squat', doneAt: '2026-08-08T10:30:00Z' }),
  ]
  it('groups by workout, most recent first, with the best set', () => {
    const s = exerciseSessions('bench-press', sets, [
      { id: 'a', name: 'Empuje', startedAt: '2026-08-01T09:55:00Z' },
    ])
    expect(s.map((x) => x.workoutId)).toEqual(['b', 'a'])
    expect(s[1]!.date).toBe('2026-08-01T09:55:00Z')
    expect(s[1]!.bestE1rm).toBeCloseTo(107.7, 1)
    expect(s[1]!.bestSet?.weight).toBe(85)
    expect(e1rmSeries(s).map((p) => p.value)).toEqual([107.7, 105])
  })
})

describe('current e1RM', () => {
  const sets = [
    set({ weight: 100, reps: 5, doneAt: '2026-06-01T10:00:00Z', workoutId: 'old' }),
    set({ weight: 80, reps: 5, doneAt: '2026-09-25T10:00:00Z', workoutId: 'new' }),
  ]
  const now = new Date('2026-10-01T10:00:00Z')
  it('takes the best of the last 4 weeks', () => {
    expect(bestE1rmInWindow('bench-press', sets, now)).toBeCloseTo(93.3, 1)
    expect(currentE1rm('bench-press', sets, now)).toMatchObject({ recent: true })
  })
  it('falls back to the last session when nothing recent', () => {
    const later = new Date('2026-12-01T10:00:00Z')
    expect(currentE1rm('bench-press', sets, later)).toMatchObject({
      value: 93.3,
      recent: false,
    })
    expect(currentE1rm('squat', sets, later)).toBeNull()
  })
})

describe('mainLifts', () => {
  it('lists compound lifts with data by frequency', () => {
    const lookup = (id: string) => ({ id, name: id, compound: id !== 'curl' }) as Exercise
    const sets = [
      set({ exerciseId: 'squat', workoutId: 'a' }),
      set({ exerciseId: 'squat', workoutId: 'b' }),
      set({ exerciseId: 'bench-press', workoutId: 'a' }),
      set({ exerciseId: 'curl', workoutId: 'a' }),
      set({ exerciseId: 'row', workoutId: 'a', kind: 'warmup' }),
    ]
    expect(mainLifts(sets, lookup).map((l) => [l.exercise.id, l.sessions])).toEqual([
      ['squat', 2],
      ['bench-press', 1],
    ])
  })
})

describe('prTimeline', () => {
  it('reports records in order, never the first set', () => {
    const sets = [
      set({ weight: 80, reps: 8, doneAt: '2026-08-01T10:00:00Z' }),
      set({ weight: 85, reps: 8, doneAt: '2026-08-08T10:00:00Z' }),
      set({ weight: 70, reps: 8, doneAt: '2026-08-15T10:00:00Z' }),
    ]
    const prs = prTimeline(sets)
    expect(prs.every((p) => p.date === '2026-08-08T10:00:00Z')).toBe(true)
    expect(prs.map((p) => p.kind).toSorted()).toEqual(['e1rm', 'weight'])
  })
})

describe('latestBodyweight', () => {
  it('takes the newest of scans and logged bodyweight', () => {
    expect(
      latestBodyweight(
        [{ date: '2026-09-10', peso: 78.2 }],
        [{ startedAt: '2026-09-01T10:00:00Z', bodyweight: 77 }],
      ),
    ).toEqual({ value: 78.2, date: '2026-09-10' })
    expect(
      latestBodyweight(
        [{ date: '2026-09-10', peso: 78.2 }],
        [{ startedAt: '2026-09-20T10:00:00Z', bodyweight: 77.5 }],
      ),
    ).toEqual({ value: 77.5, date: '2026-09-20' })
    expect(latestBodyweight([], [])).toBeNull()
  })
})
