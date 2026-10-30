import { describe, expect, it } from 'vitest'
import type { WorkoutFull } from '@/data/rows'
import type { LoggedSet, SetKind } from '@/domain/types'
import {
  changeOf,
  exerciseProgress,
  previousSameDay,
  sessionMuscleSets,
  sessionRecords,
  sessionTotals,
} from './summary'

let n = 0
const set = (
  workoutId: string,
  exerciseId: string,
  weight: number | null,
  reps: number | null,
  doneAt: string,
  kind: SetKind = 'work',
  rir: number | null = 2,
  exerciseIndex = 0,
): LoggedSet => ({
  id: `s${++n}`,
  workoutId,
  exerciseId,
  exerciseIndex,
  setIndex: n,
  kind,
  weight,
  reps,
  rir,
  doneAt,
})

const workout = (p: Partial<WorkoutFull> & { id: string; startedAt: string }): WorkoutFull => ({
  name: 'Empuje',
  programId: 'p1',
  dayId: 'd1',
  endedAt: p.startedAt,
  notes: null,
  sessionRpe: null,
  bodyweight: null,
  deload: false,
  plan: [],
  ...p,
})

describe('sessionTotals', () => {
  it('counts work sets, reps and tonnage without warm-ups', () => {
    const s = [
      set('w', 'bench', 40, 10, '2026-10-07T10:00:00Z', 'warmup'),
      set('w', 'bench', 80, 8, '2026-10-07T10:05:00Z'),
      set('w', 'bench', 80, 7, '2026-10-07T10:08:00Z'),
    ]
    expect(sessionTotals(s)).toEqual({ sets: 2, reps: 15, tonnage: 1200 })
  })
})

describe('previousSameDay', () => {
  const cur = workout({ id: 'c', startedAt: '2026-10-07T10:00:00Z' })
  it('finds the latest earlier finished session of the same program day', () => {
    const list = [
      cur,
      workout({ id: 'a', startedAt: '2026-09-30T10:00:00Z' }),
      workout({ id: 'b', startedAt: '2026-09-23T10:00:00Z' }),
      workout({ id: 'x', startedAt: '2026-10-01T10:00:00Z', dayId: 'd2' }),
      workout({ id: 'open', startedAt: '2026-10-02T10:00:00Z', endedAt: null }),
    ]
    expect(previousSameDay(cur, list)?.id).toBe('a')
  })
  it('falls back to the name for free sessions', () => {
    const free = workout({
      id: 'f',
      startedAt: '2026-10-07T10:00:00Z',
      dayId: null,
      programId: null,
      name: 'Brazos',
    })
    const list = [
      free,
      workout({
        id: 'g',
        startedAt: '2026-10-01T10:00:00Z',
        dayId: null,
        programId: null,
        name: 'Brazos',
      }),
      workout({
        id: 'h',
        startedAt: '2026-10-03T10:00:00Z',
        dayId: null,
        programId: null,
        name: 'Pierna',
      }),
    ]
    expect(previousSameDay(free, list)?.id).toBe('g')
  })
  it('finds the same day after it was re-created, by its exercises', () => {
    const plan = ['bench', 'ohp', 'pushdown'].map((exerciseId, i) => ({
      id: `p${i}`,
      exerciseId,
      sets: 3,
      repMin: 8,
      repMax: 12,
      rir: 2,
      restSec: 90,
    }))
    const now = workout({ id: 'n', startedAt: '2026-10-07T10:00:00Z', dayId: 'new', plan })
    const list = [
      now,
      workout({ id: 'old', startedAt: '2026-09-30T10:00:00Z', dayId: 'gone', plan }),
      workout({ id: 'leg', startedAt: '2026-10-02T10:00:00Z', dayId: 'legs', plan: [] }),
    ]
    expect(previousSameDay(now, list)?.id).toBe('old')
  })
  it('answers null without history', () => {
    expect(previousSameDay(cur, [cur])).toBeNull()
  })
})

