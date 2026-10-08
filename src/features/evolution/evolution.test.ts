import { describe, expect, it } from 'vitest'
import type { Exercise, LoggedSet, Scan, Workout } from '@/domain/types'
import {
  buildEvolution,
  compareMonths,
  consistencyGrid,
  defaultComparison,
  monthRange,
  monthSummary,
  periodStart,
  shiftMonth,
  summarize,
  weekStreaks,
  type EvolutionInput,
} from './evolution'

const ex = (id: string, over: Partial<Exercise> = {}): Exercise => ({
  id,
  name: id,
  primary: ['chest'],
  secondary: ['triceps'],
  equipment: 'barbell',
  pattern: 'horizontal_push',
  compound: true,
  increment: 2.5,
  restSec: 120,
  cues: [],
  mistakes: [],
  videos: [],
  ...over,
})
const EXERCISES: Record<string, Exercise> = {
  bench: ex('bench'),
  squat: ex('squat', { primary: ['quads'], secondary: ['glutes'], pattern: 'squat' }),
  curl: ex('curl', { primary: ['biceps'], secondary: [], compound: false }),
  'leg-press': ex('leg-press', { primary: ['quads'], equipment: 'plate_loaded', pattern: 'squat' }),
}
const lookup = (id: string) => EXERCISES[id] ?? ex(id)

/** Local wall-clock ISO (no zone), as the sets are bucketed in local time. */
const at = (y: number, m: number, d: number, h = 10) =>
  `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T${String(h).padStart(2, '0')}:00:00`

let n = 0
const set = (workoutId: string, doneAt: string, over: Partial<LoggedSet> = {}): LoggedSet => ({
  id: `s${n++}`,
  workoutId,
  exerciseId: 'bench',
  exerciseIndex: 0,
  setIndex: 0,
  kind: 'work',
  weight: 80,
  reps: 8,
  rir: 2,
  doneAt,
  ...over,
})
const workout = (id: string, startedAt: string, over: Partial<Workout> = {}) => ({
  id,
  name: `Sesión ${id}`,
  startedAt,
  endedAt: startedAt,
  ...over,
})
const scan = (date: string, peso: number, grasa: number, musculo: number): Scan => ({
  date,
  peso,
  grasa,
  musculo,
  grasaKg: null,
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

const NOW = new Date(2026, 9, 7, 12) // Wednesday 7 Oct 2026

function input(over: Partial<EvolutionInput>): EvolutionInput {
  return { workouts: [], sets: [], scans: [], lookup, now: NOW, ...over }
}

describe('month keys', () => {
  it('shifts across years', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftMonth('2025-11', 3)).toBe('2026-02')
    expect(monthRange('2025-11', '2026-02')).toEqual(['2026-02', '2026-01', '2025-12', '2025-11'])
  })
  it('starts periods at local midnight', () => {
    expect(periodStart('3m', NOW)).toEqual(new Date(2026, 6, 7))
    expect(periodStart('1y', NOW)).toEqual(new Date(2025, 9, 7))
    expect(periodStart('all', NOW)).toBeNull()
  })
})

