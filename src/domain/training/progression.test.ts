import { describe, expect, it } from 'vitest'
import type { LoggedSet, SetKind, SetTarget, Slot } from '../types'
import {
  type HistorySession,
  type ProgressionExercise,
  adjustNextSet,
  buildWarmups,
  formatRepScheme,
  recommend,
} from './progression'

let seq = 0
function set(
  weight: number | null,
  reps: number | null,
  rir: number | null = 2,
  kind: SetKind = 'work',
): LoggedSet {
  seq++
  return {
    id: `s${seq}`,
    workoutId: 'w',
    exerciseId: 'ex',
    exerciseIndex: 0,
    setIndex: seq,
    kind,
    weight,
    reps,
    rir,
    doneAt: '2026-10-01T10:00:00.000Z',
  }
}

function session(date: string, sets: LoggedSet[]): HistorySession {
  return { date, sets }
}

/** n identical sets. */
function same(n: number, weight: number | null, reps: number, rir: number | null = 2) {
  return Array.from({ length: n }, () => set(weight, reps, rir))
}

const slot = (over: Partial<Slot> = {}): Slot => ({
  id: 'slot',
  exerciseId: 'ex',
  sets: 4,
  repMin: 8,
  repMax: 10,
  rir: 2,
  restSec: 150,
  ...over,
})

const bench: ProgressionExercise = {
  increment: 2.5,
  compound: true,
  pattern: 'horizontal_push',
  equipment: 'barbell',
}
const squat: ProgressionExercise = { ...bench, pattern: 'squat' }
const curl: ProgressionExercise = {
  increment: 2,
  compound: false,
  pattern: 'isolation_upper',
  equipment: 'dumbbell',
}
const dips: ProgressionExercise = {
  increment: 2.5,
  compound: true,
  pattern: 'vertical_push',
  equipment: 'bodyweight',
  bodyweight: true,
}

describe('formatRepScheme', () => {
  it('compresses uniform schemes', () => {
    expect(formatRepScheme([10, 10, 10, 10])).toBe('4×10')
    expect(formatRepScheme([9, 9, 8, 8])).toBe('9-9-8-8')
    expect(formatRepScheme([12])).toBe('1×12')
    expect(formatRepScheme([])).toBe('')
  })
})

describe('recommend · first time', () => {
  it('asks for a test weight with the target RIR', () => {
    const r = recommend({ slot: slot(), exercise: bench, history: [] })
    expect(r.reason).toBe('first_time')
    expect(r.last).toBeNull()
    expect(r.warmups).toEqual([])
    expect(r.work).toHaveLength(4)
    expect(r.work.every((w) => w.weight === null && w.repMin === 8 && w.repMax === 10)).toBe(true)
    expect(r.work.every((w) => w.rir === 2 && w.kind === 'work')).toBe(true)
    expect(r.work.map((w) => w.setIndex)).toEqual([0, 1, 2, 3])
    expect(r.message).toContain('8-10 reps')
    expect(r.message).toContain('RIR 2')
    expect(r.exerciseId).toBe('ex')
  })

  it('treats history without usable sets as first time', () => {
    const r = recommend({
      slot: slot(),
      exercise: bench,
      history: [
        session('2026-10-01', [set(40, 8, null, 'warmup'), set(80, null), set(null, 10)]),
        session('2026-09-28', []),
      ],
    })
    expect(r.reason).toBe('first_time')
  })

  it('bodyweight first time starts without lastre', () => {
    const r = recommend({ slot: slot({ rir: 0 }), exercise: dips, history: [] })
    expect(r.work.every((w) => w.weight === 0)).toBe(true)
    expect(r.message).toContain('sin lastre')
    expect(r.message).toContain('fallo')
  })

  it('first time during deload halves the sets and adds RIR', () => {
    const r = recommend({ slot: slot({ sets: 3 }), exercise: bench, history: [], deload: true })
    expect(r.reason).toBe('first_time')
    expect(r.work).toHaveLength(2)
    expect(r.work[0]?.rir).toBe(4)
  })
})

