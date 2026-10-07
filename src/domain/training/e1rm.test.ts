import { describe, expect, it } from 'vitest'
import { MAX_EFFECTIVE_REPS, estimate1RM, roundToIncrement, weightForReps } from './e1rm'
import { formatDuration, formatKg, formatNumber } from './format'

describe('estimate1RM', () => {
  it('uses Epley', () => {
    expect(estimate1RM(100, 10)).toBeCloseTo(133.333, 3)
    expect(estimate1RM(80, 5)).toBeCloseTo(93.333, 3)
  })

  it('adds RIR to the reps', () => {
    expect(estimate1RM(100, 8, 2)).toBeCloseTo(estimate1RM(100, 10) ?? 0, 9)
  })

  it('treats null RIR as 0', () => {
    expect(estimate1RM(100, 5, null)).toBe(estimate1RM(100, 5, 0))
  })

  it('returns the weight for a true single', () => {
    expect(estimate1RM(140, 1)).toBe(140)
    expect(estimate1RM(140, 1, 0)).toBe(140)
  })

  it('1 rep with RIR is not a single', () => {
    expect(estimate1RM(100, 1, 1)).toBeCloseTo(100 * (1 + 2 / 30), 9)
  })

  it('caps at 15 effective reps', () => {
    expect(MAX_EFFECTIVE_REPS).toBe(15)
    expect(estimate1RM(50, 15)).toBeCloseTo(75, 9)
    expect(estimate1RM(50, 16)).toBeNull()
    expect(estimate1RM(50, 13, 3)).toBeNull()
  })

  it('accepts weight 0 (bodyweight without lastre)', () => {
    expect(estimate1RM(0, 8)).toBe(0)
  })

  it('rejects invalid data', () => {
    expect(estimate1RM(-5, 5)).toBeNull()
    expect(estimate1RM(100, 0)).toBeNull()
    expect(estimate1RM(100, -1)).toBeNull()
    expect(estimate1RM(100, 5, -1)).toBeNull()
    expect(estimate1RM(Number.NaN, 5)).toBeNull()
    expect(estimate1RM(100, Number.POSITIVE_INFINITY)).toBeNull()
    expect(estimate1RM(null, 5)).toBeNull()
    expect(estimate1RM(100, null)).toBeNull()
    expect(estimate1RM(undefined, 5)).toBeNull()
  })
})

describe('weightForReps', () => {
  it('is the inverse of estimate1RM', () => {
    for (const [w, r, rir] of [
      [100, 10, 0],
      [82.5, 8, 2],
      [60, 3, 1],
    ] as const) {
      const e = estimate1RM(w, r, rir) ?? 0
      expect(weightForReps(e, r, rir)).toBeCloseTo(w, 9)
    }
  })

  it('handles singles and caps', () => {
    expect(weightForReps(150, 1)).toBe(150)
    expect(weightForReps(150, 14, 2)).toBeNull()
  })

  it('rejects invalid input', () => {
    expect(weightForReps(-1, 5)).toBeNull()
    expect(weightForReps(100, 0)).toBeNull()
    expect(weightForReps(100, 5, -2)).toBeNull()
    expect(weightForReps(Number.NaN, 5)).toBeNull()
  })
})

describe('roundToIncrement', () => {
  it('rounds down by default', () => {
    expect(roundToIncrement(83.9, 2.5)).toBe(82.5)
    expect(roundToIncrement(23.9, 2)).toBe(22)
    expect(roundToIncrement(47, 5)).toBe(45)
    expect(roundToIncrement(41.2, 1.25)).toBe(41.25 - 1.25)
  })

  it('rounds to nearest', () => {
    expect(roundToIncrement(83.9, 2.5, 'nearest')).toBe(85)
    expect(roundToIncrement(83.7, 2.5, 'nearest')).toBe(82.5)
    expect(roundToIncrement(41.2, 1.25, 'nearest')).toBe(41.25)
    expect(roundToIncrement(23, 2, 'nearest')).toBe(24)
    expect(roundToIncrement(52.4, 5, 'nearest')).toBe(50)
  })

  it('keeps exact multiples despite float noise', () => {
    expect(roundToIncrement(82.5, 2.5)).toBe(82.5)
    expect(roundToIncrement(80 * 0.9 + 0.0000001, 1.25)).toBe(71.25)
    expect(roundToIncrement(0.1 + 0.2, 0.1)).toBe(0.3)
    expect(roundToIncrement(3.75, 1.25)).toBe(3.75)
  })

  it('is safe with bad increments and negatives', () => {
    expect(roundToIncrement(82.3, 0)).toBe(82.3)
    expect(roundToIncrement(82.3, -1)).toBe(82.3)
    expect(roundToIncrement(-3, 2.5)).toBe(0)
    expect(roundToIncrement(0, 2.5)).toBe(0)
  })
})

describe('format', () => {
  it('uses a decimal comma and trims zeros', () => {
    expect(formatNumber(82.5)).toBe('82,5')
    expect(formatNumber(80)).toBe('80')
    expect(formatNumber(41.25)).toBe('41,25')
    expect(formatNumber(1.005, 1)).toBe('1')
    expect(formatNumber(-0.001)).toBe('0')
    expect(formatKg(102.5)).toBe('102,5 kg')
  })

  it('formats durations', () => {
    expect(formatDuration(370)).toBe('6 h 10 min')
    expect(formatDuration(420)).toBe('7 h')
    expect(formatDuration(45)).toBe('45 min')
    expect(formatDuration(-5)).toBe('0 min')
  })
})
