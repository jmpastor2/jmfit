/**
 * Estimated one-rep max (e1RM) helpers.
 *
 * Formula: Epley, `1RM = w · (1 + r / 30)`, where `r` are the *effective* reps: reps performed
 * plus reps left in reserve (RIR). A set of 8 at RIR 2 is treated as a 10-rep max.
 *
 * Why the 15-rep cap: every rep-max formula is fitted on low-rep data. Past ~12–15 reps the
 * estimate depends more on muscular endurance (and pacing) than on maximal strength, and the
 * error grows to ±10–20 %. Rather than show a confidently wrong number we return `null`, and the
 * callers (progression, records) simply ignore that set for strength comparisons.
 */

/** Effective reps above which estimates are considered unreliable. */
export const MAX_EFFECTIVE_REPS = 15

function isValidNumber(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n)
}

/**
 * Estimated 1RM from a set. Returns `null` for invalid input (negative or non-finite weight,
 * reps < 1, negative RIR) or when reps + RIR exceed {@link MAX_EFFECTIVE_REPS}.
 * A weight of 0 is valid (bodyweight exercise with no extra load) and yields 0.
 *
 * @param rir reps in reserve; `null`/`undefined` count as 0 (assume near failure).
 */
export function estimate1RM(
  weight: number | null | undefined,
  reps: number | null | undefined,
  rir: number | null = 0,
): number | null {
  if (!isValidNumber(weight) || weight < 0) return null
  if (!isValidNumber(reps) || reps < 1) return null
  const r = rir ?? 0
  if (!isValidNumber(r) || r < 0) return null
  const effective = reps + r
  if (effective > MAX_EFFECTIVE_REPS) return null
  if (effective <= 1) return weight
  return weight * (1 + effective / 30)
}

/**
 * Inverse of {@link estimate1RM}: the weight that should allow `reps` reps leaving `rir` in
 * reserve, given an e1RM. Not rounded (see {@link roundToIncrement}). `null` on invalid input or
 * when reps + RIR exceed {@link MAX_EFFECTIVE_REPS}.
 */
export function weightForReps(e1rm: number, reps: number, rir = 0): number | null {
  if (!isValidNumber(e1rm) || e1rm < 0) return null
  if (!isValidNumber(reps) || reps < 1) return null
  if (!isValidNumber(rir) || rir < 0) return null
  const effective = reps + rir
  if (effective > MAX_EFFECTIVE_REPS) return null
  if (effective <= 1) return e1rm
  return e1rm / (1 + effective / 30)
}

export type RoundMode = 'down' | 'nearest'

/**
 * Rounds a weight to a multiple of `inc` (the smallest practical jump: 1.25, 2, 2.5, 5…).
 * `'down'` (default) never exceeds the input, which is what you want for loads computed from a
 * percentage. Float noise is removed (82.49999 → 82.5). A non-positive or non-finite `inc` returns
 * the weight unchanged; negative results are clamped to 0.
 */
export function roundToIncrement(w: number, inc: number, mode: RoundMode = 'down'): number {
  if (!isValidNumber(w)) return w
  if (!isValidNumber(inc) || inc <= 0) return Math.max(0, w)
  const steps = w / inc
  // Small epsilon so 80 / 2.5 = 31.999999 still floors to 32.
  const n = mode === 'down' ? Math.floor(steps + 1e-9) : Math.round(steps)
  const out = Math.round(n * inc * 1000) / 1000
  return Math.max(0, out)
}
