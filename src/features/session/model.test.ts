import { describe, expect, it } from 'vitest'
import type { WorkoutFull } from '@/data/rows'
import type { Exercise, LoggedSet, Slot } from '@/domain/types'
import { buildBlock, historyFor, nextSetIndex, quickFill, topSets } from './model'
import { mesoWeek, dayForDate } from './useStartWorkout'

const bench: Exercise = {
  id: 'bench-press',
  name: 'Press banca con barra',
  primary: ['chest'],
  secondary: ['triceps', 'front_delts'],
  equipment: 'barbell',
  pattern: 'horizontal_push',
  compound: true,
  increment: 2.5,
  restSec: 180,
  cues: [],
  mistakes: [],
  videos: [],
}

const slot: Slot = {
  id: 's1',
  exerciseId: 'bench-press',
  sets: 3,
  repMin: 8,
  repMax: 10,
  rir: 2,
  restSec: 180,
}

const workout = (id: string, startedAt: string, ended = true): WorkoutFull => ({
  id,
  name: 'Empuje',
  programId: null,
  dayId: null,
  startedAt,
  endedAt: ended ? startedAt : null,
  notes: null,
  sessionRpe: null,
  bodyweight: 78,
  deload: false,
  plan: [slot],
})

const set = (
  workoutId: string,
  setIndex: number,
  weight: number,
  reps: number,
  rir: number | null = 2,
  kind: LoggedSet['kind'] = 'work',
): LoggedSet => ({
  id: `${workoutId}-${setIndex}`,
  workoutId,
  exerciseId: 'bench-press',
  exerciseIndex: 0,
  setIndex,
  kind,
  weight,
  reps,
  rir,
  doneAt: '2026-10-01T18:00:00Z',
})

describe('historyFor', () => {
  it('keeps finished sessions only, most recent first, without warm-ups or the current one', () => {
    const workouts = [
      workout('a', '2026-09-20T18:00:00Z'),
      workout('b', '2026-09-27T18:00:00Z'),
      workout('now', '2026-10-04T18:00:00Z', false),
    ]
    const sets = [
      set('a', 0, 60, 10, null, 'warmup'),
      set('a', 1, 80, 10),
      set('b', 0, 82.5, 9),
      set('now', 0, 85, 8),
    ]
    const h = historyFor('bench-press', sets, workouts, 'now')
    expect(h.map((x) => x.date)).toEqual(['2026-09-27T18:00:00Z', '2026-09-20T18:00:00Z'])
    expect(h[1]!.sets).toHaveLength(1)
  })
})

describe('buildBlock', () => {
  const history = [
    {
      date: '2026-09-27T18:00:00Z',
      sets: [set('b', 0, 80, 10), set('b', 1, 80, 10), set('b', 2, 80, 10)],
    },
  ]

  it('raises the weight after a completed range and pairs logged sets with targets', () => {
    const b = buildBlock({
      index: 0,
      slot,
      exercise: bench,
      history,
      logged: [],
      deload: false,
      readiness: 'normal',
      bodyweight: 78,
    })
    expect(b.recommendation.reason).toBe('add_weight')
    const work = b.rows.filter((r) => r.target.kind === 'work')
    expect(work).toHaveLength(3)
    expect(work[0]!.target.weight).toBe(82.5)
    expect(b.doneWork).toBe(0)
  })

  it('lowers the next set when the last one was much harder than planned', () => {
    const logged = [{ ...set('now', 4, 82.5, 6, 0), exerciseIndex: 0 }]
    const b = buildBlock({
      index: 0,
      slot,
      exercise: bench,
      history,
      logged,
      deload: false,
      readiness: 'normal',
      bodyweight: 78,
    })
    const work = b.rows.filter((r) => r.target.kind === 'work')
    expect(work[0]!.done?.weight).toBe(82.5)
    expect(work[1]!.target.weight).toBeLessThan(82.5)
    expect(b.doneWork).toBe(1)
  })

  it('appends extra sets logged beyond the plan', () => {
    const logged = [0, 1, 2, 3].map((i) => set('now', 10 + i, 82.5, 10))
    const b = buildBlock({
      index: 0,
      slot,
      exercise: bench,
      history,
      logged,
      deload: false,
      readiness: 'normal',
      bodyweight: 78,
    })
    expect(b.rows.filter((r) => r.target.kind !== 'warmup')).toHaveLength(4)
    expect(b.doneWork).toBe(4)
  })
})

describe('nextSetIndex', () => {
  it('continues after the highest index of that exercise', () => {
    expect(nextSetIndex([], 0)).toBe(0)
    expect(nextSetIndex([set('w', 3, 80, 8), set('w', 5, 80, 8)], 0)).toBe(6)
  })
})

describe('mesoWeek', () => {
  const program = {
    id: 'p',
    name: 'P',
    templateId: null,
    mesoWeeks: 4,
    startedOn: '2026-09-07',
    days: [],
    archived: false,
  }
  it('counts weeks from the start and closes each block with a deload week', () => {
    expect(mesoWeek(program, new Date('2026-09-08T12:00:00'))).toEqual({ week: 1, deload: false })
    expect(mesoWeek(program, new Date('2026-09-30T12:00:00'))).toEqual({ week: 4, deload: false })
    expect(mesoWeek(program, new Date('2026-10-06T12:00:00'))).toEqual({ week: 5, deload: true })
    expect(mesoWeek(program, new Date('2026-10-13T12:00:00'))).toEqual({ week: 1, deload: false })
  })
})

