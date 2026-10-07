import { describe, expect, it } from 'vitest'
import type { ProgramTemplate } from '@/domain/types'
import { recommendTemplate } from './recommendTemplate'

const tpl = (id: string, p: Partial<ProgramTemplate>): ProgramTemplate => ({
  id,
  name: id,
  description: '',
  goal: ['hypertrophy'],
  level: ['intermediate'],
  daysPerWeek: 4,
  mesoWeeks: 5,
  days: [],
  ...p,
})

const me = {
  trainingGoal: 'hypertrophy' as const,
  experience: 'intermediate' as const,
  weeklyTarget: 5,
}

describe('recommendTemplate', () => {
  it('returns null without templates', () => {
    expect(recommendTemplate([], me)).toBeNull()
  })

  it('prefers goal, then level, then the closest days', () => {
    const list = [
      tpl('strength5', { goal: ['strength'], daysPerWeek: 5 }),
      tpl('hyp3', { daysPerWeek: 3 }),
      tpl('hyp5', { daysPerWeek: 5 }),
      tpl('hyp5-novice', { daysPerWeek: 5, level: ['novice'] }),
    ]
    const fit = recommendTemplate(list, me)!
    expect(fit.template.id).toBe('hyp5')
    expect(fit.reason).toBe('Pensado para hipertrofia, nivel intermedio y tus 5 días por semana.')
  })

  it('penalises more days than planned harder than fewer', () => {
    const fit = recommendTemplate(
      [tpl('six', { daysPerWeek: 6 }), tpl('four', { daysPerWeek: 4 })],
      me,
    )!
    expect(fit.template.id).toBe('four')
    expect(fit.reason).toContain('4 días por semana (tú planeas 5)')
  })

  it('falls back to a related goal and says so', () => {
    const fit = recommendTemplate(
      [
        tpl('glutes', { goal: ['glutes'], level: ['advanced'] }),
        tpl('str', { goal: ['strength'] }),
      ],
      { ...me, trainingGoal: 'recomp' },
    )!
    expect(fit.template.id).toBe('str')
    expect(fit.reason.startsWith('Lo más cercano a recomposición')).toBe(true)
  })
})