describe('recommend · add_weight', () => {
  it('adds one increment when every set hit repMax at the target RIR', () => {
    const r = recommend({
      slot: slot(),
      exercise: bench,
      history: [session('2026-10-01', same(4, 80, 10, 2))],
    })
    expect(r.reason).toBe('add_weight')
    expect(r.message).toBe(
      'Sube a 82,5 kg: completaste 4×10 a RIR 2. Busca al menos 8 reps por serie.',
    )
    expect(r.work).toHaveLength(4)
    expect(r.work.every((w) => w.weight === 82.5 && w.repMin === 8 && w.repMax === 10)).toBe(true)
    expect(r.last).toEqual({
      date: '2026-10-01',
      sets: Array.from({ length: 4 }, () => ({ weight: 80, reps: 10, rir: 2 })),
    })
  })

  it('accepts null RIR when reps reached repMax', () => {
    const r = recommend({
      slot: slot(),
      exercise: bench,
      history: [session('d', same(4, 80, 10, null))],
    })
    expect(r.reason).toBe('add_weight')
    expect(r.message).toBe('Sube a 82,5 kg: completaste 4×10. Busca al menos 8 reps por serie.')
  })

  it('reps above the range count as completed', () => {
    const r = recommend({
      slot: slot(),
      exercise: bench,
      history: [session('d', [set(80, 12), set(80, 11), set(80, 10, 3), set(80, 13)])],
    })
    expect(r.reason).toBe('add_weight')
    expect(r.message).toContain('12-11-10-13 a RIR 2-3')
  })

  it('jumps two increments on lower-body barbell lifts with ≥ 3 RIR to spare', () => {
    const r = recommend({
      slot: slot({ sets: 3 }),
      exercise: squat,
      history: [session('d', same(3, 100, 10, 5))],
    })
    expect(r.work[0]?.weight).toBe(105)
  })

  it('only one increment if the surplus is < 3 or the lift is upper body', () => {
    const r1 = recommend({
      slot: slot({ sets: 3 }),
      exercise: squat,
      history: [session('d', same(3, 100, 10, 4))],
    })
    expect(r1.work[0]?.weight).toBe(102.5)
    const r2 = recommend({
      slot: slot({ sets: 3 }),
      exercise: bench,
      history: [session('d', same(3, 100, 10, 5))],
    })
    expect(r2.work[0]?.weight).toBe(102.5)
    const r3 = recommend({
      slot: slot({ sets: 3 }),
      exercise: squat,
      history: [session('d', [set(100, 10, 5), set(100, 10, null), set(100, 10, 5)])],
    })
    expect(r3.work[0]?.weight).toBe(102.5)
  })

  it('uses the exercise increment (2 kg dumbbells, odd current load)', () => {
    const r = recommend({
      slot: slot({ sets: 3, repMin: 10, repMax: 12 }),
      exercise: curl,
      history: [session('d', same(3, 13, 12, 2))],
    })
    expect(r.work[0]?.weight).toBe(15)
    expect(r.message).toMatch(/^Sube a 15 kg/)
    expect(r.warmups).toEqual([])
  })

  it('works with a single prescribed set', () => {
    const r = recommend({
      slot: slot({ sets: 1 }),
      exercise: curl,
      history: [session('d', [set(20, 10, 2)])],
    })
    expect(r.reason).toBe('add_weight')
    expect(r.message).toContain('1×10')
    expect(r.work).toHaveLength(1)
  })

  it('needs all prescribed sets', () => {
    const r = recommend({
      slot: slot(),
      exercise: bench,
      history: [session('d', same(3, 80, 10, 2))],
    })
    expect(r.reason).toBe('add_reps')
    expect(r.work).toHaveLength(4)
  })

  it('needs every set at the target RIR', () => {
    const r = recommend({
      slot: slot(),
      exercise: bench,
      history: [session('d', [...same(3, 80, 10, 2), set(80, 10, 1)])],
    })
    expect(r.reason).toBe('add_reps')
  })

  it('bodyweight: adds lastre and never warms up with a bar', () => {
    const r = recommend({
      slot: slot({ sets: 3, repMin: 8, repMax: 12 }),
      exercise: dips,
      history: [session('d', [set(0, 12), set(null, 12), set(0, 13)])],
    })
    expect(r.reason).toBe('add_weight')
    expect(r.message).toBe(
      'Sube el lastre a 2,5 kg: completaste 12-12-13 a RIR 2. Busca al menos 8 reps por serie.',
    )
    expect(r.warmups).toEqual([])
    expect(r.work.every((w) => w.weight === 2.5)).toBe(true)
  })

  it('bodyweight with heavy lastre still gets no warm-ups', () => {
    const r = recommend({
      slot: slot({ sets: 3 }),
      exercise: dips,
      history: [session('d', same(3, 40, 10))],
    })
    expect(r.warmups).toEqual([])
  })
})