describe('sessionRecords', () => {
  it('reports one record per exercise and kind with the pre-session baseline', () => {
    const old = [set('old', 'bench', 80, 8, '2026-09-30T10:00:00Z')]
    const now = [
      set('w', 'bench', 82.5, 8, '2026-10-07T10:00:00Z'),
      set('w', 'bench', 85, 6, '2026-10-07T10:05:00Z'),
    ]
    const prs = sessionRecords(now, [...old, ...now])
    const weight = prs.find((p) => p.kind === 'weight')
    expect(weight?.value).toBe(85)
    expect(weight?.previous).toBe(80)
    expect(prs.filter((p) => p.kind === 'weight')).toHaveLength(1)
    expect(prs.some((p) => p.kind === 'volume')).toBe(true)
  })
  it('does not celebrate a first-ever exercise', () => {
    const now = [set('w', 'curl', 15, 10, '2026-10-07T10:00:00Z')]
    expect(sessionRecords(now, now)).toEqual([])
  })
  it('ignores sessions done after this one', () => {
    const later = [set('later', 'bench', 100, 5, '2026-10-14T10:00:00Z')]
    const old = [set('old', 'bench', 80, 8, '2026-09-30T10:00:00Z')]
    const now = [set('w', 'bench', 85, 8, '2026-10-07T10:00:00Z')]
    const prs = sessionRecords(now, [...old, ...now, ...later])
    expect(prs.find((p) => p.kind === 'weight')?.value).toBe(85)
  })
})

describe('sessionMuscleSets', () => {
  it('weights secondary muscles by half and skips non-effective sets', () => {
    const lookup = (id: string) =>
      id === 'bench'
        ? { primary: ['chest' as const], secondary: ['triceps' as const, 'front_delts' as const] }
        : { primary: ['biceps' as const], secondary: [] }
    const s = [
      set('w', 'bench', 80, 8, '2026-10-07T10:00:00Z'),
      set('w', 'bench', 80, 8, '2026-10-07T10:03:00Z'),
      set('w', 'bench', 40, 8, '2026-10-07T09:58:00Z', 'warmup'),
      set('w', 'curl', 15, 12, '2026-10-07T10:20:00Z'),
      set('w', 'curl', 15, 12, '2026-10-07T10:22:00Z', 'work', 5),
    ]
    expect(sessionMuscleSets(s, lookup)).toEqual([
      { muscle: 'chest', sets: 2 },
      { muscle: 'triceps', sets: 1 },
      { muscle: 'front_delts', sets: 1 },
      { muscle: 'biceps', sets: 1 },
    ])
  })
})

describe('changeOf', () => {
  it('reads direction and tone', () => {
    expect(changeOf(10, 8)).toEqual({ direction: 'up', tone: 'good', diff: 2 })
    expect(changeOf(8, 10)).toEqual({ direction: 'down', tone: 'bad', diff: -2 })
    expect(changeOf(5, 5)).toEqual({ direction: 'flat', tone: 'neutral', diff: 0 })
  })
})

describe('exerciseProgress', () => {
  it('compares each exercise with its best set the last time it was done', () => {
    const before = [
      set('old', 'bench-press', 70, 8, '2026-10-01T18:00:00'),
      set('older', 'bench-press', 60, 8, '2026-09-20T18:00:00'),
      set('old', 'curl', 15, 10, '2026-10-01T18:10:00', 'work', 2, 1),
      set('old', 'pull-up', 0, 8, '2026-10-01T18:20:00', 'work', 2, 2),
    ]
    const today = [
      set('now', 'bench-press', 50, 10, '2026-10-08T18:00:00', 'warmup'),
      set('now', 'bench-press', 72.5, 8, '2026-10-08T18:05:00'),
      set('now', 'curl', 15, 10, '2026-10-08T18:10:00', 'work', 2, 1),
      set('now', 'pull-up', 0, 6, '2026-10-08T18:20:00', 'work', 2, 2),
      set('now', 'plank', null, 45, '2026-10-08T18:30:00', 'work', null, 3),
    ]
    const p = exerciseProgress(today, [...before, ...today])
    expect(p.map((x) => [x.exerciseId, x.trend])).toEqual([
      ['bench-press', 'up'],
      ['curl', 'flat'],
      ['pull-up', 'down'],
      ['plank', null],
    ])
    expect(p[0]).toMatchObject({
      today: { weight: 72.5, reps: 8 },
      before: { weight: 70, reps: 8, date: '2026-10-01T18:00:00' },
    })
  })
})
