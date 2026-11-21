import { describe, expect, it } from 'vitest'
import { morningMessage, type MorningDay } from '../../supabase/functions/google-health/morning.ts'

const day = (date: string, over: Partial<MorningDay> = {}): MorningDay => ({
  date,
  sleep_min: 450,
  hrv_ms: '30.0',
  resting_hr: 68,
  steps: 10000,
  ...over,
})
const week = [
  '2026-11-16',
  '2026-11-17',
  '2026-11-18',
  '2026-11-19',
  '2026-11-20',
  '2026-11-21',
  '2026-11-22',
].map((d) => day(d))

describe('morningMessage', () => {
  it('tells last night and the heart against their usual', () => {
    const m = morningMessage({
      days: [...week, day('2026-11-23', { sleep_min: 463, hrv_ms: '34.4', resting_hr: 65 })],
      today: '2026-11-23',
      monday: false,
      gymSessions: 0,
      sports: 0,
    })!
    expect(m.title).toBe('Buenos días')
    expect(m.body).toBe(
      'Dormiste 7:43 h · VFC 34 ms (tu media 30) · pulso 65 (tu media 68). Tu recuperación y el entreno de hoy, en Forja.',
    )
  })

  it('says when the night was recorded in part, and stays silent with nothing new', () => {
    const m = morningMessage({
      days: [...week, day('2026-11-23', { sleep_min: 197, hrv_ms: null, resting_hr: null })],
      today: '2026-11-23',
      monday: false,
      gymSessions: 0,
      sports: 0,
    })!
    expect(m.body).toMatch(/^Noche registrada a medias \(3:17 h\)\./)
    expect(
      morningMessage({ days: week, today: '2026-11-23', monday: false, gymSessions: 0, sports: 0 }),
    ).toBeNull()
  })

  it('on Mondays sums up the week', () => {
    const m = morningMessage({
      days: [
        ...week.slice(0, 6).map((d, i) => ({ ...d, sleep_min: i === 0 ? 200 : 432 })),
        day('2026-11-23'),
      ],
      today: '2026-11-23',
      monday: true,
      gymSessions: 3,
      sports: 1,
    })!
    expect(m.title).toBe('Tu semana')
    expect(m.body).toBe(
      '3 sesiones de fuerza · 1 de deporte · sueño 7:12 h de media · 10.000 pasos al día. El resumen y qué mejorar, en Forja.',
    )
  })
})
