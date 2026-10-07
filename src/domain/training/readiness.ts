/**
 * Daily readiness score (0–100) from wearable data and the subjective check-in.
 *
 * Components (each scored 0–100, 50 = "your normal") and their weights:
 *  - HRV            0.35  z-score of today's HRV vs the baseline mean (higher is better).
 *  - Resting HR     0.15  z-score vs baseline, inverted (lower is better).
 *  - Sleep          0.25  60 % absolute (4,5 h → 0, 7,5 h → 100) + 40 % vs your own average.
 *  - Check-in       0.25  mean of energy, soreness, stress and sleep quality (1–5 scales).
 * HRV gets the largest weight because it is the most sensitive single marker of recovery; resting
 * HR mostly duplicates it, so it is weighted less. Missing components are dropped and the
 * remaining weights renormalised; with no component at all the result is `unknown` / null.
 *
 * Physiological z-scores need a baseline: HRV and resting HR require ≥ 7 days of data in the
 * last 28 (anything on or after today's date is excluded). Each z is clamped to ±2, mapped as
 * 50 ± 25·z, and the standard deviation is floored (5 % of the mean for HRV, 2 % for HR) so a
 * very stable baseline does not turn a tiny change into an extreme score.
 */
import type { Checkin, HealthDay, Readiness, ReadinessLevel } from '../types'
import { formatDuration } from './format'

export interface ReadinessInput {
  today?: HealthDay | null
  /** Recent days (up to the last 28 are used). */
  baseline: HealthDay[]
  checkin?: Checkin | null
}

export const READINESS_WEIGHTS = { hrv: 0.35, rhr: 0.15, sleep: 0.25, checkin: 0.25 } as const
export const MIN_BASELINE_DAYS = 7
export const BASELINE_DAYS = 28
export const SLEEP_TARGET_MIN = 450 // 7,5 h
export const SLEEP_FLOOR_MIN = 270 // 4,5 h → 0 points

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
const isNum = (n: number | null | undefined): n is number =>
  typeof n === 'number' && Number.isFinite(n)

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

function sd(xs: number[], m: number): number {
  if (xs.length < 2) return 0
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1))
}

export function readinessLevel(score: number | null): ReadinessLevel {
  if (score == null) return 'unknown'
  if (score >= 70) return 'push'
  if (score >= 45) return 'normal'
  return 'easy'
}

/** Compute the readiness of `today` (or of the check-in alone). */
export function computeReadiness(input: ReadinessInput): Readiness {
  const today = input.today ?? null
  const checkin = input.checkin ?? null
  const cutoff = today?.date.slice(0, 10) ?? checkin?.date.slice(0, 10) ?? null
  const base = input.baseline
    .filter((d) => cutoff == null || d.date.slice(0, 10) < cutoff)
    .toSorted((a, b) => b.date.localeCompare(a.date))
    .slice(0, BASELINE_DAYS)

  const parts: { w: number; score: number }[] = []
  const factors: string[] = []

  // HRV
  const hrvToday = today?.hrvMs
  if (isNum(hrvToday)) {
    const xs = base.map((d) => d.hrvMs).filter(isNum)
    if (xs.length >= MIN_BASELINE_DAYS) {
      const m = mean(xs)
      const s = Math.max(sd(xs, m), m * 0.05, 1e-6)
      const z = clamp((hrvToday - m) / s, -2, 2)
      parts.push({ w: READINESS_WEIGHTS.hrv, score: 50 + 25 * z })
      const pct = Math.round(((hrvToday - m) / m) * 100)
      factors.push(
        Math.abs(pct) < 3
          ? 'HRV en tu media'
          : `HRV ${Math.abs(pct)} % ${pct > 0 ? 'por encima' : 'por debajo'} de tu media`,
      )
    } else {
      factors.push(`HRV: faltan datos para tu media (${xs.length} de ${MIN_BASELINE_DAYS} días)`)
    }
  }

  // Resting HR
  const rhrToday = today?.restingHr
  if (isNum(rhrToday)) {
    const xs = base.map((d) => d.restingHr).filter(isNum)
    if (xs.length >= MIN_BASELINE_DAYS) {
      const m = mean(xs)
      const s = Math.max(sd(xs, m), m * 0.02, 1e-6)
      const z = clamp((rhrToday - m) / s, -2, 2)
      parts.push({ w: READINESS_WEIGHTS.rhr, score: 50 - 25 * z })
      const diff = Math.round(rhrToday - m)
      factors.push(
        diff === 0
          ? 'FC en reposo en tu media'
          : `FC en reposo ${Math.abs(diff)} lpm ${diff > 0 ? 'por encima' : 'por debajo'} de tu media`,
      )
    }
  }

  // Sleep: wearable first, check-in hours as fallback.
  const sleepMin = isNum(today?.sleepMin)
    ? today.sleepMin
    : isNum(checkin?.sleepH)
      ? checkin.sleepH * 60
      : null
  if (sleepMin != null) {
    const abs = clamp(
      ((sleepMin - SLEEP_FLOOR_MIN) / (SLEEP_TARGET_MIN - SLEEP_FLOOR_MIN)) * 100,
      0,
      100,
    )
    const xs = base.map((d) => d.sleepMin).filter(isNum)
    let score = abs
    if (xs.length >= 3) {
      const rel = clamp(50 + ((sleepMin - mean(xs)) / 60) * 25, 0, 100)
      score = 0.6 * abs + 0.4 * rel
    }
    parts.push({ w: READINESS_WEIGHTS.sleep, score })
    factors.push(`Dormiste ${formatDuration(sleepMin)}`)
  }

  // Subjective check-in (1–5 scales).
  if (checkin) {
    const good = (v: number) => ((clamp(v, 1, 5) - 1) / 4) * 100
    const bad = (v: number) => ((5 - clamp(v, 1, 5)) / 4) * 100
    const subs: number[] = []
    if (isNum(checkin.energy)) {
      subs.push(good(checkin.energy))
      if (checkin.energy <= 2) factors.push('Energía baja')
      else if (checkin.energy >= 4) factors.push('Energía alta')
    }
    if (isNum(checkin.soreness)) {
      subs.push(bad(checkin.soreness))
      if (checkin.soreness >= 4) factors.push('Agujetas fuertes')
    }
    if (isNum(checkin.stress)) {
      subs.push(bad(checkin.stress))
      if (checkin.stress >= 4) factors.push('Estrés alto')
    }
    if (isNum(checkin.sleepQuality)) {
      subs.push(good(checkin.sleepQuality))
      if (checkin.sleepQuality <= 2) factors.push('Sueño de mala calidad')
    }
    if (subs.length > 0) parts.push({ w: READINESS_WEIGHTS.checkin, score: mean(subs) })
  }

  if (parts.length === 0) return { score: null, level: 'unknown', factors }
  const wSum = parts.reduce((a, p) => a + p.w, 0)
  const score = Math.round(clamp(parts.reduce((a, p) => a + p.w * p.score, 0) / wSum, 0, 100))
  return { score, level: readinessLevel(score), factors }
}
