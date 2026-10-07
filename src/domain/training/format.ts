/**
 * Spanish (es-ES) number formatting for engine messages. Kept manual instead of relying on
 * `Intl` so output is identical in every runtime (tests, old WebViews without full ICU).
 */

/** Rounds to `maxDecimals` and prints with a decimal comma, dropping trailing zeros: 82.5 → "82,5". */
export function formatNumber(n: number, maxDecimals = 2): string {
  const factor = 10 ** maxDecimals
  const rounded = Math.round(n * factor) / factor
  // Avoid "-0".
  const safe = Object.is(rounded, -0) ? 0 : rounded
  return String(safe).replace('.', ',')
}

/** "82,5 kg". */
export function formatKg(n: number): string {
  return `${formatNumber(n)} kg`
}

/** Minutes → "6 h 10 min" / "45 min" / "7 h". */
export function formatDuration(totalMin: number): string {
  const m = Math.max(0, Math.round(totalMin))
  const h = Math.floor(m / 60)
  const rest = m % 60
  if (h === 0) return `${rest} min`
  if (rest === 0) return `${h} h`
  return `${h} h ${rest} min`
}
