import { describe, expect, it } from 'vitest'
import type { LoggedSet, SetKind } from '../types'
import { bestsByExercise, detectPRs, isRecordEligible, sessionVolumePR } from './records'

let seq = 0
function set(
  weight: number | null,
  reps: number | null,
  over: Partial<LoggedSet> & { kind?: SetKind } = {},
): LoggedSet {
  seq++
  return {
    id: `s${seq}`,
    workoutId: 'w1',
    exerciseId: 'bench',
    exerciseIndex: 0,
    setIndex: seq,
    kind: 'work',
    weight,
    reps,
    rir: null,
    doneAt: `2026-10-${String((seq % 28) + 1).padStart(2, '0')}T10:00:00.000Z`,
    ...over,
  }
}

describe('isRecordEligible', () => {
  it('excludes warm-ups and incomplete sets', () => {
    expect(isRecordEligible(set(100, 5))).toBe(true)
    expect(isRecordEligible(set(0, 5))).toBe(true)
    expect(isRecordEligible(set(100, 5, { kind: 'warmup' }))).toBe(false)
    expect(isRecordEligible(set(null, 5))).toBe(false)
    expect(isRecordEligible(set(100, 0))).toBe(false)
    expect(isRecordEligible(set(100, null))).toBe(false)
    expect(isRecordEligible(set(100, 5, { kind: 'drop' }))).toBe(true)
  })
})

describe('detectPRs', () => {
  const prior = [set(100, 5), set(90, 8), set(80, 10)]

  it('detects e1RM, weight and reps PRs', () => {
    const s = set(105, 5)
    const prs = detectPRs(s, prior)
    // No prior set at ≥ 105 kg: that's a weight PR, not a rep PR.
    expect(prs.map((p) => p.kind).toSorted()).toEqual(['e1rm', 'weight'])
    const e = prs.find((p) => p.kind === 'e1rm')
    expect(e?.value).toBe(122.5)
    expect(e?.previous).toBe(116.7) // 100·(1+5/30)
    expect(e?.setId).toBe(s.id)
    expect(e?.date).toBe(s.doneAt)
    expect(e?.exerciseId).toBe('bench')
    const w = prs.find((p) => p.kind === 'weight')
    expect(w).toMatchObject({ value: 105, previous: 100 })
    expect(w?.atWeight).toBeUndefined()
  })

  it('a rep PR at a new top weight appears only with includeFirst', () => {
    expect(detectPRs(set(110, 1), prior).find((p) => p.kind === 'reps')).toBeUndefined()
    expect(
      detectPRs(set(110, 1), prior, { includeFirst: true }).find((p) => p.kind === 'reps'),
    ).toMatchObject({ value: 1, previous: null, atWeight: 110 })
  })

  it('rep PR at a weight already lifted', () => {
    const prs = detectPRs(set(90, 9), prior)
    expect(prs.map((p) => p.kind).toSorted()).toEqual(['e1rm', 'reps'])
    expect(prs.find((p) => p.kind === 'reps')).toMatchObject({
      value: 9,
      previous: 8,
      atWeight: 90,
    })
  })

  it('reps at a weight are compared with heavier sets too', () => {
    // 85×8: previous best at ≥ 85 kg is 90×8 → no rep PR.
    expect(detectPRs(set(85, 8), prior).find((p) => p.kind === 'reps')).toBeUndefined()
    // 85×9 beats it.
    expect(detectPRs(set(85, 9), prior).find((p) => p.kind === 'reps')).toMatchObject({
      value: 9,
      previous: 8,
    })
  })

  it('ties are not records', () => {
    expect(detectPRs(set(100, 5), prior)).toEqual([])
  })

  it('uses RIR in the e1RM', () => {
    // 100×5 @ RIR 2 ≈ 100×7 → 123.3 > 116.7
    const prs = detectPRs(set(100, 5, { rir: 2 }), prior)
    expect(prs.map((p) => p.kind)).toEqual(['e1rm'])
  })

  it('no e1RM record beyond 15 effective reps', () => {
    const prs = detectPRs(set(80, 20), prior)
    expect(prs.map((p) => p.kind)).toEqual(['reps'])
  })

  it('first ever set: nothing by default, baseline with includeFirst', () => {
    const s = set(60, 10)
    expect(detectPRs(s, [])).toEqual([])
    const prs = detectPRs(s, [], { includeFirst: true })
    expect(prs.map((p) => p.kind).toSorted()).toEqual(['e1rm', 'reps', 'weight'])
    expect(prs.every((p) => p.previous === null)).toBe(true)
  })

  it('ignores warm-ups, other exercises and the set itself', () => {
    const s = set(70, 5)
    const p = [set(200, 5, { kind: 'warmup' }), set(200, 5, { exerciseId: 'squat' }), s, set(60, 5)]
    expect(
      detectPRs(s, p)
        .map((x) => x.kind)
        .toSorted(),
    ).toEqual(['e1rm', 'weight'])
  })

  it('warm-up or incomplete new sets are never PRs', () => {
    expect(detectPRs(set(300, 5, { kind: 'warmup' }), prior)).toEqual([])
    expect(detectPRs(set(300, null), prior)).toEqual([])
  })

  it('lastre 0: only rep PRs are possible', () => {
    const p = [set(0, 10, { exerciseId: 'pullup' })]
    const prs = detectPRs(set(0, 12, { exerciseId: 'pullup' }), p)
    expect(prs).toHaveLength(1)
    expect(prs[0]).toMatchObject({ kind: 'reps', value: 12, previous: 10, atWeight: 0 })
  })
})

