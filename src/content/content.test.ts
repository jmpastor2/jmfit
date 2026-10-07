import { describe, expect, it } from 'vitest'
import {
  EQUIPMENT_LABEL,
  EXERCISES,
  MUSCLE_LABEL,
  exerciseById,
  searchExercises,
} from './exercises'
import { PROGRAM_TEMPLATES, templateById } from './programs'
import { VOLUME_LANDMARKS, volumeZone } from './landmarks'
import { STRENGTH_STANDARDS, strengthLevel } from './standards'
import verified from './videos.verified.json'

describe('exercise catalog', () => {
  it('has between 140 and 180 exercises', () => {
    expect(EXERCISES.length).toBeGreaterThanOrEqual(140)
    expect(EXERCISES.length).toBeLessThanOrEqual(180)
  })

  it('gives every trend exercise a source, a reason and a video', () => {
    const trends = EXERCISES.filter((e) => e.trend)
    expect(trends.length).toBeGreaterThanOrEqual(30)
    for (const e of trends) {
      expect(e.trend!.by.trim(), e.id).not.toBe('')
      expect(e.trend!.why.trim(), e.id).not.toBe('')
      expect(e.videos.length, e.id).toBeGreaterThan(0)
    }
  })

  it('includes the cross-body lat pull-around and finds it by its gym names', () => {
    const e = exerciseById('cable-lat-pull-around')
    expect(e?.trend?.by).toMatch(/Nippard/)
    expect(e?.equipment).toBe('cable')
    expect(e?.primary).toContain('back')
    for (const q of ['lat pull-around', 'jalon cruzado', 'pull around'])
      expect(
        searchExercises(q).map((x) => x.id),
        q,
      ).toContain('cable-lat-pull-around')
  })

  it('has unique kebab-case ids', () => {
    const ids = EXERCISES.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  })

  it('has unique names', () => {
    const names = EXERCISES.map((e) => e.name.toLowerCase())
    expect(new Set(names).size).toBe(names.length)
  })

  it('has 3–5 cues and 2–3 mistakes per exercise', () => {
    for (const e of EXERCISES) {
      expect(e.cues.length, e.id).toBeGreaterThanOrEqual(3)
      expect(e.cues.length, e.id).toBeLessThanOrEqual(5)
      expect(e.mistakes.length, e.id).toBeGreaterThanOrEqual(2)
      expect(e.mistakes.length, e.id).toBeLessThanOrEqual(3)
    }
  })

  it('has sane numbers and labels', () => {
    for (const e of EXERCISES) {
      expect(e.increment, e.id).toBeGreaterThan(0)
      expect(e.restSec, e.id).toBeGreaterThan(0)
      expect(EQUIPMENT_LABEL[e.equipment], e.id).toBeTruthy()
      for (const m of [...e.primary, ...e.secondary]) expect(MUSCLE_LABEL[m], e.id).toBeTruthy()
      if (e.pattern !== 'cardio') expect(e.primary.length, e.id).toBeGreaterThan(0)
    }
  })

  it('contains the ids the data migration relies on', () => {
    for (const id of [
      'bench-press',
      'squat',
      'deadlift',
      'overhead-press',
      'seated-cable-row',
      'one-arm-dumbbell-row',
      't-bar-row',
      'assisted-pull-up-machine',
      'machine-pulldown',
      'cable-serratus',
    ]) {
      expect(exerciseById(id), id).toBeDefined()
    }
  })

  it('only uses 11-char YouTube ids that are in the verified log', () => {
    const entries = verified as { exerciseId: string; youtubeId: string }[]
    const log = new Set(entries.map((v) => `${v.exerciseId}:${v.youtubeId}`))
    for (const e of EXERCISES) {
      for (const v of e.videos) {
        expect(v.youtubeId).toMatch(/^[A-Za-z0-9_-]{11}$/)
        expect(log.has(`${e.id}:${v.youtubeId}`), `${e.id} ${v.youtubeId}`).toBe(true)
        expect(v.title && v.channel).toBeTruthy()
      }
    }
  })
})

describe('searchExercises', () => {
  it('ignores accents and case', () => {
    expect(searchExercises('jalon').map((e) => e.id)).toContain('lat-pulldown')
    expect(searchExercises('JALÓN').map((e) => e.id)).toContain('lat-pulldown')
    expect(searchExercises('biceps').length).toBeGreaterThan(0)
    expect(searchExercises('cuadriceps').map((e) => e.id)).toContain('leg-extension')
  })

  it('matches aliases', () => {
    expect(searchExercises('fondos lastrados').map((e) => e.id)).toContain('dips')
    expect(searchExercises('pec deck').map((e) => e.id)).toContain('pec-deck')
    expect(searchExercises('dominadas maquina').map((e) => e.id)).toContain('machine-pulldown')
  })

  it('ranks name prefix matches first', () => {
    expect(searchExercises('press banca')[0]?.id).toBe('bench-press')
    expect(searchExercises('remo en t')[0]?.id).toBe('t-bar-row')
  })

  it('returns everything for an empty query', () => {
    expect(searchExercises('  ').length).toBe(EXERCISES.length)
  })
})

