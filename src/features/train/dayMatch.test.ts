import { describe, expect, it } from 'vitest'
import type { WorkoutFull } from '@/data/rows'
import type { Slot } from '@/domain/types'
import {
  dayKeyOf,
  jaccard,
  lastSameDay,
  sameDayWorkouts,
  workoutKeyOf,
  type DayKey,
} from './dayMatch'

const slots = (ids: string[]): Slot[] =>
  ids.map((exerciseId, i) => ({
    id: `s${i}`,
    exerciseId,
    sets: 3,
    repMin: 8,
    repMax: 12,
    rir: 2,
    restSec: 90,
  }))

const w = (
  id: string,
  startedAt: string,
  over: Partial<Omit<WorkoutFull, 'plan'>> & { plan?: string[] } = {},
): WorkoutFull => {
  const { plan = [], ...rest } = over
  return {
    id,
    name: 'Empuje',
    programId: 'p1',
    dayId: null,
    startedAt,
    endedAt: startedAt,
    notes: null,
    sessionRpe: null,
    bodyweight: null,
    deload: false,
    plan: slots(plan),
    ...rest,
  }
}

const PUSH = ['bench', 'incline-db', 'ohp', 'lateral', 'pushdown']
const key: DayKey = { dayId: 'd1', name: 'Empuje', exerciseIds: PUSH }

describe('jaccard', () => {
  it('measures the overlap of two id lists', () => {
    expect(jaccard(['a', 'b', 'c'], ['a', 'b', 'c'])).toBe(1)
    expect(jaccard(['a', 'b', 'c', 'd'], ['a', 'b', 'c', 'e'])).toBeCloseTo(3 / 5)
    expect(jaccard(['a', 'a', 'b'], ['a', 'b'])).toBe(1)
    expect(jaccard([], [])).toBe(0)
  })
})

describe('sameDayWorkouts', () => {
  it('uses the day id first, newest first, and ignores unfinished sessions', () => {
    const list = [
      w('old', '2026-09-01T10:00:00Z', { dayId: 'd1' }),
      w('new', '2026-09-08T10:00:00Z', { dayId: 'd1' }),
      w('open', '2026-09-15T10:00:00Z', { dayId: 'd1', endedAt: null }),
      // Same exercises but another id: not needed when the id matches.
      w('similar', '2026-09-10T10:00:00Z', { dayId: 'x', plan: PUSH }),
    ]
    expect(sameDayWorkouts(key, list).map((x) => x.id)).toEqual(['new', 'old'])
    expect(sameDayWorkouts(key, list, { includeUnfinished: true }).map((x) => x.id)).toEqual([
      'open',
      'new',
      'old',
    ])
  })

  it('falls back to ≥ 60 % shared exercises when the day was re-created', () => {
    const list = [
      // 4 of 6 distinct exercises shared → 0.67.
      w('a', '2026-09-01T10:00:00Z', { dayId: 'gone', plan: [...PUSH.slice(0, 4), 'dips'] }),
      // 3 of 7 → 0.43.
      w('b', '2026-09-08T10:00:00Z', { dayId: 'gone', plan: [...PUSH.slice(0, 3), 'x', 'y'] }),
    ]
    expect(sameDayWorkouts(key, list).map((x) => x.id)).toEqual(['a'])
  })

  it('prefers sessions with the same day name among the similar ones', () => {
    const list = [
      w('named', '2026-09-01T10:00:00Z', { dayId: 'gone', name: 'empuje ', plan: PUSH }),
      w('other', '2026-09-08T10:00:00Z', { dayId: 'gone2', name: 'Torso', plan: PUSH }),
    ]
    expect(sameDayWorkouts(key, list).map((x) => x.id)).toEqual(['named'])
    // Without any same-name session, the similar ones still count.
    expect(sameDayWorkouts({ ...key, name: 'Push' }, list).map((x) => x.id)).toEqual([
      'other',
      'named',
    ])
  })

  it('skips sessions linked to another day of the program', () => {
    const list = [w('a', '2026-09-01T10:00:00Z', { dayId: 'd2', plan: PUSH })]
    expect(sameDayWorkouts(key, list, { otherDayIds: new Set(['d2']) })).toEqual([])
    expect(sameDayWorkouts(key, list)).toHaveLength(1)
  })

  it('respects excludeId and before', () => {
    const list = [
      w('a', '2026-09-01T10:00:00Z', { dayId: 'd1' }),
      w('cur', '2026-09-08T10:00:00Z', { dayId: 'd1' }),
      w('later', '2026-09-15T10:00:00Z', { dayId: 'd1' }),
    ]
    expect(
      sameDayWorkouts(key, list, { excludeId: 'cur', before: '2026-09-08T10:00:00Z' }).map(
        (x) => x.id,
      ),
    ).toEqual(['a'])
  })

  it('matches free sessions without a plan by name only', () => {
    const free: DayKey = { dayId: null, name: 'Brazos', exerciseIds: [] }
    const list = [
      w('a', '2026-09-01T10:00:00Z', { name: 'Brazos' }),
      w('b', '2026-09-02T10:00:00Z', { name: 'Brazos', dayId: 'd9' }),
      w('c', '2026-09-03T10:00:00Z', { name: 'Pierna' }),
    ]
    expect(sameDayWorkouts(free, list).map((x) => x.id)).toEqual(['a'])
  })
})

describe('keys', () => {
  it('builds keys from a program day and from a session', () => {
    expect(dayKeyOf({ id: 'd1', name: 'Empuje', slots: slots(['a', 'b']) })).toEqual({
      dayId: 'd1',
      name: 'Empuje',
      exerciseIds: ['a', 'b'],
    })
    const s = w('a', '2026-09-01T10:00:00Z', { dayId: 'd1', plan: ['a'] })
    expect(workoutKeyOf(s)).toEqual({ dayId: 'd1', name: 'Empuje', exerciseIds: ['a'] })
    expect(lastSameDay(key, [])).toBeNull()
  })
})
