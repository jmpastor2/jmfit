import { describe, expect, it } from 'vitest'
import type { Exercise, LoggedSet, SetKind } from '../types'
import {
  addLocalDays,
  isEffectiveSet,
  localDateKey,
  startOfLocalWeek,
  tonnage,
  trainingDays,
  weeklySetsByMuscle,
  weeklyTrend,
} from './volume'

/** Local-time ISO timestamp (TZ-independent tests). 2026-10-05 is a Monday. */
const at = (day: number, h = 10, m = 0, month = 9) => new Date(2026, month, day, h, m).toISOString()

let seq = 0
function set(
  exerciseId: string,
  doneAt: string,
  over: { kind?: SetKind; weight?: number | null; reps?: number | null; rir?: number | null } = {},
): LoggedSet {
  seq++
  return {
    id: `s${seq}`,
    workoutId: 'w',
    exerciseId,
    exerciseIndex: 0,
    setIndex: seq,
    kind: over.kind ?? 'work',
    weight: over.weight === undefined ? 50 : over.weight,
    reps: over.reps === undefined ? 10 : over.reps,
    rir: over.rir === undefined ? 2 : over.rir,
    doneAt,
  }
}

const catalog: Record<string, Pick<Exercise, 'primary' | 'secondary' | 'bodyweight'>> = {
  bench: { primary: ['chest'], secondary: ['triceps', 'front_delts'] },
  curl: { primary: ['biceps'], secondary: ['forearms'] },
  dips: { primary: ['chest', 'triceps'], secondary: ['triceps', 'front_delts'], bodyweight: true },
}

describe('date helpers', () => {
  it('startOfLocalWeek is Monday 00:00 local', () => {
    const mon = startOfLocalWeek(new Date(2026, 9, 7, 15)) // Wednesday
    expect(localDateKey(mon)).toBe('2026-10-05')
    expect(mon.getHours()).toBe(0)
    expect(localDateKey(startOfLocalWeek(new Date(2026, 9, 11, 23, 59)))).toBe('2026-10-05') // Sun
    expect(localDateKey(startOfLocalWeek(new Date(2026, 9, 5, 0, 0)))).toBe('2026-10-05') // Mon
    expect(localDateKey(startOfLocalWeek(new Date(2026, 9, 4, 23, 59)))).toBe('2026-09-28')
  })

  it('crosses months and years', () => {
    expect(localDateKey(startOfLocalWeek(new Date(2027, 0, 1)))).toBe('2026-12-28')
    expect(localDateKey(addLocalDays(new Date(2026, 9, 31), 1))).toBe('2026-11-01')
  })

  it('addLocalDays keeps local midnight across DST changes', () => {
    // Last Sunday of October: DST ends in the EU (no-op in zones without DST).
    const d = addLocalDays(new Date(2026, 9, 24), 2)
    expect(localDateKey(d)).toBe('2026-10-26')
    expect(d.getHours()).toBe(0)
  })
})

describe('isEffectiveSet', () => {
  it('filters kinds, reps and RIR', () => {
    const t = at(5)
    expect(isEffectiveSet(set('bench', t))).toBe(true)
    expect(isEffectiveSet(set('bench', t, { kind: 'failure', rir: 0 }))).toBe(true)
    expect(isEffectiveSet(set('bench', t, { kind: 'drop' }))).toBe(true)
    expect(isEffectiveSet(set('bench', t, { kind: 'warmup' }))).toBe(false)
    expect(isEffectiveSet(set('bench', t, { rir: 4 }))).toBe(true)
    expect(isEffectiveSet(set('bench', t, { rir: 5 }))).toBe(false)
    expect(isEffectiveSet(set('bench', t, { rir: null }))).toBe(true)
    expect(isEffectiveSet(set('bench', t, { reps: null }))).toBe(false)
    expect(isEffectiveSet(set('bench', t, { reps: 0 }))).toBe(false)
  })
})

describe('weeklySetsByMuscle', () => {
  const monday = new Date(2026, 9, 5)

  it('counts primary 1 and secondary 0.5', () => {
    const sets = [set('bench', at(5)), set('bench', at(5)), set('curl', at(7))]
    expect(weeklySetsByMuscle(sets, catalog, monday)).toEqual({
      chest: 2,
      triceps: 1,
      front_delts: 1,
      biceps: 1,
      forearms: 0.5,
    })
  })

  it('a muscle in both lists counts as primary only', () => {
    expect(weeklySetsByMuscle([set('dips', at(6))], catalog, monday)).toEqual({
      chest: 1,
      triceps: 1,
      front_delts: 0.5,
    })
  })

  it('respects the Sunday/Monday boundary in local time', () => {
    const sets = [
      set('curl', at(4, 23, 30)), // previous Sunday
      set('curl', at(5, 0, 30)), // Monday
      set('curl', at(11, 23, 59)), // Sunday
      set('curl', at(12, 0, 0)), // next Monday
    ]
    expect(weeklySetsByMuscle(sets, catalog, monday).biceps).toBe(2)
    expect(weeklySetsByMuscle(sets, catalog, new Date(2026, 9, 1)).biceps).toBe(1)
    expect(weeklySetsByMuscle(sets, catalog, new Date(2026, 9, 14)).biceps).toBe(1)
  })

  it('normalises any weekStart within the week', () => {
    const sets = [set('curl', at(5, 8))]
    expect(weeklySetsByMuscle(sets, catalog, new Date(2026, 9, 9, 18)).biceps).toBe(1)
  })

  it('skips warm-ups, easy sets, unknown exercises and bad dates', () => {
    const sets = [
      set('curl', at(5), { kind: 'warmup' }),
      set('curl', at(5), { rir: 6 }),
      set('nope', at(5)),
      set('curl', 'not a date'),
    ]
    expect(weeklySetsByMuscle(sets, catalog, monday)).toEqual({})
    expect(weeklySetsByMuscle([], catalog, monday)).toEqual({})
  })
})

