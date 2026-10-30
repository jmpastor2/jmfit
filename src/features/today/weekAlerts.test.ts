import { describe, expect, it } from 'vitest'
import type { WorkoutFull } from '@/data/rows'
import type { LoggedSet, Muscle, ProgramDay, Slot } from '@/domain/types'
import {
  lostLine,
  recoverSentence,
  remainingDays,
  sessionSkips,
  setsByMuscle,
  skipsLine,
  volumeGaps,
  weekSkips,
} from './weekAlerts'

const EX: Record<string, { primary: Muscle[]; secondary: Muscle[]; name: string }> = {
  bench: { primary: ['chest'], secondary: ['triceps', 'front_delts'], name: 'Press banca' },
  row: { primary: ['back'], secondary: ['biceps'], name: 'Remo' },
  curl: { primary: ['biceps'], secondary: ['forearms'], name: 'Curl' },
  hammer: { primary: ['biceps', 'forearms'], secondary: [], name: 'Curl martillo' },
  pushdown: { primary: ['triceps'], secondary: [], name: 'Extensión polea' },
  rdl: { primary: ['hamstrings'], secondary: ['glutes'], name: 'Peso muerto rumano' },
  legcurl: { primary: ['hamstrings'], secondary: [], name: 'Curl femoral' },
  calf: { primary: ['calves'], secondary: [], name: 'Gemelos de pie' },
  squat: { primary: ['quads'], secondary: ['glutes'], name: 'Sentadilla' },
}
const lookup = (id: string) => EX[id] ?? { primary: [], secondary: [] }
const name = (id: string) => EX[id]?.name ?? id

let n = 0
const slot = (exerciseId: string, sets = 3): Slot => ({
  id: `slot${++n}`,
  exerciseId,
  sets,
  repMin: 8,
  repMax: 12,
  rir: 2,
  restSec: 90,
})
const day = (id: string, weekday: number | null, slots: Slot[]): ProgramDay => ({
  id,
  name: id,
  focus: '',
  weekday,
  slots,
})

/** Local time. 2026-10-12 is a Monday, 2026-10-18 a Sunday. */
const at = (d: number, h = 18, m = 0) => new Date(2026, 9, d, h, m).toISOString()

const set = (
  workoutId: string,
  exerciseId: string,
  doneAt: string,
  kind: LoggedSet['kind'] = 'work',
): LoggedSet => ({
  id: `s${++n}`,
  workoutId,
  exerciseId,
  exerciseIndex: 0,
  setIndex: n,
  kind,
  weight: 20,
  reps: 10,
  rir: 2,
  doneAt,
})
const workout = (id: string, startedAt: string, plan: Slot[], ended = true): WorkoutFull => ({
  id,
  name: id,
  programId: 'p',
  dayId: id,
  startedAt,
  endedAt: ended ? startedAt : null,
  notes: null,
  sessionRpe: null,
  bodyweight: null,
  deload: false,
  plan,
})

describe('planned sets per muscle', () => {
  it('counts primary 1 and secondary 0.5 per set', () => {
    expect(setsByMuscle([slot('bench', 4), slot('curl', 3)], lookup)).toEqual({
      chest: 4,
      triceps: 2,
      front_delts: 2,
      biceps: 3,
      forearms: 1.5,
    })
  })
})

describe('remaining days', () => {
  const days = [
    day('Pierna', 0, []),
    day('Torso', 2, []),
    day('Brazos', 4, []),
    day('Pierna B', 5, []),
  ]
  const thu = new Date(2026, 9, 15, 10)
  it('fixed plan: later weekdays not done, today only if not trained', () => {
    expect(remainingDays(days, new Set(['Pierna']), thu, false).map((d) => d.id)).toEqual([
      'Brazos',
      'Pierna B',
    ])
    const fri = new Date(2026, 9, 16, 10)
    expect(remainingDays(days, new Set(), fri, true).map((d) => d.id)).toEqual(['Pierna B'])
    expect(remainingDays(days, new Set(), fri, false).map((d) => d.id)).toEqual([
      'Brazos',
      'Pierna B',
    ])
  })
  it('floating plan: pending days, capped by calendar days left', () => {
    const floating = days.map((d) => day(d.id, null, d.slots))
    const sat = new Date(2026, 9, 17, 10)
    expect(remainingDays(floating, new Set(['Pierna']), sat, true).map((d) => d.id)).toEqual([
      'Torso',
    ])
  })
})

