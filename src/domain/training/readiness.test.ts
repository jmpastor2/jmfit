import { describe, expect, it } from 'vitest'
import type { Checkin, HealthDay } from '../types'
import { computeReadiness, readinessLevel } from './readiness'

function day(date: string, over: Partial<HealthDay> = {}): HealthDay {
  return {
    date,
    source: 'google_health',
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
    ...over,
  }
}

/** n days before 2026-10-07: HRV alternating 50/60 (mean 55), RHR 55/57 (mean 56), 7 h 30 sleep. */
function baseline(n = 14, over: Partial<HealthDay> = {}): HealthDay[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(2026, 9, 6 - i)).toISOString().slice(0, 10)
    return day(d, {
      hrvMs: i % 2 ? 50 : 60,
      restingHr: i % 2 ? 55 : 57,
      sleepMin: 450,
      ...over,
    })
  })
}

const checkin = (over: Partial<Checkin> = {}): Checkin => ({
  date: '2026-10-07',
  sleepH: null,
  sleepQuality: null,
  energy: null,
  soreness: null,
  stress: null,
  ...over,
})

describe('readinessLevel', () => {
  it('maps thresholds', () => {
    expect(readinessLevel(null)).toBe('unknown')
    expect(readinessLevel(100)).toBe('push')
    expect(readinessLevel(70)).toBe('push')
    expect(readinessLevel(69)).toBe('normal')
    expect(readinessLevel(45)).toBe('normal')
    expect(readinessLevel(44)).toBe('easy')
    expect(readinessLevel(0)).toBe('easy')
  })
})

describe('computeReadiness', () => {
  it('unknown with no data at all', () => {
    expect(computeReadiness({ baseline: [] })).toEqual({
      score: null,
      level: 'unknown',
      factors: [],
    })
    expect(computeReadiness({ baseline: baseline(), today: day('2026-10-07') })).toMatchObject({
      score: null,
      level: 'unknown',
    })
    expect(computeReadiness({ baseline: [], checkin: checkin() }).level).toBe('unknown')
  })

  it('an average day is normal', () => {
    const r = computeReadiness({
      today: day('2026-10-07', { hrvMs: 55, restingHr: 56, sleepMin: 450 }),
      baseline: baseline(),
    })
    // hrv 50, rhr 50, sleep 0.6·100 + 0.4·50 = 80 → (17.5 + 7.5 + 20) / 0.75 = 60
    expect(r.score).toBe(60)
    expect(r.level).toBe('normal')
    expect(r.factors).toEqual([
      'HRV en tu media',
      'FC en reposo en tu media',
      'Dormiste 7 h 30 min',
    ])
  })

  it('high HRV, low HR and good sleep push', () => {
    const r = computeReadiness({
      today: day('2026-10-07', { hrvMs: 61.6, restingHr: 54, sleepMin: 480 }),
      baseline: baseline(),
    })
    expect(r.level).toBe('push')
    expect(r.factors).toContain('HRV 12 % por encima de tu media')
    expect(r.factors).toContain('FC en reposo 2 lpm por debajo de tu media')
    expect(r.factors).toContain('Dormiste 8 h')
  })

  it('poor recovery is easy', () => {
    const r = computeReadiness({
      today: day('2026-10-07', { hrvMs: 40, restingHr: 62, sleepMin: 370 }),
      baseline: baseline(),
      checkin: checkin({ energy: 2, soreness: 4, stress: 4, sleepQuality: 2 }),
    })
    expect(r.level).toBe('easy')
    expect(r.score).toBeLessThan(45)
    expect(r.factors).toEqual([
      'HRV 27 % por debajo de tu media',
      'FC en reposo 6 lpm por encima de tu media',
      'Dormiste 6 h 10 min',
      'Energía baja',
      'Agujetas fuertes',
      'Estrés alto',
      'Sueño de mala calidad',
    ])
  })

  it('clamps extreme z-scores', () => {
    const r = computeReadiness({ today: day('2026-10-07', { hrvMs: 500 }), baseline: baseline() })
    expect(r.score).toBe(100)
    const low = computeReadiness({ today: day('2026-10-07', { hrvMs: 1 }), baseline: baseline() })
    expect(low.score).toBe(0)
  })

  it('a flat baseline does not explode tiny changes (SD floor)', () => {
    const flat = baseline(14, { hrvMs: 50 })
    const r = computeReadiness({ today: day('2026-10-07', { hrvMs: 51 }), baseline: flat })
    // SD floored at 2.5 ms → z = 0.4 → 60
    expect(r.score).toBe(60)
  })

  it('needs 7 baseline days for HRV and HR', () => {
    const r = computeReadiness({
      today: day('2026-10-07', { hrvMs: 70, restingHr: 50 }),
      baseline: baseline(6),
    })
    expect(r.score).toBeNull()
    expect(r.factors).toEqual(['HRV: faltan datos para tu media (6 de 7 días)'])
  })

  it('excludes today and future days from the baseline and keeps the last 28', () => {
    const base = [
      ...baseline(40),
      day('2026-10-07', { hrvMs: 1000 }),
      day('2026-10-09', { hrvMs: 1000 }),
    ]
    const r = computeReadiness({ today: day('2026-10-07', { hrvMs: 55 }), baseline: base })
    expect(r.score).toBe(50)
  })

  it('falls back to check-in sleep hours', () => {
    const r = computeReadiness({ baseline: [], checkin: checkin({ sleepH: 6 }) })
    // absolute only (no baseline): (360 − 270) / 180 = 50
    expect(r.score).toBe(50)
    expect(r.factors).toEqual(['Dormiste 6 h'])
  })

  it('sleep is compared with your own average', () => {
    const short = computeReadiness({
      today: day('2026-10-07', { sleepMin: 450 }),
      baseline: baseline(14, { sleepMin: 510 }),
    })
    // abs 100, rel 50 − 25 = 25 → 0.6·100 + 0.4·25 = 70
    expect(short.score).toBe(70)
  })

  it('check-in alone', () => {
    const best = computeReadiness({
      baseline: [],
      checkin: checkin({ energy: 5, soreness: 1, stress: 1, sleepQuality: 5 }),
    })
    expect(best).toEqual({ score: 100, level: 'push', factors: ['Energía alta'] })
    const partial = computeReadiness({ baseline: [], checkin: checkin({ energy: 3 }) })
    expect(partial.score).toBe(50)
    const outOfScale = computeReadiness({ baseline: [], checkin: checkin({ energy: 9 }) })
    expect(outOfScale.score).toBe(100)
  })

  it('missing components renormalise the weights', () => {
    const onlyHrv = computeReadiness({
      today: day('2026-10-07', { hrvMs: 55 }),
      baseline: baseline(),
    })
    expect(onlyHrv.score).toBe(50)
    expect(onlyHrv.factors).toEqual(['HRV en tu media'])
  })
})