describe('recommend · add_reps', () => {
  it('keeps the load and adds one rep per set', () => {
    const r = recommend({
      slot: slot({ repMax: 12 }),
      exercise: bench,
      history: [session('2026-10-01', [set(80, 8), set(80, 8), set(80, 7), set(80, 7)])],
    })
    expect(r.reason).toBe('add_reps')
    expect(r.message).toBe('Mantén 80 kg y busca 9-9-8-8 reps (la última vez 8-8-7-7 a RIR 2).')
    expect(r.work.map((w) => w.repMin)).toEqual([9, 9, 8, 8])
    expect(r.work.every((w) => w.weight === 80 && w.repMax === 12 && w.rir === 2)).toBe(true)
  })

  it('never targets above repMax', () => {
    const r = recommend({
      slot: slot({ sets: 3, repMax: 12 }),
      exercise: bench,
      history: [session('d', [set(80, 12, 1), set(80, 11), set(80, 14, 0)])],
    })
    expect(r.reason).toBe('add_reps')
    expect(r.work.map((w) => w.repMin)).toEqual([12, 12, 12])
  })

  it('fills missing sets with the last set done', () => {
    const r = recommend({
      slot: slot({ sets: 4, repMax: 12 }),
      exercise: bench,
      history: [session('d', [set(80, 9), set(80, 8)])],
    })
    expect(r.work.map((w) => w.repMin)).toEqual([10, 9, 9, 9])
  })

  it('keeps per-set loads when they differ', () => {
    const r = recommend({
      slot: slot({ sets: 2, repMax: 12 }),
      exercise: bench,
      history: [session('d', [set(80, 8), set(75, 9)])],
    })
    expect(r.work.map((w) => w.weight)).toEqual([80, 75])
    expect(r.message).toContain('Mantén las mismas cargas')
  })

  it('bodyweight with lastre 0', () => {
    const r = recommend({
      slot: slot({ sets: 2, repMax: 12 }),
      exercise: dips,
      history: [session('d', [set(0, 9, null), set(null, 8, null)])],
    })
    expect(r.reason).toBe('add_reps')
    expect(r.message).toBe('Mantén peso corporal y busca 10-9 reps (la última vez 9-8).')
    expect(r.work.every((w) => w.weight === 0)).toBe(true)
  })

  it('ignores warm-ups and drop sets', () => {
    const r = recommend({
      slot: slot({ sets: 2, repMax: 12 }),
      exercise: bench,
      history: [
        session('d', [set(40, 8, null, 'warmup'), set(80, 9), set(80, 9), set(60, 12, 0, 'drop')]),
      ],
    })
    expect(r.last?.sets).toHaveLength(2)
    expect(r.work.map((w) => w.repMin)).toEqual([10, 10])
  })

  it('counts failure sets', () => {
    const r = recommend({
      slot: slot({ sets: 1 }),
      exercise: bench,
      history: [session('d', [set(80, 10, 0, 'failure')])],
    })
    // 10 reps but RIR 0 < target 2: not a clean completion.
    expect(r.reason).toBe('add_reps')
  })

  it('uses the most recent non-empty session as last', () => {
    const r = recommend({
      slot: slot({ sets: 1, repMax: 12 }),
      exercise: bench,
      history: [session('new', []), session('old', [set(70, 9)])],
    })
    expect(r.last?.date).toBe('old')
  })
})