describe('buildEvolution', () => {
  it('groups by local month, skips empty months and crosses the year', () => {
    const ev = buildEvolution(
      input({
        workouts: [workout('a', at(2025, 12, 30)), workout('b', at(2026, 2, 3))],
        sets: [set('a', at(2025, 12, 30)), set('b', at(2026, 2, 3), { weight: 90 })],
        scans: [scan('2026-01-15', 78, 15, 37)],
        now: new Date(2026, 1, 20),
      }),
    )
    expect(ev.months.map((m) => m.key)).toEqual(['2026-02', '2026-01', '2025-12'])
    const jan = monthSummary(ev, '2026-01')
    expect(jan.sessions).toBe(0)
    expect(jan.scans).toHaveLength(1)
    // February's previous calendar month (January) had no sessions: no delta.
    expect(monthSummary(ev, '2026-02').prev).toBeNull()
    // The lift change still compares with the last month it was trained (December).
    const febBench = monthSummary(ev, '2026-02').lifts[0]!
    expect(febBench.exerciseId).toBe('bench')
    expect(febBench.change).toBeCloseTo(febBench.best - monthSummary(ev, '2025-12').lifts[0]!.best)
    expect(ev.monthKeys).toEqual(['2026-02', '2026-01', '2025-12'])
    expect(ev.firstDate).toBe('2025-12-30')
  })

  it('returns an empty month for months without data', () => {
    const ev = buildEvolution(input({}))
    const m = monthSummary(ev, '2026-05')
    expect(m.sessions).toBe(0)
    expect(m.perWeek).toBeNull()
    expect(m.label).toBe('Mayo 2026')
    expect(ev.months).toEqual([])
    expect(ev.monthKeys).toEqual(['2026-10'])
  })

  it('counts an imported session without plan and ignores unfinished ones', () => {
    const ev = buildEvolution(
      input({
        workouts: [
          { ...workout('imp', at(2026, 9, 1)), programId: null, dayId: null },
          workout('live', at(2026, 10, 7), { endedAt: null }),
        ],
        sets: [
          set('imp', at(2026, 9, 1), { exerciseId: 'curl', weight: 15, reps: 10 }),
          set('imp', at(2026, 9, 1), { kind: 'warmup', weight: 10, reps: 10 }),
          set('live', at(2026, 10, 7)),
        ],
      }),
    )
    expect(ev.sessions.map((s) => s.id)).toEqual(['imp'])
    const sep = monthSummary(ev, '2026-09')
    expect(sep.sessions).toBe(1)
    expect(sep.sets).toBe(1)
    expect(sep.tonnage).toBe(150)
    expect(sep.muscles).toEqual({ biceps: 1 })
    expect(sep.milestones.map((x) => x.kind)).toContain('first_workout')
    expect(monthSummary(ev, '2026-10').sessions).toBe(0)
  })

  it('keeps one record per set, in the month it was broken, and deltas against last month', () => {
    const ev = buildEvolution(
      input({
        workouts: [workout('a', at(2026, 8, 10)), workout('b', at(2026, 9, 10))],
        sets: [
          set('a', at(2026, 8, 10), { weight: 80, reps: 8 }),
          set('b', at(2026, 9, 10), { weight: 85, reps: 8 }),
          set('b', at(2026, 9, 10, 11), { setIndex: 1, weight: 85, reps: 8 }),
        ],
      }),
    )
    const sep = monthSummary(ev, '2026-09')
    // 85×8 beats e1RM, weight and reps-at-weight: one line, the 1RM.
    expect(sep.records).toHaveLength(1)
    expect(sep.records[0]!.kind).toBe('e1rm')
    expect(sep.prev).toEqual({ sets: 1, tonnage: 640 })
    expect(sep.tonnage).toBe(1360)
    expect(sep.milestones.map((m) => m.kind)).toEqual(
      expect.arrayContaining(['session_record', 'best_volume_month']),
    )
  })

  it('marks session count, muscle maximum and fat minimum milestones', () => {
    const workouts = Array.from({ length: 10 }, (_, i) => workout(`w${i}`, at(2026, 9, 1 + i * 2)))
    const ev = buildEvolution(
      input({
        workouts,
        sets: workouts.map((w) => set(w.id, w.startedAt, { weight: 50 })),
        scans: [
          scan('2025-06-10', 80, 18, 36),
          scan('2025-12-10', 79, 14, 37.5),
          scan('2026-09-10', 78, 15, 37.2),
        ],
      }),
    )
    expect(monthSummary(ev, '2026-09').milestones.map((m) => m.text)).toContain('Sesión n.º 10')
    expect(monthSummary(ev, '2025-12').milestones.map((m) => m.kind)).toEqual([
      'max_muscle',
      'min_fat',
    ])
    expect(ev.firstDate).toBe('2025-06-10')
  })
})

describe('summarize', () => {
  it('limits sessions and scans to the period and diffs first → last scan', () => {
    const ev = buildEvolution(
      input({
        workouts: [workout('old', at(2026, 3, 1)), workout('new', at(2026, 9, 1))],
        sets: [set('old', at(2026, 3, 1)), set('new', at(2026, 9, 1))],
        scans: [
          scan('2026-03-01', 80, 17, 36),
          scan('2026-08-01', 79, 16, 36.5),
          scan('2026-09-10', 78, 15, 37),
        ],
      }),
    )
    const s = summarize(ev, periodStart('3m', NOW))
    expect(s.sessions).toBe(1)
    expect(s.sets).toBe(1)
    expect(s.firstScan?.date).toBe('2026-08-01')
    expect(s.body.map((d) => [d.metric, d.diff, d.tone])).toEqual([
      ['peso', -1, 'neutral'],
      ['grasa', -1, 'good'],
      ['musculo', 0.5, 'good'],
    ])
    expect(summarize(ev, null).sessions).toBe(2)
  })
})

