/**
 * Plate calculator for barbell loads, and what the logged weight means for each kind of
 * equipment (bar included or not, per dumbbell, discs per side).
 */
import type { Equipment } from '@/domain/types'

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

/** Weight of an EZ bar, the usual 10 kg. */
export const EZ_BAR_KG = 10

export interface LoadModel {
  /** Label of the weight field. */
  label: string
  /** One line saying what the number counts, so it means the same every time. */
  hint: string
  /**
   * Kilos of the number that are not discs (the bar), or null when there are no discs to
   * split per side (dumbbells, pin stacks, cables).
   */
  base: number | null
}

/**
 * What the logged weight counts for each kind of equipment. Free bars count the bar (20 kg on
 * a barbell); disc machines and the Smith count the discs only, both sides added; dumbbells
 * count one dumbbell; stacks and cables what the pin says.
 */
export function loadModel(equipment: Equipment, barKg: number): LoadModel {
  switch (equipment) {
    case 'barbell':
      return { label: 'Kg totales', hint: `Con la barra (${barKg} kg)`, base: barKg }
    case 'ez_bar':
      return { label: 'Kg totales', hint: `Con la barra Z (${EZ_BAR_KG} kg)`, base: EZ_BAR_KG }
    case 'plate_loaded':
      return { label: 'Kg en discos', hint: 'Suma de los discos de los dos lados', base: 0 }
    case 'smith':
      return { label: 'Kg en discos', hint: 'Solo los discos, sin la barra guiada', base: 0 }
    case 'dumbbell':
      return { label: 'Kg por mancuerna', hint: 'El peso de una mancuerna', base: null }
    case 'kettlebell':
      return { label: 'Kg', hint: 'El peso de la kettlebell', base: null }
    case 'machine':
    case 'cable':
      return { label: 'Kg', hint: 'Lo que marca la placa de la pila', base: null }
    default:
      return { label: 'Kg', hint: '', base: null }
  }
}

/** The discs for each side of `total` under `model`, or null when it does not apply. */
export function discsPerSide(
  total: number | null,
  model: LoadModel,
  available: readonly number[] = DEFAULT_PLATES,
): (PlateLoad & { sideKg: number }) | null {
  if (total == null || model.base == null || total <= model.base) return null
  const load = platesPerSide(total, model.base, available)
  return { ...load, sideKg: (total - model.base) / 2 }
}