describe('recommend · dips in performance', () => {
  it('holds after one session > 3 % below the previous one', () => {
    const r = recommend({
      slot: slot({ sets: 3, repMax: 12 }),
      exercise: bench,
      history: [session('b', same(3, 80, 8)), session('a', same(3, 80, 10))],
    })
    expect(r.reason).toBe('hold')
    expect(r.message).toBe(
      'Repite 80 kg y busca 3×8 reps: rendiste un 5 % menos que la sesión anterior.',
    )
    expect(r.work.every((w) => w.weight === 80 && w.repMin === 8)).toBe(true)
  })

  it('a dip ≤ 3 % is noise', () => {
    // 80×10@2 → 112; 80×10@1 → 109.33 (−2.4 %)
    const r = recommend({
      slot: slot({ sets: 1, repMax: 12 }),
      exercise: bench,
      history: [session('b', [set(80, 10, 1)]), session('a', [set(80, 10, 2)])],
    })
    expect(r.reason).toBe('add_reps')
  })

  it('a lighter session is not a dip', () => {
    const r = recommend({
      slot: slot({ sets: 3, repMax: 12 }),
      exercise: bench,
      history: [session('b', same(3, 70, 8)), session('a', same(3, 80, 10))],
    })
    expect(r.reason).toBe('add_reps')
  })

  it('reduces 5–10 % after two dips in a row', () => {
    const r = recommend({
      slot: slot({ sets: 3, repMax: 12 }),
      exercise: bench,
      history: [
        session('c', same(3, 80, 6)),
        session('b', same(3, 80, 8)),
        session('a', same(3, 80, 10)),
      ],
    })
    expect(r.reason).toBe('reduce')
    expect(r.work.every((w) => w.weight === 75 && w.repMin === 8 && w.rir === 2)).toBe(true)
    expect(r.message).toMatch(/^Baja a 75 kg \(−6 %\) y busca 8-12 reps/)
    expect(r.message).toContain('sueño')
  })

  it('reduce always drops at least one increment', () => {
    const r = recommend({
      slot: slot({ sets: 1, repMax: 12 }),
      exercise: { ...curl, increment: 5 },
      history: [
        session('c', [set(20, 6)]),
        session('b', [set(20, 8)]),
        session('a', [set(20, 10)]),
      ],
    })
    expect(r.reason).toBe('reduce')
    expect(r.work[0]?.weight).toBe(15)
  })

  it('one dip followed by a recovery is not a reduce', () => {
    const r = recommend({
      slot: slot({ sets: 1, repMax: 12 }),
      exercise: bench,
      history: [
        session('c', [set(80, 6)]),
        session('b', [set(80, 10)]),
        session('a', [set(80, 8)]),
      ],
    })
    expect(r.reason).toBe('hold')
  })

  it('bodyweight dips are measured with the user bodyweight', () => {
    const history = [session('b', [set(0, 8, 0)]), session('a', [set(0, 10, 0)])]
    const ex = { ...dips, compound: false }
    expect(recommend({ slot: slot({ sets: 1, repMax: 12 }), exercise: ex, history }).reason).toBe(
      'add_reps',
    )
    const r = recommend({
      slot: slot({ sets: 1, repMax: 12 }),
      exercise: ex,
      history,
      bodyweight: 78,
    })
    expect(r.reason).toBe('hold')
    expect(r.message).toMatch(/^Repite peso corporal/)
  })

  it('bodyweight reduce with no lastre to remove asks for more RIR', () => {
    const r = recommend({
      slot: slot({ sets: 1, repMax: 12 }),
      exercise: dips,
      bodyweight: 78,
      history: [
        session('c', [set(0, 6, 0)]),
        session('b', [set(0, 8, 0)]),
        session('a', [set(0, 10, 0)]),
      ],
    })
    expect(r.reason).toBe('reduce')
    expect(r.work[0]?.weight).toBe(0)
    expect(r.work[0]?.rir).toBe(3)
    expect(r.message).toMatch(/^Quédate en peso corporal/)
  })

  it('ignores sets beyond 15 effective reps for e1RM', () => {
    const r = recommend({
      slot: slot({ sets: 1, repMax: 20 }),
      exercise: bench,
      history: [session('b', [set(40, 14)]), session('a', [set(40, 20)])],
    })
    expect(r.reason).toBe('add_reps')
  })
})