describe('bestsByExercise', () => {
  it('collects bests per exercise, excluding warm-ups', () => {
    const sets = [
      set(100, 5, { id: 'a', doneAt: '2026-09-01T10:00:00Z' }),
      set(80, 12, { id: 'b', doneAt: '2026-09-02T10:00:00Z' }),
      set(150, 3, { id: 'c', doneAt: '2026-09-03T10:00:00Z', kind: 'warmup' }),
      set(140, 3, { id: 'd', exerciseId: 'squat', doneAt: '2026-09-04T10:00:00Z' }),
      set(null, 3, { id: 'e' }),
    ]
    const b = bestsByExercise(sets)
    expect(Object.keys(b).toSorted()).toEqual(['bench', 'squat'])
    const bench = b.bench
    expect(bench?.e1rm).toMatchObject({ value: 116.7, setId: 'a', weight: 100, reps: 5 })
    expect(bench?.maxWeight).toMatchObject({ value: 100, setId: 'a', date: '2026-09-01T10:00:00Z' })
    expect(bench?.bestSetVolume).toMatchObject({ value: 960, setId: 'b' })
    expect(bench?.repPRs[1]).toBe(100)
    expect(bench?.repPRs[5]).toBe(100)
    expect(bench?.repPRs[6]).toBe(80)
    expect(bench?.repPRs[12]).toBe(80)
    expect(bench?.repPRs[13]).toBeUndefined()
    expect(b.squat?.maxWeight?.value).toBe(140)
  })

  it('ties keep the earliest set', () => {
    const b = bestsByExercise([
      set(100, 5, { id: 'late', doneAt: '2026-09-10T10:00:00Z' }),
      set(100, 5, { id: 'early', doneAt: '2026-09-01T10:00:00Z' }),
    ])
    expect(b.bench?.e1rm?.setId).toBe('early')
    expect(b.bench?.maxWeight?.setId).toBe('early')
  })

  it('caps the rep table at 15 and skips e1RM for long sets', () => {
    const b = bestsByExercise([set(40, 20)])
    expect(b.bench?.e1rm).toBeNull()
    expect(b.bench?.repPRs[15]).toBe(40)
    expect(b.bench?.repPRs[16]).toBeUndefined()
  })

  it('bodyweight with lastre 0', () => {
    const b = bestsByExercise([set(0, 10, { exerciseId: 'pullup' })])
    expect(b.pullup).toMatchObject({ e1rm: null, maxWeight: null, bestSetVolume: null })
    expect(b.pullup?.repPRs[10]).toBe(0)
  })

  it('empty input', () => {
    expect(bestsByExercise([])).toEqual({})
  })
})

describe('sessionVolumePR', () => {
  const prior = [
    set(80, 10, { workoutId: 'p1' }),
    set(80, 10, { workoutId: 'p1' }), // 1600
    set(100, 5, { workoutId: 'p2' }), // 500
  ]

  it('beats the best previous session of the exercise', () => {
    const cur = [
      set(80, 10, { workoutId: 'c', id: 'c1', doneAt: '2026-10-05T10:00:00Z' }),
      set(80, 11, { workoutId: 'c', id: 'c2', doneAt: '2026-10-05T10:05:00Z' }),
      set(40, 10, { workoutId: 'c', kind: 'warmup', doneAt: '2026-10-05T10:10:00Z' }),
    ]
    expect(sessionVolumePR(cur, prior)).toEqual([
      {
        exerciseId: 'bench',
        kind: 'volume',
        value: 1680,
        setId: 'c2',
        date: '2026-10-05T10:05:00Z',
        previous: 1600,
      },
    ])
  })

  it('no record on a tie or below', () => {
    const cur = [set(80, 10, { workoutId: 'c' }), set(80, 10, { workoutId: 'c' })]
    expect(sessionVolumePR(cur, prior)).toEqual([])
  })

  it('ignores prior sets from the current workout', () => {
    const cur = [set(50, 10, { workoutId: 'c' })]
    const p = [set(50, 10, { workoutId: 'c' }), set(40, 10, { workoutId: 'old' })]
    expect(sessionVolumePR(cur, p)[0]).toMatchObject({ value: 500, previous: 400 })
  })

  it('first session of an exercise only with includeFirst', () => {
    const cur = [set(100, 5, { workoutId: 'c', exerciseId: 'row' })]
    expect(sessionVolumePR(cur, prior)).toEqual([])
    expect(sessionVolumePR(cur, prior, { includeFirst: true })[0]).toMatchObject({
      exerciseId: 'row',
      value: 500,
      previous: null,
    })
  })

  it('zero volume never counts', () => {
    const cur = [set(0, 10, { workoutId: 'c', exerciseId: 'pullup' })]
    expect(sessionVolumePR(cur, [], { includeFirst: true })).toEqual([])
  })
})
