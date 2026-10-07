import { describe, expect, it } from 'vitest'
import type { LoggedSet, Scan, UserGoal } from '@/domain/types'
import {
  bestForReps,
  formatGoalValue,
  goalCurrent,
  goalHistory,
  goalStatus,
  goalSuggestions,
  goalTitle,
  isReached,
  sessionsPerWeek,
  type GoalData,
} from './goalValues'

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

const scan = (date: string, peso: number, grasa: number, musculo: number): Scan => ({
  date,
  peso,
  grasa,
  grasaKg: null,
  musculo,
  agua: null,
  aguaIntra: null,
  aguaExtra: null,
  hueso: null,
  visceral: null,
  tmb: null,
  edadMet: null,
  imc: null,
  score: null,
  masaMagra: null,
  legScore: null,
})

const goal = (over: Partial<UserGoal>): UserGoal => ({
  id: 'g',
  kind: 'bodyfat',
  exerciseId: null,
  reps: null,
  target: 13,
  start: 16,
  startDate: '2026-06-01',
  deadline: null,
  achievedAt: null,
  ...over,
})

const now = new Date('2026-10-07T12:00:00Z')

const data: GoalData = {
  sets: [
    set({ workoutId: 'a', weight: 80, reps: 8, doneAt: '2026-08-20T10:00:00Z' }),
    set({ workoutId: 'b', weight: 85, reps: 8, doneAt: '2026-09-10T10:00:00Z' }),
    set({ workoutId: 'c', weight: 90, reps: 5, doneAt: '2026-10-01T10:00:00Z' }),
  ],
  workouts: [
    { id: 'a', name: 'A', startedAt: '2026-08-20T09:00:00Z', bodyweight: null },
    { id: 'b', name: 'B', startedAt: '2026-09-10T09:00:00Z', bodyweight: null },
    { id: 'c', name: 'C', startedAt: '2026-10-01T09:00:00Z', bodyweight: null },
    { id: 'd', name: 'D', startedAt: '2026-10-03T09:00:00Z', bodyweight: null },
  ],
  scans: [
    scan('2026-07-01', 79, 16, 36),
    scan('2026-08-01', 78.5, 15.4, 36.2),
    scan('2026-09-01', 78, 14.8, 36.4),
    scan('2026-09-10', 78, 14.6, 36.5),
  ],
}

describe('current values', () => {
  it('reads each kind from its source', () => {
    expect(goalCurrent({ kind: 'e1rm', exerciseId: 'bench-press', reps: null }, data, now)).toBe(
      107.7,
    )
    expect(goalCurrent({ kind: 'lift', exerciseId: 'bench-press', reps: 8 }, data, now)).toBe(85)
    expect(goalCurrent({ kind: 'bodyfat', exerciseId: null, reps: null }, data, now)).toBe(14.6)
    expect(goalCurrent({ kind: 'muscle', exerciseId: null, reps: null }, data, now)).toBe(36.5)
    expect(goalCurrent({ kind: 'bodyweight', exerciseId: null, reps: null }, data, now)).toBe(78)
    expect(goalCurrent({ kind: 'frequency', exerciseId: null, reps: null }, data, now)).toBe(0.8)
  })
  it('sessions per week and rep bests', () => {
    expect(sessionsPerWeek(data.workouts, now, 4)).toBe(0.8)
    expect(bestForReps('bench-press', data.sets, 5)).toBe(90)
    expect(bestForReps('squat', data.sets, 5)).toBeNull()
  })
})

describe('history', () => {
  it('lift history is a running best', () => {
    const g = goal({ kind: 'lift', exerciseId: 'bench-press', reps: 8, target: 90, start: 80 })
    expect(goalHistory(g, data, now).map((p) => p.value)).toEqual([80, 85, 85])
  })
  it('frequency history counts complete weeks', () => {
    const g = goal({ kind: 'frequency', target: 4, start: 1, startDate: '2026-09-28' })
    const h = goalHistory(g, data, now)
    expect(h.length).toBeGreaterThanOrEqual(8)
    // Week of Monday 28 Sep holds two sessions.
    expect(h.find((p) => p.date === '2026-09-28')?.value).toBe(2)
  })
})

describe('status', () => {
  it('detects reached goals in both directions', () => {
    expect(isReached(goal({ target: 15, start: 16 }), 14.6)).toBe(true)
    expect(isReached(goal({ target: 13, start: 16 }), 14.6)).toBe(false)
    expect(isReached(goal({ kind: 'e1rm', target: 100, start: 90 }), 105)).toBe(true)
  })
  it('projects body fat and compares with the deadline', () => {
    const ahead = goalStatus(goal({ deadline: '2027-06-01' }), data, now)
    expect(ahead.eta).not.toBeNull()
    expect(ahead.pace).toBe('ahead')
    const behind = goalStatus(goal({ deadline: '2026-10-20' }), data, now)
    expect(behind.pace).toBe('behind')
    const free = goalStatus(goal({}), data, now)
    expect(free.pace).toBe('no_deadline')
    expect(free.progress).toBeCloseTo(0.467, 2)
  })
  it('reached goals say so', () => {
    expect(goalStatus(goal({ target: 15 }), data, now)).toMatchObject({
      reached: true,
      pace: 'reached',
      progress: 1,
    })
  })
})

describe('labels', () => {
  it('formats', () => {
    expect(formatGoalValue('bodyfat', 13)).toBe('13 %')
    expect(goalTitle(goal({ kind: 'lift', target: 100, reps: 5 }), 'Press banca')).toBe(
      'Press banca · 100 kg × 5',
    )
  })
})

describe('suggestions', () => {
  it('builds goals from the data and skips existing ones', () => {
    const s = goalSuggestions({
      ...data,
      now,
      lifts: [{ id: 'bench-press', name: 'Press banca', increment: 2.5 }],
      existing: [],
      weeklyTarget: 5,
    })
    expect(s.map((x) => x.key)).toEqual(['e1rm:bench-press', 'bodyfat', 'muscle', 'frequency'])
    expect(s[0]!.goal.target).toBe(112.5)
    expect(s[0]!.goal.start).toBe(107.7)
    expect(s[1]!.label).toBe('Bajar a 12 % de grasa')
    const again = goalSuggestions({
      ...data,
      now,
      lifts: [{ id: 'bench-press', name: 'Press banca', increment: 2.5 }],
      existing: [goal({ kind: 'bodyfat' })],
      weeklyTarget: null,
    })
    expect(again.map((x) => x.key)).toEqual(['e1rm:bench-press', 'muscle'])
  })
})