describe('recommend · deload', () => {
  it('≈ 90 % load, half the sets, RIR + 2, with warm-ups', () => {
    const r = recommend({
      slot: slot(),
      exercise: bench,
      history: [session('d', same(4, 80, 10))],
      deload: true,
    })
    expect(r.reason).toBe('deload')
    expect(r.work).toHaveLength(2)
    expect(r.work.every((w) => w.weight === 72.5 && w.rir === 4 && w.repMin === 8)).toBe(true)
    expect(r.warmups.map((w) => [w.weight, w.repMin])).toEqual([
      [20, 10],
      [30, 8],
      [42.5, 5],
      [57.5, 3],
    ])
    expect(r.message).toBe(
      'Semana de descarga: 72,5 kg, 2 series de 8-10 reps a RIR 4. Recupera para volver a apretar la semana que viene.',
    )
  })

  it('never fewer than one set; overrides dips', () => {
    const r = recommend({
      slot: slot({ sets: 1 }),
      exercise: curl,
      history: [
        session('c', [set(20, 6)]),
        session('b', [set(20, 8)]),
        session('a', [set(20, 10)]),
      ],
      deload: true,
    })
    expect(r.reason).toBe('deload')
    expect(r.work).toHaveLength(1)
    expect(r.work[0]?.weight).toBe(18)
    expect(r.message).toContain('1 serie de')
  })

  it('combines with easy readiness', () => {
    const r = recommend({
      slot: slot(),
      exercise: bench,
      history: [session('d', same(4, 80, 10))],
      deload: true,
      readiness: 'easy',
    })
    expect(r.work[0]?.rir).toBe(5)
  })
})

describe('recommend · readiness', () => {
  it('easy turns add_weight into hold with RIR + 1', () => {
    const r = recommend({
      slot: slot(),
      exercise: bench,
      history: [session('d', same(4, 80, 10))],
      readiness: 'easy',
    })
    expect(r.reason).toBe('hold')
    expect(r.work.every((w) => w.weight === 80 && w.rir === 3 && w.repMin === 10)).toBe(true)
    expect(r.message).toBe(
      'Hoy mantén 80 kg: tocaba subir a 82,5 kg (completaste 4×10 a RIR 2), pero tu recuperación está baja. Busca 10 reps por serie a RIR 3.',
    )
  })

  it('easy adds 1 RIR on add_reps and says so', () => {
    const r = recommend({
      slot: slot({ repMax: 12 }),
      exercise: bench,
      history: [session('d', same(4, 80, 9))],
      readiness: 'easy',
    })
    expect(r.reason).toBe('add_reps')
    expect(r.work.every((w) => w.rir === 3)).toBe(true)
    expect(r.message).toContain('RIR 3')
  })

  it('push and normal change nothing', () => {
    for (const readiness of ['push', 'normal', 'unknown'] as const) {
      const r = recommend({
        slot: slot(),
        exercise: bench,
        history: [session('d', same(4, 80, 10))],
        readiness,
      })
      expect(r.reason).toBe('add_weight')
      expect(r.work[0]?.rir).toBe(2)
    }
  })
})

