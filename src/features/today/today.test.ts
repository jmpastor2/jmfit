import { describe, expect, it } from 'vitest'
import type { WorkoutFull } from '@/data/rows'
import type { LoggedSet, Scan, UserGoal } from '@/domain/types'
import {
  agoLabel,
  doneDayIdsThisWeek,
  goalCurrent,
  greeting,
  recentRecords,
  scanStatus,
  weekSummary,
} from './today'

/** Local time; 2026-10-05 is a Monday, 2026-10-07 a Wednesday. */
const at = (day: number, h = 10, month = 9) => new Date(2026, month, day, h).toISOString()
const NOW = new Date(2026, 9, 7, 18)

let n = 0
const set = (
  exerciseId: string,
  weight: number,
  reps: number,
  doneAt: string,
  workoutId = 'w',
): LoggedSet => ({
  id: `s${++n}`,
  workoutId,
  exerciseId,
  exerciseIndex: 0,
  setIndex: n,
  kind: 'work',
  weight,
  reps,
  rir: 2,
  doneAt,
})

const workout = (id: string, startedAt: string, dayId: string | null = null): WorkoutFull => ({
  id,
  name: 'X',
  programId: 'p1',
  dayId,
  startedAt,
  endedAt: startedAt,
  notes: null,
  sessionRpe: null,
  bodyweight: null,
  deload: false,
  plan: [],
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

describe('greeting', () => {
  it('follows the hour', () => {
    expect(greeting(new Date(2026, 9, 7, 8))).toBe('Buenos días')
    expect(greeting(new Date(2026, 9, 7, 16))).toBe('Buenas tardes')
    expect(greeting(new Date(2026, 9, 7, 23))).toBe('Buenas noches')
  })
})

describe('doneDayIdsThisWeek', () => {
  it('keeps only this week and this program', () => {
    const ws = [
      workout('a', at(5), 'd1'),
      workout('b', at(4), 'd2'), // Sunday: last week
      { ...workout('c', at(6), 'd3'), programId: 'other' },
    ]
    expect([...doneDayIdsThisWeek(ws, 'p1', NOW)]).toEqual(['d1'])
  })
})

describe('weekSummary', () => {
  it('compares with last week up to the same moment', () => {
    const ws = [workout('a', at(5)), workout('b', at(7))]
    const sets = [
      set('bench', 100, 5, at(5)),
      set('bench', 100, 5, at(7)),
      set('bench', 50, 10, at(28, 10, 8)), // last Monday
      set('bench', 50, 10, at(3)), // last Saturday: after "same moment"
    ]
    const w = weekSummary(ws, sets, NOW)
    expect(w.days).toEqual([true, false, true, false, false, false, false])
    expect(w.todayIndex).toBe(2)
    expect(w.sessions).toBe(2)
    expect(w.sets).toBe(2)
    expect(w.tonnage).toBe(1000)
    expect(w.prevSets).toBe(1)
    expect(w.prevTonnage).toBe(500)
  })
})

describe('recentRecords', () => {
  it('keeps one record per exercise inside the window, best kind first', () => {
    const sets = [
      set('bench', 80, 8, at(1, 10, 8)),
      set('bench', 85, 8, at(6)),
      set('curl', 15, 10, at(1, 10, 7)),
      set('curl', 17.5, 10, at(1, 10, 8)), // older than 14 days
    ]
    const prs = recentRecords(sets, NOW)
    expect(prs).toHaveLength(1)
    expect(prs[0]).toMatchObject({ exerciseId: 'bench', kind: 'e1rm' })
  })
})

describe('scanStatus', () => {
  it('reports the age of the last scan', () => {
    const s = scanStatus([scan('2026-08-10', 79, 16, 63), scan('2026-09-10', 78, 15, 63.5)], NOW)
    expect(s?.daysAgo).toBe(27)
    expect(s?.previous?.date).toBe('2026-08-10')
    expect(scanStatus([], NOW)).toBeNull()
  })
  it('labels the age', () => {
    expect(agoLabel(0)).toBe('hoy')
    expect(agoLabel(1)).toBe('ayer')
    expect(agoLabel(30)).toBe('hace 30 días')
  })
})

describe('goalCurrent', () => {
  const goal = (p: Partial<UserGoal>): UserGoal => ({
    id: 'g',
    kind: 'e1rm',
    exerciseId: 'bench',
    reps: null,
    target: 120,
    start: null,
    startDate: '2026-09-01',
    deadline: null,
    achievedAt: null,
    ...p,
  })
  const ctx = {
    sets: [set('bench', 100, 5, at(5)), set('bench', 90, 8, at(6))],
    scans: [scan('2026-09-10', 78, 15, 63.5)],
    sessionsThisWeek: 3,
  }
  it('reads each kind from its source', () => {
    expect(goalCurrent(goal({}), ctx)).toBeGreaterThan(100)
    expect(goalCurrent(goal({ kind: 'lift', reps: 8 }), ctx)).toBe(90)
    expect(goalCurrent(goal({ kind: 'lift', reps: 5 }), ctx)).toBe(100)
    expect(goalCurrent(goal({ kind: 'bodyweight', exerciseId: null }), ctx)).toBe(78)
    expect(goalCurrent(goal({ kind: 'bodyfat', exerciseId: null }), ctx)).toBe(15)
    expect(goalCurrent(goal({ kind: 'muscle', exerciseId: null }), ctx)).toBe(63.5)
    expect(goalCurrent(goal({ kind: 'frequency', exerciseId: null }), ctx)).toBe(3)
    expect(goalCurrent(goal({ exerciseId: 'squat' }), ctx)).toBeNull()
  })
})