describe('program templates', () => {
  it('has unique template ids and resolves them', () => {
    const ids = PROGRAM_TEMPLATES.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(templateById(id)?.id).toBe(id)
    expect(ids).toEqual(
      expect.arrayContaining([
        'jm-ppl-arms-5',
        'ppl-6',
        'upper-lower-4',
        'full-body-3',
        'glutes-4',
        'strength-4',
        'maintenance-3',
        'minimal-2',
      ]),
    )
  })

  it('has globally unique day and slot ids', () => {
    const days = PROGRAM_TEMPLATES.flatMap((t) => t.days)
    const dayIds = days.map((d) => d.id)
    expect(new Set(dayIds).size).toBe(dayIds.length)
    const slotIds = days.flatMap((d) => d.slots.map((s) => s.id))
    expect(new Set(slotIds).size).toBe(slotIds.length)
  })

  it('only references catalog exercises and valid prescriptions', () => {
    for (const t of PROGRAM_TEMPLATES) {
      expect(t.days.length, t.id).toBe(t.daysPerWeek)
      expect(t.mesoWeeks).toBeGreaterThan(0)
      const weekdays = t.days.map((d) => d.weekday).filter((w) => w !== null)
      expect(new Set(weekdays).size, t.id).toBe(weekdays.length)
      for (const d of t.days) {
        expect(d.slots.length, d.id).toBeGreaterThan(0)
        for (const s of d.slots) {
          expect(exerciseById(s.exerciseId), `${s.id} → ${s.exerciseId}`).toBeDefined()
          expect(s.sets, s.id).toBeGreaterThanOrEqual(1)
          expect(s.repMin, s.id).toBeGreaterThanOrEqual(1)
          expect(s.repMin, s.id).toBeLessThanOrEqual(s.repMax)
          expect(s.rir, s.id).toBeGreaterThanOrEqual(0)
          expect(s.restSec, s.id).toBeGreaterThan(0)
        }
        // Supersets come in pairs or more.
        const groups = new Map<string, number>()
        for (const s of d.slots)
          if (s.superset) groups.set(s.superset, (groups.get(s.superset) ?? 0) + 1)
        for (const n of groups.values()) expect(n).toBeGreaterThanOrEqual(2)
      }
    }
  })

  it('reproduces the user plan', () => {
    const t = templateById('jm-ppl-arms-5')!
    expect(t.mesoWeeks).toBe(6)
    expect(t.days.map((d) => d.weekday)).toEqual([0, 1, 2, 3, 4])
    const first = t.days[0]!.slots[0]!
    expect(first).toMatchObject({
      exerciseId: 'bench-press',
      sets: 4,
      repMin: 6,
      repMax: 8,
      rir: 2,
    })
    const plank = t.days[4]!.slots.find((s) => s.exerciseId === 'plank')!
    expect(plank).toMatchObject({ sets: 3, repMin: 45, repMax: 45 })
    expect(plank.note).toMatch(/segundos/i)
    const ss = t.days[4]!.slots.filter((s) => s.superset === 'A').map((s) => s.exerciseId)
    expect(ss).toEqual(['incline-dumbbell-curl', 'overhead-cable-extension'])
  })
})

describe('landmarks and standards', () => {
  it('has ordered landmarks for every muscle', () => {
    for (const [m, l] of Object.entries(VOLUME_LANDMARKS)) {
      expect(l.mv, m).toBeLessThanOrEqual(l.mev)
      expect(l.mav[0], m).toBeLessThanOrEqual(l.mav[1])
      expect(l.mav[1], m).toBeLessThanOrEqual(l.mrv)
    }
    expect(volumeZone('chest', 0)).toBe('below_mv')
    expect(volumeZone('chest', 12)).toBe('optimal')
    expect(volumeZone('chest', 30)).toBe('over_mrv')
  })

  it('has increasing strength thresholds', () => {
    for (const [id, s] of Object.entries(STRENGTH_STANDARDS)) {
      expect(exerciseById(id), id).toBeDefined()
      for (const r of [s.male, s.female])
        for (let i = 1; i < r.length; i++) expect(r[i]!).toBeGreaterThan(r[i - 1]!)
    }
  })

  it('classifies lifts', () => {
    expect(strengthLevel('bench-press', 100, 80, 'male')?.level).toBe('intermediate')
    expect(strengthLevel('squat', 200, 80, 'male')?.level).toBe('advanced')
    expect(strengthLevel('deadlift', 300, 80, 'male')?.next).toBeNull()
    const r = strengthLevel('bench-press', 90, 80, 'male')!
    expect(r.level).toBe('novice')
    expect(r.next).toMatchObject({ level: 'intermediate', e1rm: 100 })
    // Pull-ups: e1rm is the added load.
    expect(strengthLevel('pull-up', 35, 80, 'male')?.level).toBe('intermediate')
    expect(strengthLevel('curl-nope', 50, 80, 'male')).toBeNull()
    expect(strengthLevel('squat', 100, 0, 'male')).toBeNull()
  })
})