describe('buildWarmups', () => {
  it('barbell ramp from the empty bar', () => {
    const w = buildWarmups(100, bench)
    expect(w.map((s) => [s.weight, s.repMin, s.repMax])).toEqual([
      [20, 10, 10],
      [40, 8, 8],
      [60, 5, 5],
      [80, 3, 3],
    ])
    expect(w.every((s) => s.kind === 'warmup')).toBe(true)
    expect(w.map((s) => s.setIndex)).toEqual([0, 1, 2, 3])
  })

  it('work sets are indexed after warm-ups', () => {
    const r = recommend({
      slot: slot(),
      exercise: bench,
      history: [session('d', same(4, 97.5, 10))],
    })
    expect(r.warmups).toHaveLength(4)
    expect(r.work.map((s) => s.setIndex)).toEqual([4, 5, 6, 7])
  })

  it('skips steps at or below the bar on light barbell loads', () => {
    expect(buildWarmups(40, bench).map((s) => s.weight)).toEqual([20, 25, 32.5])
    expect(buildWarmups(30, bench).map((s) => s.weight)).toEqual([20, 25])
  })

  it('no bar for dumbbells, steps rounded to the increment', () => {
    const db: ProgressionExercise = { ...bench, equipment: 'dumbbell', increment: 2 }
    expect(buildWarmups(32, db).map((s) => s.weight)).toEqual([12, 20, 26])
  })

  it('drops repeated steps with a coarse increment', () => {
    const stack: ProgressionExercise = { ...bench, equipment: 'machine', increment: 10 }
    // 40 %·30 = 12 → 10; 60 % = 18 → 20; 80 % = 24 → 20 (repeat, dropped)
    expect(buildWarmups(30, stack).map((s) => s.weight)).toEqual([10, 20])
  })

  it('none below 30 kg, for isolation, bodyweight or unknown weight', () => {
    expect(buildWarmups(27.5, bench)).toEqual([])
    expect(buildWarmups(100, curl)).toEqual([])
    expect(buildWarmups(100, dips)).toEqual([])
    expect(buildWarmups(null, bench)).toEqual([])
  })
})

describe('adjustNextSet', () => {
  const target: SetTarget = { setIndex: 2, kind: 'work', weight: 80, repMin: 8, repMax: 10, rir: 2 }

  it('keeps the weight when on target', () => {
    expect(
      adjustNextSet({ target, done: { weight: 80, reps: 9, rir: 2 }, increment: 2.5 }),
    ).toEqual(target)
  })

  it('drops ~5 % when the set was too hard (RIR)', () => {
    const r = adjustNextSet({ target, done: { weight: 80, reps: 9, rir: 0 }, increment: 2.5 })
    expect(r.weight).toBe(75)
    expect(r.setIndex).toBe(2)
  })

  it('drops when reps fell below repMin even with null RIR', () => {
    expect(
      adjustNextSet({ target, done: { weight: 100, reps: 7, rir: null }, increment: 2.5 }).weight,
    ).toBe(95)
  })

  it('drops at least one increment', () => {
    expect(
      adjustNextSet({ target, done: { weight: 20, reps: 5, rir: 0 }, increment: 5 }).weight,
    ).toBe(15)
    expect(
      adjustNextSet({ target, done: { weight: 2, reps: 5, rir: 0 }, increment: 5 }).weight,
    ).toBe(0)
  })

  it('adds an increment when it was far too easy', () => {
    expect(
      adjustNextSet({ target, done: { weight: 80, reps: 10, rir: 5 }, increment: 2.5 }).weight,
    ).toBe(82.5)
    expect(
      adjustNextSet({ target, done: { weight: 41.25, reps: 12, rir: 6 }, increment: 1.25 }).weight,
    ).toBe(42.5)
  })

  it('needs both high RIR and repMax to go up', () => {
    expect(
      adjustNextSet({ target, done: { weight: 80, reps: 9, rir: 5 }, increment: 2.5 }).weight,
    ).toBe(80)
    expect(
      adjustNextSet({ target, done: { weight: 80, reps: 10, rir: 4 }, increment: 2.5 }).weight,
    ).toBe(80)
    expect(
      adjustNextSet({ target, done: { weight: 80, reps: 12, rir: null }, increment: 2.5 }).weight,
    ).toBe(80)
  })

  it('follows the weight actually used', () => {
    expect(
      adjustNextSet({ target, done: { weight: 77.5, reps: 9, rir: 2 }, increment: 2.5 }).weight,
    ).toBe(77.5)
  })

  it('returns the target untouched without data', () => {
    const t = { ...target, weight: null }
    expect(
      adjustNextSet({ target: t, done: { weight: null, reps: 8, rir: 2 }, increment: 2.5 }),
    ).toBe(t)
    expect(
      adjustNextSet({ target, done: { weight: 80, reps: null, rir: 2 }, increment: 2.5 }),
    ).toBe(target)
  })

  it('lastre 0 stays at 0 when too hard', () => {
    expect(
      adjustNextSet({
        target: { ...target, weight: 0 },
        done: { weight: 0, reps: 5, rir: 0 },
        increment: 2.5,
      }).weight,
    ).toBe(0)
  })
})
