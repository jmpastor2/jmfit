import { describe, expect, it } from 'vitest'
import {
  dailyWeights,
  dayPhrase,
  rateVerdict,
  weekMean,
  weeklyRate,
  weightEntries,
  weightSourceLabel,
  weightSummary,
  type WeightEntry,
} from './weight'

/** Local times. 2026-10-18 is a Sunday. */
const NOW = new Date(2026, 9, 18, 12)
const iso = (day: number, h = 19, month = 9) => new Date(2026, month, day, h).toISOString()
const key = (day: number, month = 10) =>
  `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

const w = (day: number, bodyweight: number | null, endedH = 20, ended = true) => ({
  startedAt: iso(day, 18),
  endedAt: ended ? iso(day, endedH) : null,
  bodyweight,
})
const scan = (date: string, peso: number | null) => ({ date, peso })
const pt = (date: string, value: number): WeightEntry => ({
  date,
  value,
  source: 'workout',
  at: Date.parse(date + 'T20:00:00'),
})

describe('daily bodyweight points', () => {
  it('keeps finished sessions and scans with a plausible weight', () => {
    const e = weightEntries(
      [w(10, 78.1), w(11, null), w(12, 79.6, 20, false), w(13, 0)],
      [scan('2026-10-10', 76.4), scan('2026-10-01', null)],
    )
    expect(e.map((x) => [x.date, x.value, x.source])).toEqual([
      ['2026-10-10', 78.1, 'workout'],
      ['2026-10-10', 76.4, 'scan'],
    ])
  })

  it('keeps the last measurement of each day, oldest first', () => {
    const daily = dailyWeights(
      weightEntries([w(10, 78.1, 20), w(9, 77)], [scan('2026-10-10', 76.4)]),
    )
    // The scan sits at noon, the session ended at 20:00 → the session wins.
    expect(daily.map((d) => [d.date, d.value])).toEqual([
      ['2026-10-09', 77],
      ['2026-10-10', 78.1],
    ])
  })

  it('a session started late Sunday stays on Sunday even if it ends on Monday', () => {
    const e = weightEntries([{ startedAt: iso(11, 23), endedAt: iso(12, 1), bodyweight: 77 }], [])
    expect(e[0]!.date).toBe('2026-10-11')
  })
})

describe('mean and weekly rate', () => {
  it('averages the last 7 days, today included', () => {
    const daily = [pt(key(11), 80), pt(key(12), 78), pt(key(18), 76)]
    expect(weekMean(daily, NOW)).toBe(77)
    expect(weekMean([pt(key(1), 80)], NOW)).toBeNull()
  })

  it('fits a slope over the last 21 days in kg per week', () => {
    // −0.1 kg per day for 15 days → −0.7 kg/week.
    const daily = Array.from({ length: 15 }, (_, i) => pt(key(4 + i), 80 - 0.1 * i))
    expect(weeklyRate(daily, NOW)).toBeCloseTo(-0.7, 6)
  })

  it('ignores points older than 21 days', () => {
    const daily = [pt(key(1, 9), 90), pt(key(10), 78), pt(key(14), 78), pt(key(18), 78)]
    expect(weeklyRate(daily, NOW)).toBeCloseTo(0, 6)
  })

  it('needs 3 points spanning at least 6 days', () => {
    expect(weeklyRate([pt(key(10), 78), pt(key(18), 77)], NOW)).toBeNull()
    expect(weeklyRate([pt(key(16), 78), pt(key(17), 77), pt(key(18), 76)], NOW)).toBeNull()
  })

  it('reads the October sessions: 78,1 → 79,6 → 77,5 → 76 → 76 plus the scan', () => {
    const s = weightSummary(
      [w(10, 78.1), w(12, 79.6), w(14, 77.5), w(16, 76), w(17, 76)],
      [scan('2026-10-10', 76.4)],
      'hypertrophy',
      NOW,
    )
    expect(s.latest).toMatchObject({ date: '2026-10-17', value: 76, source: 'workout' })
    expect(s.daily).toHaveLength(5) // the scan day keeps the session weight
    expect(s.rate).toBeLessThan(-0.5)
    expect(s.verdict).toMatch(
      /^Bajas \d+(,\d)? kg\/semana: si buscas ganar músculo, te falta comida\.$/,
    )
    expect(s.chart).toHaveLength(5)
    expect(s.rateBasis).toBe(
      '5 pesos en 8 días: con tan pocos días pesa mucho el agua, tómalo como orientación',
    )
  })
})

describe('verdict', () => {
  it('hypertrophy', () => {
    expect(rateVerdict(-0.6, 'hypertrophy', 78)).toBe(
      'Bajas 0,6 kg/semana: si buscas ganar músculo, te falta comida.',
    )
    expect(rateVerdict(0.1, 'hypertrophy', 78)).toMatch(/^Peso estable/)
    expect(rateVerdict(0.3, 'glutes', 78)).toMatch(/buen ritmo para ganar músculo/)
    expect(rateVerdict(0.8, 'hypertrophy', 78)).toMatch(/parte será grasa/)
  })

  it('cut is the opposite', () => {
    expect(rateVerdict(0.5, 'cut', 78)).toBe(
      'Subes 0,5 kg/semana: si buscas definir, te sobra comida.',
    )
    expect(rateVerdict(-0.5, 'cut', 78)).toMatch(/buen ritmo para definir/)
    expect(rateVerdict(-1, 'cut', 78)).toMatch(/demasiado rápido/)
  })

  it('maintenance accepts ±0,2', () => {
    expect(rateVerdict(0.2, 'maintenance', 78)).toMatch(/^Peso estable \(±0,2/)
    expect(rateVerdict(-0.3, 'recomp', 78)).toBe(
      'Bajas 0,3 kg/semana: por debajo de mantenimiento.',
    )
    expect(rateVerdict(null, 'maintenance', 78)).toBeNull()
  })
})

describe('labels', () => {
  it('names the day and the source', () => {
    expect(dayPhrase('2026-10-18', NOW)).toBe('hoy')
    expect(dayPhrase('2026-10-17', NOW)).toBe('ayer')
    expect(dayPhrase('2026-10-15', NOW)).toBe('el jueves')
    expect(dayPhrase('2026-10-10', NOW)).toBe('el 10 oct')
    expect(weightSourceLabel({ date: '2026-10-15', source: 'workout' }, NOW)).toBe(
      'tras la sesión del jueves',
    )
    expect(weightSourceLabel({ date: '2026-10-17', source: 'workout' }, NOW)).toBe(
      'tras la sesión de ayer',
    )
    expect(weightSourceLabel({ date: '2026-10-10', source: 'scan' }, NOW)).toBe(
      'escáner Boditrax del 10 oct',
    )
  })
})