describe('tonnage', () => {
  it('sums kg·reps of non-warm-up sets', () => {
    const sets = [
      set('bench', at(5), { weight: 80, reps: 10 }),
      set('bench', at(5), { weight: 82.5, reps: 8 }),
      set('bench', at(5), { weight: 40, reps: 8, kind: 'warmup' }),
      set('bench', at(5), { weight: 60, reps: null }),
      set('bench', at(5), { weight: null, reps: 10 }),
    ]
    expect(tonnage(sets)).toBe(1460)
    expect(tonnage([])).toBe(0)
  })

  it('adds bodyweight to bodyweight exercises when known', () => {
    const sets = [
      set('dips', at(5), { weight: 0, reps: 10 }),
      set('dips', at(5), { weight: 10, reps: 8 }),
      set('dips', at(5), { weight: null, reps: 5 }),
      set('bench', at(5), { weight: 50, reps: 10 }),
    ]
    expect(tonnage(sets)).toBe(80 + 500)
    expect(tonnage(sets, { bodyweight: 78 })).toBe(580) // no catalog: can't tell which are bodyweight
    expect(tonnage(sets, { bodyweight: 78, exercisesById: catalog })).toBe(
      78 * 10 + 88 * 8 + 78 * 5 + 500,
    )
    expect(tonnage(sets, { bodyweight: null, exercisesById: catalog })).toBe(580)
  })
})

describe('weeklyTrend', () => {
  it('returns N Monday-based weeks oldest first, current week last', () => {
    const sets = [
      set('bench', at(28, 10, 0, 8), { weight: 50, reps: 10 }), // Mon 28 Sep
      set('bench', at(4, 23, 30), { weight: 50, reps: 10 }), // Sun 4 Oct (same week)
      set('bench', at(5, 0, 10), { weight: 60, reps: 5 }), // Mon 5 Oct
      set('bench', at(5, 0, 20), { weight: 20, reps: 10, kind: 'warmup' }),
      set('bench', at(6), { weight: 60, reps: 5, rir: 6 }), // not effective but has tonnage
      set('bench', at(1, 10, 0, 8)), // Sep 1: out of range
    ]
    const trend = weeklyTrend(sets, 3, new Date(2026, 9, 7, 12))
    expect(trend).toEqual([
      { weekStart: '2026-09-21', sets: 0, tonnage: 0 },
      { weekStart: '2026-09-28', sets: 2, tonnage: 1000 },
      { weekStart: '2026-10-05', sets: 1, tonnage: 600 },
    ])
  })

  it('handles 0 / fractional weeks and passes bodyweight options', () => {
    const now = new Date(2026, 9, 7)
    expect(weeklyTrend([], 0, now)).toEqual([])
    expect(weeklyTrend([], 1.9, now)).toHaveLength(1)
    const t = weeklyTrend([set('dips', at(6), { weight: 0, reps: 10 })], 1, now, {
      bodyweight: 78,
      exercisesById: catalog,
    })
    expect(t[0]?.tonnage).toBe(780)
  })

  it('weeks spanning the October DST change stay Monday-aligned', () => {
    const trend = weeklyTrend([], 3, new Date(2026, 10, 4))
    expect(trend.map((w) => w.weekStart)).toEqual(['2026-10-19', '2026-10-26', '2026-11-02'])
  })
})

describe('trainingDays', () => {
  it('one flag per local day, today last', () => {
    const now = new Date(2026, 9, 7, 9)
    const workouts = [
      { startedAt: at(7, 7) },
      { startedAt: at(5, 0, 15) }, // just after midnight Monday
      { startedAt: at(4, 23, 50) }, // Sunday night
      { startedAt: at(1) }, // out of range
      { startedAt: 'garbage' },
    ]
    expect(trainingDays(workouts, 5, now)).toEqual([false, true, true, false, true])
  })

  it('handles empty input and zero days', () => {
    expect(trainingDays([], 3, new Date(2026, 9, 7))).toEqual([false, false, false])
    expect(trainingDays([{ startedAt: at(7) }], 0, new Date(2026, 9, 7))).toEqual([])
  })

  it('works across the DST change', () => {
    const now = new Date(2026, 9, 26, 12)
    const workouts = [{ startedAt: at(25, 12) }, { startedAt: at(24, 23, 30) }]
    expect(trainingDays(workouts, 3, now)).toEqual([true, true, false])
  })
})
