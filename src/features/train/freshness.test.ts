import { describe, expect, it } from 'vitest'
import { exerciseById } from '@/content/exercises'
import type { LoggedSet } from '@/domain/types'
import { muscleFreshness, stalest, tailoredSession, weekStreak } from './freshness'

const lookup = (id: string) => exerciseById(id)!
let n = 0
const set = (exerciseId: string, doneAt: string, over: Partial<LoggedSet> = {}): LoggedSet => ({
  id: `s${n++}`,
  workoutId: doneAt.slice(0, 10),
  exerciseId,
  exerciseIndex: 0,
  setIndex: n,
  kind: 'work',
  weight: 50,
  reps: 10,
  rir: 1,
  doneAt,
  ...over,
})
const now = new Date('2026-11-11T10:00:00')
const days = (sets: LoggedSet[]) =>
  Object.fromEntries(muscleFreshness(sets, lookup, now).map((f) => [f.group.id, f.days]))

describe('muscleFreshness', () => {
  it('counts whole days since each group was last the main muscle', () => {
    const sets = [
      set('squat', '2026-10-15T20:00:00'),
      set('bench-press', '2026-11-05T22:40:00'),
      set('bench-press', '2026-10-22T20:00:00'),
      set('barbell-curl', '2026-11-11T07:00:00'),
      // Warm-ups and sets far from failure train nothing.
      set('leg-press', '2026-11-10T20:00:00', { kind: 'warmup' }),
      set('lat-pulldown', '2026-11-10T20:00:00', { rir: 6 }),
    ]
    expect(days(sets)).toMatchObject({ quads: 27, chest: 6, biceps: 0, back: null, calves: null })
  })
})

describe('stalest', () => {
  it('lists the groups waiting longest, never the untrained or the just trained', () => {
    const fresh = muscleFreshness(
      [
        set('squat', '2026-10-15T20:00:00'),
        set('bench-press', '2026-11-05T20:00:00'),
        set('barbell-curl', '2026-11-10T20:00:00'),
      ],
      lookup,
      now,
    )
    expect(stalest(fresh, 5).map((f) => f.group.id)).toEqual(['quads', 'glutes', 'chest'])
  })
})

describe('tailoredSession', () => {
  it('builds the session from the exercises done most often, big lifts first', () => {
    const sets = [
      set('leg-extension', '2026-10-01T20:00:00'),
      set('leg-press', '2026-10-08T20:00:00'),
      set('leg-press', '2026-10-15T20:00:00'),
      set('triceps-pushdown', '2026-10-20T20:00:00'),
      set('bench-press', '2026-11-10T20:00:00'),
    ]
    const { slots, groups } = tailoredSession(sets, lookup, now)
    expect(slots.map((s) => s.exerciseId)).toEqual(['leg-press', 'triceps-pushdown'])
    expect(groups.map((g) => g.id)).toEqual(['quads', 'triceps'])
    expect(slots[0]).toMatchObject({ sets: 4, repMin: 6 })
  })
})

describe('weekStreak', () => {
  const w = (d: string) => ({ startedAt: `${d}T19:00:00`, endedAt: `${d}T20:00:00` })
  it('counts weeks in a row; the current week does not break it while it is open', () => {
    // now = Wednesday 11 Nov. Weeks of 26 Oct, 2 Nov trained; this week not yet.
    expect(weekStreak([w('2026-10-28'), w('2026-11-05')], now)).toBe(2)
    expect(weekStreak([w('2026-10-28'), w('2026-11-05'), w('2026-11-09')], now)).toBe(3)
    // A gap (week of 19 Oct missing) stops the count.
    expect(weekStreak([w('2026-10-14'), w('2026-10-28'), w('2026-11-05')], now)).toBe(2)
    expect(weekStreak([w('2026-10-14')], now)).toBe(0)
    expect(weekStreak([{ startedAt: '2026-11-09T19:00:00', endedAt: null }], now)).toBe(0)
  })
})

describe('sports recorded by the band', () => {
  it('count as recent load: no legs the day after football', () => {
    const sets = [
      set('squat', '2026-10-15T20:00:00'),
      set('bench-press', '2026-11-01T20:00:00'),
      set('lat-pulldown', '2026-11-02T20:00:00'),
      set('barbell-curl', '2026-11-03T20:00:00'),
    ]
    const football = {
      muscles: ['quads', 'hamstrings', 'glutes', 'calves'] as const,
      at: '2026-11-10T20:00:00',
      name: 'Fútbol',
    }
    const fresh = muscleFreshness(sets, lookup, now, [football])
    expect(fresh.find((f) => f.group.id === 'quads')).toMatchObject({ days: 1, via: 'Fútbol' })
    expect(fresh.find((f) => f.group.id === 'chest')).toEqual({
      group: expect.objectContaining({ id: 'chest' }),
      days: 10,
    })
    const { groups } = tailoredSession(sets, lookup, now, 5, [football])
    expect(groups.map((g) => g.id)).not.toContain('quads')
    expect(groups[0]!.id).toBe('chest')
  })
})
