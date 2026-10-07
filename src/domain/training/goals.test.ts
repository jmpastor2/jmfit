import { describe, expect, it } from 'vitest'
import type { UserGoal } from '../types'
import { goalProgress, projectDate } from './goals'

const goal = (over: Partial<UserGoal>): UserGoal => ({
  id: 'g',
  kind: 'bodyweight',
  exerciseId: null,
  reps: null,
  target: 80,
  start: 75,
  startDate: '2026-01-01',
  deadline: null,
  achievedAt: null,
  ...over,
})

describe('goalProgress', () => {
  it('rising goals', () => {
    expect(goalProgress(goal({}), 77.5)).toBe(0.5)
    expect(goalProgress(goal({}), 75)).toBe(0)
    expect(goalProgress(goal({}), 80)).toBe(1)
  })

  it('falling goals (body fat)', () => {
    const g = goal({ kind: 'bodyfat', start: 18, target: 12 })
    expect(goalProgress(g, 15)).toBe(0.5)
    expect(goalProgress(g, 12)).toBe(1)
  })

  it('clamps overshoot and regressions', () => {
    expect(goalProgress(goal({}), 85)).toBe(1)
    expect(goalProgress(goal({}), 70)).toBe(0)
    expect(goalProgress(goal({ kind: 'bodyfat', start: 18, target: 12 }), 20)).toBe(0)
  })

  it('null current or unplaceable start', () => {
    expect(goalProgress(goal({}), null)).toBeNull()
    expect(goalProgress(goal({}), Number.NaN)).toBeNull()
    expect(goalProgress(goal({ start: null }), 77)).toBeNull()
    expect(goalProgress(goal({ kind: 'muscle', start: null }), 77)).toBeNull()
  })

  it('strength and frequency goals start from 0 when unknown', () => {
    expect(goalProgress(goal({ kind: 'e1rm', start: null, target: 120 }), 90)).toBe(0.75)
    expect(goalProgress(goal({ kind: 'frequency', start: null, target: 5 }), 4)).toBe(0.8)
  })

  it('start equal to target is binary', () => {
    expect(goalProgress(goal({ start: 80 }), 80)).toBe(1)
    expect(goalProgress(goal({ start: 80 }), 79)).toBe(0)
  })
})

describe('projectDate', () => {
  const d = (day: number) => new Date(Date.UTC(2026, 8, day)).toISOString()
  const now = new Date(Date.UTC(2026, 8, 30))
  const daysFromNow = (eta: Date | null) =>
    eta == null ? Number.NaN : (eta.getTime() - now.getTime()) / 86_400_000

  it('projects a linear rising trend', () => {
    // +0.1 kg/day: 75 on Sep 1 → 77.9 on Sep 30 → 80 in 21 days
    const pts = [1, 8, 15, 22, 29].map((x) => ({ date: d(x), value: 75 + 0.1 * (x - 1) }))
    expect(daysFromNow(projectDate(pts, 80, now))).toBeCloseTo(21, 6)
  })

  it('projects a falling trend (body fat)', () => {
    // −0.05 %/day from 16 on Sep 1: 14.55 on Sep 30, 14 → 11 days later
    const pts = [1, 10, 20, 29].map((x) => ({ date: d(x), value: 16 - 0.05 * (x - 1) }))
    expect(daysFromNow(projectDate(pts, 14, now))).toBeCloseTo(11, 6)
  })

  it('is robust to an outlier', () => {
    const pts = [1, 5, 10, 15, 20, 25].map((x) => ({ date: d(x), value: 75 + 0.1 * (x - 1) }))
    pts.push({ date: d(27), value: 90 }) // bad reading
    expect(daysFromNow(projectDate(pts, 80, now))).toBeCloseTo(21, 6)
  })

  it('null when the trend goes the wrong way or is flat', () => {
    const away = [1, 10, 20].map((x) => ({ date: d(x), value: 78 - 0.1 * x }))
    expect(projectDate(away, 80, now)).toBeNull()
    const flat = [1, 10, 20].map((x) => ({ date: d(x), value: 78 }))
    expect(projectDate(flat, 80, now)).toBeNull()
  })

  it('null with fewer than 3 points or degenerate dates', () => {
    expect(projectDate([], 80, now)).toBeNull()
    expect(
      projectDate(
        [
          { date: d(1), value: 75 },
          { date: d(2), value: 76 },
        ],
        80,
        now,
      ),
    ).toBeNull()
    expect(
      projectDate(
        [
          { date: d(1), value: 75 },
          { date: d(1), value: 76 },
          { date: 'bad', value: 77 },
          { date: d(1), value: Number.NaN },
        ],
        80,
        now,
      ),
    ).toBeNull()
  })

  it('returns now when the trend line has already reached the target', () => {
    const pts = [1, 10, 20].map((x) => ({ date: d(x), value: 75 + 0.5 * x }))
    const eta = projectDate(pts, 80, now)
    expect(eta?.getTime()).toBe(now.getTime())
    expect(eta).not.toBe(now)
  })

  it('null when too far away', () => {
    const pts = [1, 10, 20].map((x) => ({ date: d(x), value: 75 + 0.001 * x }))
    expect(projectDate(pts, 80, now)).toBeNull()
    expect(projectDate(pts, 80, now, { maxDays: 10_000 })).not.toBeNull()
  })

  it('uses only the most recent window of points', () => {
    // Old points fall, recent ones rise: with a window of 3 only the rise counts.
    const pts = [
      { date: d(1), value: 90 },
      { date: d(2), value: 85 },
      { date: d(3), value: 80 },
      { date: d(20), value: 75 },
      { date: d(25), value: 75.5 },
      { date: d(29), value: 75.9 },
    ]
    // Window fit: 75 → +0.1/day from Sep 20 → 76 on Sep 30 → 40 days to 80.
    expect(daysFromNow(projectDate(pts, 80, now, { window: 3 }))).toBeCloseTo(40, 6)
    // Whole series: it started at 90, so 80 reads as a *falling* goal the trend line already passed.
    expect(projectDate(pts, 80, now)?.getTime()).toBe(now.getTime())
  })
})
