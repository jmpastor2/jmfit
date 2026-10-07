/**
 * Plate calculator for barbell loads.
 */

/** kg → integer grams. */
const g = (kg: number) => Math.round(kg * 1000)

export const DEFAULT_PLATES: readonly number[] = [25, 20, 15, 10, 5, 2.5, 1.25]

export interface PlateLoad {
  /** Plates to put on EACH side, heaviest first. */
  perSide: number[]
  /**
   * Kilos of `total` that could not be loaded: `total − (bar + 2 · Σ perSide)`. 0 when exact;
   * positive when the plates can't reach it; negative when `total` is lighter than the bar.
   */
  remainder: number
}

/**
 * Plates per side to reach `total` kg on a `bar` kg bar. Greedy, heaviest first, assuming an
 * unlimited number of each plate. With the standard metric set every plate ≥ 5 kg is a multiple of
 * 5, so greedy gives the minimum remainder; exotic custom sets may not be optimal. Arithmetic is done in grams to avoid float drift (1.25 steps).
 */
export function platesPerSide(
  total: number,
  bar = 20,
  available: readonly number[] = DEFAULT_PLATES,
): PlateLoad {
  if (!Number.isFinite(total) || !Number.isFinite(bar)) return { perSide: [], remainder: 0 }
  const totalG = g(total)
  const barG = g(bar)
  if (totalG <= barG) return { perSide: [], remainder: (totalG - barG) / 1000 }

  const plates = [...new Set(available.filter((p) => Number.isFinite(p) && p > 0).map(g))].toSorted(
    (a, b) => b - a,
  )
  // Each side must carry the same plates, so work with half of the load to add.
  let sideG = Math.floor((totalG - barG) / 2)
  const perSide: number[] = []
  for (const p of plates) {
    while (sideG >= p) {
      perSide.push(p / 1000)
      sideG -= p
    }
  }
  const loadedG = barG + 2 * perSide.reduce((s, p) => s + g(p), 0)
  return { perSide, remainder: (totalG - loadedG) / 1000 }
}
