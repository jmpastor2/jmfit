/**
 * Goal progress and ETA projection.
 */
import type { GoalKind, UserGoal } from '../types'

const DAY_MS = 86_400_000

/** Goal kinds where "nothing" (0) is a sensible starting point when `start` was not recorded. */
const ZERO_START_KINDS: ReadonlySet<GoalKind> = new Set<GoalKind>(['e1rm', 'lift', 'frequency'])

/**
 * Fraction (0–1) of the way from `goal.start` to `goal.target` reached by `current`. Works in
 * both directions (e.g. body fat going down: start 18, target 12, current 15 → 0.5). Clamped to
 * [0, 1]: going the wrong way is 0, overshooting is 1.
 *
 * When `start` is null, strength and frequency goals start from 0; body goals (weight, fat,
 * muscle) can't be placed and return null. `current` null → null. If start equals target the
 * direction is unknown, so the goal is binary: 1 when `current` equals the target, else 0.
 */
export function goalProgress(goal: UserGoal, current: number | null): number | null {
  if (current == null || !Number.isFinite(current)) return null
  const start = goal.start ?? (ZERO_START_KINDS.has(goal.kind) ? 0 : null)
  if (start == null) return null
  const span = goal.target - start
  if (span === 0) return Math.abs(current - goal.target) < 1e-9 ? 1 : 0
  return Math.min(1, Math.max(0, (current - start) / span))
}

function median(xs: number[]): number {
  const s = [...xs].toSorted((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? (s[mid] ?? 0) : ((s[mid - 1] ?? 0) + (s[mid] ?? 0)) / 2
}

export interface ProjectOptions {
  /** How many of the most recent points to fit. Default 10. */
  window?: number
  /** Projections further away than this are not shown (null). Default 730 days. */
  maxDays?: number
}

/**
 * Estimated date at which the trend reaches `target`, by a Theil–Sen fit (median of pairwise
 * slopes — robust to the odd bad weigh-in or scan) over the most recent points.
 *
 * The goal direction is taken from the oldest fitted point towards `target`. Returns null when:
 * fewer than 3 valid points (or all on the same instant), the slope is flat or points away from
 * the target, or the ETA is more than `maxDays` away. If the fitted value at `now` has already
 * reached the target, returns a copy of `now`.
 */
export function projectDate(
  points: { date: string; value: number }[],
  target: number,
  now: Date,
  opts: ProjectOptions = {},
): Date | null {
  const windowSize = Math.max(3, opts.window ?? 10)
  const maxDays = opts.maxDays ?? 730
  const pts = points
    .map((p) => ({ t: new Date(p.date).getTime(), v: p.value }))
    .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.v))
    .toSorted((a, b) => a.t - b.t)
    .slice(-windowSize)
  if (pts.length < 3) return null

  const t0 = pts[0]?.t ?? 0
  const xs = pts.map((p) => (p.t - t0) / DAY_MS)
  const slopes: number[] = []
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const dx = (xs[j] ?? 0) - (xs[i] ?? 0)
      if (dx > 0) slopes.push(((pts[j]?.v ?? 0) - (pts[i]?.v ?? 0)) / dx)
    }
  }
  if (slopes.length === 0) return null
  const slope = median(slopes)
  const intercept = median(pts.map((p, i) => p.v - slope * (xs[i] ?? 0)))

  const xNow = (now.getTime() - t0) / DAY_MS
  const fitNow = intercept + slope * xNow
  // Goal direction: from where the series started towards the target (+1 up, −1 down).
  const firstV = pts[0]?.v ?? 0
  const direction = Math.sign(target - firstV) || Math.sign(slope)
  if (direction === 0) return new Date(now)
  const gap = target - fitNow
  if (gap * direction <= 1e-9) return new Date(now) // the trend line is already there
  if (Math.sign(slope) !== direction) return null // flat or moving away
  const days = gap / slope
  if (days > maxDays) return null
  return new Date(now.getTime() + days * DAY_MS)
}
