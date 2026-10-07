import { describe, expect, it } from 'vitest'
import type { Profile } from '@/data/rows'
import { addPlate, formFromProfile, macroKcal, readNumber, validate } from './form'
import { healthErrorMessage } from './healthMessages'

const profile: Profile = {
  id: 'u',
  displayName: 'Jose Manuel',
  email: null,
  heightCm: 176,
  birthDate: '1991-03-02',
  sex: 'M',
  experience: 'intermediate',
  trainingGoal: 'hypertrophy',
  weeklyTarget: 5,
  barKg: 20,
  platesKg: [1.25, 25, 20, 10, 5, 2.5, 15],
  restSound: true,
  activeProgramId: null,
  targetKcal: 2600,
  targetProtein: 160,
  targetCarbs: null,
  targetFat: null,
  onboarded: true,
}

describe('settings form', () => {
  it('round-trips a profile into the same patch', () => {
    const f = formFromProfile(profile)
    expect(f.platesKg).toEqual([25, 20, 15, 10, 5, 2.5, 1.25])
    expect(f.targetCarbs).toBe('')
    const { patch, errors } = validate(f, '2026-10-07')
    expect(errors).toEqual({})
    expect(patch).toMatchObject({
      displayName: 'Jose Manuel',
      heightCm: 176,
      weeklyTarget: 5,
      barKg: 20,
      targetKcal: 2600,
      targetCarbs: null,
      sex: 'M',
    })
  })

  it('reads decimal commas and rejects junk', () => {
    expect(readNumber('7,5')).toBe(7.5)
    expect(readNumber(' ')).toBeNull()
    expect(readNumber('abc')).toBeNaN()
  })

  it('reports invalid fields and returns no patch', () => {
    const f = {
      ...formFromProfile(profile),
      displayName: ' ',
      weeklyTarget: '9',
      heightCm: 'x',
      birthDate: '2030-01-01',
      platesKg: [],
    }
    const { patch, errors } = validate(f, '2026-10-07')
    expect(patch).toBeNull()
    expect(Object.keys(errors).sort()).toEqual([
      'birthDate',
      'displayName',
      'heightCm',
      'platesKg',
      'weeklyTarget',
    ])
  })

  it('adds plates once, heaviest first', () => {
    expect(addPlate([20, 10], '0,5')).toEqual([20, 10, 0.5])
    expect(addPlate([20, 10], '10')).toEqual([20, 10])
    expect(addPlate([20], '-1')).toEqual([20])
  })

  it('adds up macro kcal', () => {
    expect(macroKcal(160, 300, 70)).toBe(160 * 4 + 300 * 4 + 70 * 9)
    expect(macroKcal(null, null, null)).toBeNull()
  })
})

describe('health messages', () => {
  it('explains known codes and falls back for unknown ones', () => {
    expect(healthErrorMessage('not_configured')).toMatch(/Google/)
    expect(healthErrorMessage('account_not_linked')).toMatch(/Google Health/)
    expect(healthErrorMessage('ACCOUNT_NOT_LINKED')).toBe(healthErrorMessage('account_not_linked'))
    expect(healthErrorMessage('weird')).toMatch(/weird/)
  })
})