describe('volume gaps', () => {
  // Torso (Wed) has bench + row; Brazos (Fri) curls and pushdowns; Pierna (Mon).
  const pierna = day('Pierna', 0, [slot('squat', 4), slot('rdl', 3)])
  const torso = day('Torso', 2, [slot('bench', 4), slot('row', 4), slot('curl', 3)])
  const brazos = day('Brazos', 4, [slot('curl', 4), slot('hammer', 3), slot('pushdown', 4)])
  const days = [pierna, torso, brazos]

  it('flags what cannot be made up and names the day that can help', () => {
    // Thursday. Pierna done in full; Torso done without the curls.
    const now = new Date(2026, 9, 15, 10)
    const sets = [
      ...Array.from({ length: 4 }, () => set('w1', 'squat', at(12))),
      ...Array.from({ length: 3 }, () => set('w1', 'rdl', at(12))),
      ...Array.from({ length: 4 }, () => set('w2', 'bench', at(14))),
      ...Array.from({ length: 4 }, () => set('w2', 'row', at(14))),
    ]
    const gaps = volumeGaps({
      days,
      sets,
      doneDayIds: new Set(['Pierna', 'Torso']),
      trainedToday: false,
      lookup,
      now,
      focus: ['biceps', 'triceps'],
    })
    // Biceps: planned 3+4+3+row 2 = 12; done 2 (row); ahead 7 (Brazos) → missing 3.
    const bi = gaps.find((g) => g.muscle === 'biceps')!
    expect(bi).toMatchObject({ planned: 12, done: 2, ahead: 7, missing: 3 })
    expect(bi.recoverDays.map((d) => d.id)).toEqual(['Brazos'])
    expect(recoverSentence(bi, now)).toBe('Te queda Brazos el viernes para recuperar.')
    // Forearms behind too (curls skipped): 1.5 planned in Torso.
    expect(gaps.map((g) => g.muscle)).toContain('forearms')
    // Triceps: bench done (2) + pushdowns ahead (4) = planned 6 → not behind.
    expect(gaps.find((g) => g.muscle === 'triceps')).toBeUndefined()
  })

  it('keeps the top 3 plus the focus muscles that are behind', () => {
    // Sunday evening, nothing done at all, no days ahead.
    const now = new Date(2026, 9, 18, 22)
    const gaps = volumeGaps({
      days,
      sets: [],
      doneDayIds: new Set(),
      trainedToday: false,
      lookup,
      now,
      focus: ['biceps', 'triceps'],
      limit: 3,
    })
    expect(gaps.map((g) => g.muscle)).toEqual(['biceps', 'forearms', 'triceps', 'back', 'chest'])
    const tri = gaps.find((g) => g.muscle === 'triceps')!
    expect(recoverSentence(tri, now)).toMatch(/^No queda ningún día/)
  })

  it('a set done Monday 00:30 counts for the new week, Sunday 23:30 for the old one', () => {
    const now = new Date(2026, 9, 19, 10) // Monday
    const sets = [
      set('a', 'curl', new Date(2026, 9, 18, 23, 30).toISOString()),
      set('b', 'curl', new Date(2026, 9, 19, 0, 30).toISOString()),
    ]
    const gaps = volumeGaps({
      days: [day('Brazos', null, [slot('curl', 3)])],
      sets,
      doneDayIds: new Set(['Brazos']),
      trainedToday: true,
      lookup,
      now,
    })
    expect(gaps[0]).toMatchObject({ muscle: 'biceps', planned: 3, done: 1, ahead: 0, missing: 2 })
  })
})

describe('skipped vs substituted', () => {
  it('a slot with no work sets is skipped; warm-ups do not count', () => {
    const plan = [slot('rdl'), slot('calf'), slot('squat')]
    const w = workout('Pierna', at(12), plan)
    const sets = [set('Pierna', 'squat', at(12)), set('Pierna', 'rdl', at(12), 'warmup')]
    const r = sessionSkips(w, sets, lookup)
    expect(r.skipped.map((s) => s.exerciseId)).toEqual(['rdl', 'calf'])
    expect(skipsLine([r], name)).toBe('Peso muerto rumano, Gemelos de pie (Pierna)')
  })

  it('an unplanned exercise for the same primary muscle is a substitution', () => {
    const plan = [slot('rdl'), slot('curl'), slot('pushdown')]
    const w = workout('Mix', at(13), plan)
    const sets = [
      set('Mix', 'legcurl', at(13)), // replaces rdl (hamstrings)
      set('Mix', 'hammer', at(13)), // replaces curl (biceps)
      set('Mix', 'calf', at(13)), // extra, matches nothing
    ]
    const r = sessionSkips(w, sets, lookup)
    expect(r.substituted).toEqual([
      { planned: 'rdl', done: 'legcurl' },
      { planned: 'curl', done: 'hammer' },
    ])
    expect(r.skipped.map((s) => s.exerciseId)).toEqual(['pushdown'])
  })

  it('one extra exercise replaces only one slot', () => {
    const plan = [slot('curl'), slot('hammer')]
    const r = sessionSkips(
      workout('B', at(13), plan),
      [set('B', 'row', at(13)), set('B', 'curl', at(13))],
      lookup,
    )
    // row is primary back, not biceps → hammer stays skipped.
    expect(r.skipped.map((s) => s.exerciseId)).toEqual(['hammer'])
  })

  it('only finished sessions of this week, a Sunday-night session belongs to last week', () => {
    const now = new Date(2026, 9, 19, 12) // Monday
    const sunday = workout('Dom', new Date(2026, 9, 18, 23).toISOString(), [slot('calf')])
    const monday = workout('Lun', new Date(2026, 9, 19, 0, 15).toISOString(), [slot('calf')])
    const open = workout('Abierta', new Date(2026, 9, 19, 11).toISOString(), [slot('curl')], false)
    const r = weekSkips([sunday, monday, open], [], lookup, now)
    expect(r.map((x) => x.workoutId)).toEqual(['Lun'])
  })
})

describe('lostLine', () => {
  const gap = (muscle: Muscle, recover: boolean) => ({
    muscle,
    done: 0,
    planned: 10,
    ahead: 0,
    missing: 10,
    recoverDays: recover ? [{ id: 'd', name: 'Torso', focus: '', weekday: null, slots: [] }] : [],
  })
  const label = (m: Muscle) =>
    ({ glutes: 'Glúteos', quads: 'Cuádriceps', biceps: 'Bíceps' })[m as 'glutes']

  it('names in one line the muscles no day left can make up', () => {
    expect(lostLine([gap('glutes', false), gap('quads', false), gap('biceps', true)], label)).toBe(
      'Glúteos y cuádriceps se quedan cortos esta semana: ningún día que queda los trabaja.',
    )
    expect(lostLine([gap('quads', false)], label)).toBe(
      'Cuádriceps se queda corto esta semana: ningún día que queda lo trabaja.',
    )
    expect(lostLine([gap('biceps', true)], label)).toBe('')
  })
})
