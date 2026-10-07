import { describe, expect, it } from 'vitest'
import type { ProgramTemplate, Slot } from '@/domain/types'
import {
  move,
  programFromTemplate,
  REST_OPTIONS,
  validateProgram,
  validateSlot,
} from './programModel'

const slot = (p: Partial<Slot> = {}): Slot => ({
  id: 's',
  exerciseId: 'bench-press',
  sets: 4,
  repMin: 8,
  repMax: 10,
  rir: 2,
  restSec: 120,
  ...p,
})

describe('programFromTemplate', () => {
  it('copies days and slots with fresh ids, keeping names', () => {
    const t: ProgramTemplate = {
      id: 'ppl',
      name: 'Torso / Pierna',
      description: '',
      goal: ['hypertrophy'],
      level: ['intermediate'],
      daysPerWeek: 2,
      mesoWeeks: 5,
      days: [
        { id: 'd1', name: 'Torso', focus: 'Pecho', weekday: 0, slots: [slot({ id: 'x' })] },
        { id: 'd2', name: 'Pierna', focus: 'Cuádriceps', weekday: null, slots: [] },
      ],
    }
    let n = 0
    const p = programFromTemplate(t, '2026-10-07', () => `id${++n}`)
    expect(p).toMatchObject({
      id: 'id1',
      name: 'Torso / Pierna',
      templateId: 'ppl',
      mesoWeeks: 5,
      startedOn: '2026-10-07',
      archived: false,
    })
    expect(p.days.map((d) => [d.id, d.name])).toEqual([
      ['id2', 'Torso'],
      ['id4', 'Pierna'],
    ])
    expect(p.days[0]!.slots[0]!.id).toBe('id3')
    expect(t.days[0]!.slots[0]!.id).toBe('x') // template untouched
  })
})

describe('move', () => {
  it('moves up and down and ignores out-of-range moves', () => {
    expect(move([1, 2, 3], 0, 1)).toEqual([2, 1, 3])
    expect(move([1, 2, 3], 2, -1)).toEqual([1, 3, 2])
    expect(move([1, 2, 3], 0, -1)).toEqual([1, 2, 3])
  })
})

describe('validation', () => {
  it('flags bad slots', () => {
    expect(validateSlot(slot())).toEqual([])
    expect(validateSlot(slot({ sets: 0 }))).toHaveLength(1)
    expect(validateSlot(slot({ repMin: 12, repMax: 10 }))).toEqual([
      'Reps mín. no puede superar a reps máx.',
    ])
  })

  it('flags program-level problems', () => {
    const issues = validateProgram({
      name: ' ',
      mesoWeeks: 2,
      startedOn: '2026-10-07',
      days: [{ id: 'd', name: '', focus: '', weekday: null, slots: [slot({ id: 'q', sets: 0 })] }],
    })
    expect(issues.map((i) => i.at)).toEqual(['program', 'program', 'd', 'q'])
  })

  it('offers rests from 0:45 to 4:00 in 15 s steps', () => {
    expect(REST_OPTIONS[0]).toBe(45)
    expect(REST_OPTIONS.at(-1)).toBe(240)
    expect(REST_OPTIONS).toHaveLength(14)
  })
})