describe('consistencyGrid', () => {
  it('lays 26 weeks Monday → Sunday with today in the last column', () => {
    const grid = consistencyGrid(
      [
        { day: '2026-10-05', effective: 20 },
        { day: '2026-10-06', effective: 5 },
      ],
      NOW,
    )
    expect(grid).toHaveLength(26)
    const last = grid.at(-1)!
    expect(last.start).toBe('2026-10-05')
    expect(last.days[0]).toMatchObject({ sessions: 1, level: 3 })
    expect(last.days[1]).toMatchObject({ sessions: 1, level: 1 })
    expect(last.days[2]).toMatchObject({ level: 0, future: false })
    expect(last.days[3]!.future).toBe(true)
    expect(grid[0]!.start).toBe('2026-04-13')
  })
})

describe('weekStreaks', () => {
  const sessionsOn = (...days: [number, number, number][]) =>
    days.map(([y, m, d]) => ({ startedAt: at(y, m, d) }))

  it('counts weeks across months and keeps the open week from breaking the streak', () => {
    // Weeks of 21 Sep, 28 Sep (crosses into October) meet 2 sessions; this week only 1 so far.
    const s = sessionsOn([2026, 9, 21], [2026, 9, 23], [2026, 9, 30], [2026, 10, 2], [2026, 10, 6])
    expect(weekStreaks(s, 2, NOW)).toEqual({ current: 2, best: 2, thisWeek: 1, target: 2 })
  })

  it('includes the current week once met and remembers the best run', () => {
    const s = sessionsOn(
      [2026, 8, 3],
      [2026, 8, 10],
      [2026, 8, 17],
      // gap: week of 24 Aug
      [2026, 9, 28],
      [2026, 10, 6],
    )
    expect(weekStreaks(s, 1, NOW)).toMatchObject({ current: 2, best: 3 })
  })

  it('crosses the new year', () => {
    const s = sessionsOn([2025, 12, 22], [2025, 12, 29], [2026, 1, 5])
    expect(weekStreaks(s, 1, new Date(2026, 0, 7))).toMatchObject({ current: 3, best: 3 })
    expect(weekStreaks([], 3, NOW)).toEqual({ current: 0, best: 0, thisWeek: 0, target: 3 })
  })
})

describe('compareMonths', () => {
  it('diffs B − A with tone per metric, empty months included', () => {
    const ev = buildEvolution(
      input({
        workouts: [workout('a', at(2026, 7, 6)), workout('b', at(2026, 10, 5))],
        sets: [
          set('a', at(2026, 7, 6), { weight: 80 }),
          set('b', at(2026, 10, 5), { weight: 90 }),
          set('b', at(2026, 10, 5), { setIndex: 1, exerciseId: 'curl', weight: 15 }),
        ],
        scans: [scan('2026-07-20', 79, 16, 36), scan('2026-10-02', 79.5, 16.5, 37)],
      }),
    )
    const { a, b } = defaultComparison(ev)
    expect([a, b]).toEqual(['2026-07', '2026-10'])
    const rows = compareMonths(ev, a, b)
    const find = (pred: (r: (typeof rows)[number]) => boolean) => rows.find(pred)!
    expect(
      find((r) => r.subject.group === 'training' && r.subject.metric === 'sets'),
    ).toMatchObject({ a: 1, b: 2, diff: 1, tone: 'good' })
    expect(
      find((r) => r.subject.group === 'muscle' && r.subject.muscle === 'biceps'),
    ).toMatchObject({ a: 0, b: 1, tone: 'good' })
    expect(find((r) => r.subject.group === 'lift').tone).toBe('good')
    expect(find((r) => r.subject.group === 'body' && r.subject.metric === 'grasa').tone).toBe('bad')
    expect(find((r) => r.subject.group === 'body' && r.subject.metric === 'peso').tone).toBe(
      'neutral',
    )
    // A month with nothing at all compares as zeros, without lifts or body rows.
    const empty = compareMonths(ev, '2026-08', '2026-09')
    expect(empty.every((r) => r.subject.group === 'training' && r.a === 0 && r.b === 0)).toBe(true)
  })
})

describe('main lifts', () => {
  it('leaves machines and plate-loaded lifts out of the 1RM block', () => {
    const ev = buildEvolution(
      input({
        workouts: [workout('a', at(2026, 9, 1)), workout('b', at(2026, 9, 8))],
        sets: [
          set('a', at(2026, 9, 1), { exerciseId: 'leg-press', weight: 200 }),
          set('b', at(2026, 9, 8), { exerciseId: 'leg-press', weight: 210 }),
          set('b', at(2026, 9, 8), { exerciseId: 'bench' }),
        ],
      }),
    )
    expect(ev.mainLiftIds).toEqual(['bench'])
    expect(ev.months.flatMap((m) => m.lifts.map((l) => l.exerciseId))).toEqual(['bench'])
  })
})
