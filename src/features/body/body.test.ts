import { describe, expect, it } from 'vitest'
import type { HealthDay, Scan } from '@/domain/types'
import { emptyScan, parseBoditraxCsv, parseBoditraxDate, splitCsvLine } from './boditrax'
import { recoveryStats, trendTone } from './recovery'
import {
  compareScans,
  deltaTone,
  formatInt,
  formatSigned,
  longDate,
  metricDelta,
  parseDecimal,
  scanBefore,
} from './scans'

const CSV = [
  'User Details',
  'Name,Jose Manuel',
  '',
  'User Scan Details',
  'BodyMetricTypeId,Value,CreatedDate',
  'BodyWeight,78.4,10/09/2026 18:32:11',
  'FatMass,11.8,10/09/2026 18:32:11',
  'MuscleMass,63.1,10/09/2026 18:32:11',
  'BasalMetabolicRatekJ,7531,10/09/2026 18:32:11',
  'VisceralFatRating,5,10/09/2026 18:32:11',
  'BoditraxScore,312,10/09/2026 18:32:11',
  'UnknownMetric,4,10/09/2026',
  '',
  'User Scan Details',
  'BodyMetricTypeId,Value,CreatedDate',
  'BodyWeight,77,9,12/08/2026',
  '"FatMass","12,4","12/08/2026"',
  'MetabolicAge,24,12/08/2026',
  'IntraCellularWaterMass,27,3,12/08/2026',
  'LegMuscleScore,95,12/08/2026',
  'BoneMass,abc,12/08/2026',
].join('\r\n')

describe('boditrax parser', () => {
  it('splits quoted cells', () => {
    expect(splitCsvLine('"FatMass","12,4","12/08/2026"')).toEqual(['FatMass', '12,4', '12/08/2026'])
  })

  it('reads dates as dd/mm/yyyy and rejects impossible ones', () => {
    expect(parseBoditraxDate('10/09/2026')).toBe('2026-09-10')
    expect(parseBoditraxDate('1/2/2026 07:00')).toBe('2026-02-01')
    expect(parseBoditraxDate('31/02/2026')).toBeNull()
    expect(parseBoditraxDate('CreatedDate')).toBeNull()
  })

  it('groups metrics by date, converts kJ and derives % fat', () => {
    const { scans, skipped } = parseBoditraxCsv(CSV)
    expect(skipped).toBe(1) // BoneMass,abc
    expect(scans.map((s) => s.date)).toEqual(['2026-08-12', '2026-09-10'])
    const [aug, sep] = scans as [Scan, Scan]
    expect(sep.peso).toBe(78.4)
    expect(sep.grasaKg).toBe(11.8)
    expect(sep.grasa).toBe(15.1)
    expect(sep.musculo).toBe(63.1)
    expect(sep.tmb).toBe(1800) // 7531 / 4.184
    expect(sep.visceral).toBe(5)
    expect(sep.score).toBe(312)
    // value split by a decimal comma over two columns
    expect(aug.peso).toBe(77.9)
    expect(aug.grasaKg).toBe(12.4)
    expect(aug.aguaIntra).toBe(27.3)
    expect(aug.edadMet).toBe(24)
    expect(aug.legScore).toBe(95)
    expect(aug.hueso).toBeNull()
  })

  it('drops dates without a body weight', () => {
    const { scans } = parseBoditraxCsv('MuscleMass,60,01/01/2026')
    expect(scans).toEqual([])
  })
})

const scan = (date: string, peso: number, grasa: number, musculo: number): Scan => ({
  ...emptyScan(date),
  peso,
  grasa,
  musculo,
})

describe('scan helpers', () => {
  const scans = [
    scan('2026-05-01', 80, 17, 61),
    scan('2026-06-10', 79, 16, 62),
    scan('2026-08-12', 78, 15.5, 62.5),
    scan('2026-09-10', 78.4, 15.1, 63.1),
  ]

  it('finds the scan at least 90 days back', () => {
    expect(scanBefore(scans, '2026-09-10', 90)?.date).toBe('2026-06-10')
    expect(scanBefore(scans, '2026-05-10', 90)).toBeNull()
  })

  it('more muscle and less fat are good news; weight is neutral', () => {
    expect(deltaTone('musculo', 0.6)).toBe('good')
    expect(deltaTone('grasa', 0.3)).toBe('bad')
    expect(deltaTone('visceral', -1)).toBe('good')
    expect(deltaTone('peso', 2)).toBe('neutral')
    expect(deltaTone('musculo', 0)).toBe('neutral')
  })

  it('compares two scans', () => {
    const rows = compareScans(scans[0]!, scans[3]!)
    expect(rows.map((r) => r.metric)).toEqual(['peso', 'grasa', 'musculo'])
    expect(rows.find((r) => r.metric === 'grasa')).toMatchObject({ diff: -1.9, tone: 'good' })
    expect(metricDelta('musculo', null, scans[0]!)).toMatchObject({ diff: null, tone: 'neutral' })
  })

  it('formats signed changes and parses typed decimals', () => {
    expect(formatSigned('peso', 0.4)).toBe('+0,4')
    expect(formatSigned('grasa', -1.25)).toBe('−1,3')
    expect(formatSigned('peso', 0.01)).toBe('0')
    expect(parseDecimal(' 78,4 ')).toBe(78.4)
    expect(parseDecimal('')).toBeNull()
    expect(parseDecimal('7a')).toBeNull()
    expect(longDate('2026-09-10')).toBe('10 sep 2026')
    expect(formatInt(10234.4)).toBe('10.234')
    expect(formatInt(950)).toBe('950')
  })
})

const day = (date: string, patch: Partial<HealthDay>): HealthDay => ({
  date,
  source: 'manual',
  sleepMin: null,
  deepMin: null,
  remMin: null,
  lightMin: null,
  awakeMin: null,
  restingHr: null,
  hrvMs: null,
  steps: null,
  activeKcal: null,
  vo2max: null,
  weight: null,
  bodyFat: null,
  ...patch,
})

describe('recovery stats', () => {
  const today = new Date(2026, 9, 7, 9)
  const days: HealthDay[] = []
  for (let i = 0; i < 35; i++) {
    const d = new Date(2026, 9, 7 - i)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    days.push(day(key, { hrvMs: i < 7 ? 40 : 50, sleepMin: 420 }))
  }

  it('keeps 30 days and averages the 7- and 28-day windows', () => {
    const s = recoveryStats(days, 'hrvMs', today)
    expect(s.points).toHaveLength(30)
    expect(s.points[0]!.x).toBe('2026-09-08')
    expect(s.mean7).toBe(40)
    expect(s.n28).toBe(28)
    expect(s.mean28).toBeCloseTo((7 * 40 + 21 * 50) / 28)
    expect(trendTone('hrvMs', s)).toBe('bad')
  })

  it('shows sleep in hours', () => {
    const s = recoveryStats(days, 'sleepMin', today)
    expect(s.mean7).toBe(7)
    expect(trendTone('sleepMin', s)).toBe('neutral')
  })

  it('handles no data', () => {
    const s = recoveryStats([], 'steps', today)
    expect(s).toMatchObject({ points: [], mean7: null, mean28: null })
  })
})