describe('dayForDate', () => {
  const day = (id: string, weekday: number | null) => ({
    id,
    name: id,
    focus: '',
    weekday,
    slots: [],
  })
  it('uses the weekday of a fixed plan and reports rest days as null', () => {
    const p = {
      id: 'p',
      name: 'P',
      templateId: null,
      mesoWeeks: 6,
      startedOn: '2026-09-07',
      days: [day('lun', 0), day('mar', 1)],
      archived: false,
    }
    expect(dayForDate(p, new Set(), new Date('2026-10-06T10:00:00'))?.id).toBe('mar') // Tuesday
    expect(dayForDate(p, new Set(), new Date('2026-10-10T10:00:00'))).toBeNull() // Saturday
  })
  it('rotates floating days by what is already done this week', () => {
    const p = {
      id: 'p',
      name: 'P',
      templateId: null,
      mesoWeeks: 6,
      startedOn: '2026-09-07',
      days: [day('a', null), day('b', null)],
      archived: false,
    }
    expect(dayForDate(p, new Set(['a']))?.id).toBe('b')
  })
})

describe('topSets', () => {
  const ramp = (w: number, r: number, i: number) => set('w', i, w, r)
  it('keeps the heavy sets of a pyramid and drops the ramp and drop sets', () => {
    const sets = [ramp(30, 14, 0), ramp(40, 10, 1), ramp(50, 8, 2), ramp(60, 6, 3), ramp(45, 10, 4)]
    expect(topSets(sets).map((s) => s.weight)).toEqual([60])
  })
  it('keeps straight sets and close ones', () => {
    const sets = [ramp(80, 10, 0), ramp(80, 9, 1), ramp(72.5, 10, 2)]
    expect(topSets(sets)).toHaveLength(3)
  })
  it('keeps bodyweight sets without load', () => {
    expect(topSets([ramp(0, 10, 0), ramp(0, 9, 1)])).toHaveLength(2)
  })
})

describe('historyFor with a pyramid', () => {
  it('recommends from the top set, with warm-ups below it', () => {
    const workouts = [workout('p', '2026-10-12T18:00:00Z')]
    const sets = [30, 40, 50, 60].map((w, i) => ({
      ...set('p', i, w, [14, 10, 8, 6][i]!, 2),
      id: `p-${i}`,
    }))
    const h = historyFor('bench-press', sets, workouts, null)
    expect(h[0]!.sets.map((s) => s.weight)).toEqual([60])
    const b = buildBlock({
      index: 0,
      slot: { ...slot, repMin: 6, repMax: 8, sets: 4 },
      exercise: bench,
      history: h,
      logged: [],
      deload: false,
      readiness: 'normal',
      bodyweight: 79,
    })
    const work = b.rows.filter((r) => r.target.kind !== 'warmup')
    expect(work.every((r) => r.target.weight === 60)).toBe(true)
    expect(b.rows.some((r) => r.target.kind === 'warmup')).toBe(true)
  })
})

describe('quickFill', () => {
  const history = [
    {
      date: '2026-09-27T18:00:00Z',
      sets: [set('b', 0, 80, 10), set('b', 1, 80, 10), set('b', 2, 80, 10)],
    },
  ]
  const now = new Date('2026-10-18T19:00:00Z')
  it('copies the last work set into every pending one', () => {
    const logged = [set('now', 0, 82.5, 9, 2)]
    const b = buildBlock({
      index: 0,
      slot,
      exercise: bench,
      history,
      logged,
      deload: false,
      readiness: 'normal',
      bodyweight: 78,
    })
    const q = quickFill(b, 'now', logged, now)!
    expect(q.source).toBe('last')
    expect(q.sets).toHaveLength(2)
    expect(q.sets.every((s) => s.weight === 82.5 && s.reps === 9 && s.kind === 'work')).toBe(true)
    expect(q.sets.map((s) => s.setIndex)).toEqual([1, 2])
    expect(q.summary).toBe('2 × 82,5 kg × 9')
  })
  it('uses the prescription when nothing is done yet', () => {
    const b = buildBlock({
      index: 0,
      slot,
      exercise: bench,
      history,
      logged: [],
      deload: false,
      readiness: 'normal',
      bodyweight: 78,
    })
    const q = quickFill(b, 'now', [], now)!
    expect(q.source).toBe('target')
    expect(q.sets).toHaveLength(3)
    expect(q.sets[0]!.weight).toBe(82.5)
  })
  it('keeps the target reps of each set from the prescription', () => {
    const pyramid = [{ date: '2026-10-12T18:00:00Z', sets: [set('p', 0, 60, 6, 1)] }]
    const s4 = { ...slot, sets: 4, repMin: 6, repMax: 8 }
    const b = buildBlock({
      index: 0,
      slot: s4,
      exercise: bench,
      history: pyramid,
      logged: [],
      deload: false,
      readiness: 'normal',
      bodyweight: 79,
    })
    const q = quickFill(b, 'now', [], now)!
    expect(q.sets.map((x) => x.reps)).toEqual([7, 6, 6, 6])
    expect(q.summary).toBe('60 kg (7-6-6-6)')
  })
  it('gives up without a weight to log on a loaded exercise', () => {
    const b = buildBlock({
      index: 0,
      slot,
      exercise: bench,
      history: [],
      logged: [],
      deload: false,
      readiness: 'normal',
      bodyweight: 78,
    })
    expect(quickFill(b, 'now', [], now)).toBeNull()
  })
})
