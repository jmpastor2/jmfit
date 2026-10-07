/**
 * Weekly volume a program prescribes: effective sets per muscle when every day is done once a
 * week (primary muscle 1 per set, secondary 0.5, a muscle in both counts as primary), compared
 * with the volume landmarks (MEV–MAV) so the editor can say where the plan falls short or
 * overshoots.
 */
import type { Exercise, Muscle, ProgramDay } from '@/domain/types'
import { SECONDARY_FACTOR } from '@/domain/training'

export type MuscleVolume = Partial<Record<Muscle, number>>

export function programVolume(
  days: readonly Pick<ProgramDay, 'slots'>[],
  lookup: (exerciseId: string) => Pick<Exercise, 'primary' | 'secondary'> | undefined,
): MuscleVolume {
  const out: MuscleVolume = {}
  for (const day of days) {
    for (const slot of day.slots) {
      const sets = Math.max(0, slot.sets)
      if (!sets) continue
      const ex = lookup(slot.exerciseId)
      if (!ex) continue
      const primary = new Set(ex.primary)
      for (const m of primary) out[m] = (out[m] ?? 0) + sets
      for (const m of new Set(ex.secondary)) {
        if (!primary.has(m)) out[m] = (out[m] ?? 0) + sets * SECONDARY_FACTOR
      }
    }
  }
  return out
}

/** Weekly set landmarks for one muscle. */
export interface VolumeRange {
  mev: number
  mav: number
  mrv?: number
}

export type VolumeStatus = 'low' | 'ok' | 'high' | 'over'

export interface VolumeRow {
  muscle: Muscle
  sets: number
  range: VolumeRange | null
  status: VolumeStatus | null
}

export function volumeStatus(sets: number, r: VolumeRange): VolumeStatus {
  if (sets < r.mev) return 'low'
  if (r.mrv !== undefined && sets > r.mrv) return 'over'
  if (sets > r.mav) return 'high'
  return 'ok'
}

/**
 * One row per muscle that has landmarks or prescribed sets, in `order` (muscles not in `order`
 * go last). Muscles with landmarks but no sets show as 0 / low only when their MEV is above 0.
 */
export function volumeRows(
  volume: MuscleVolume,
  ranges: Partial<Record<Muscle, VolumeRange>>,
  order: readonly Muscle[],
): VolumeRow[] {
  const muscles = new Set<Muscle>([
    ...(Object.keys(ranges) as Muscle[]),
    ...(Object.keys(volume) as Muscle[]),
  ])
  const rank = (m: Muscle) => {
    const i = order.indexOf(m)
    return i === -1 ? order.length : i
  }
  return [...muscles]
    .toSorted((a, b) => rank(a) - rank(b))
    .map((muscle) => {
      const sets = volume[muscle] ?? 0
      const range = ranges[muscle] ?? null
      return { muscle, sets, range, status: range ? volumeStatus(sets, range) : null }
    })
    .filter((r) => r.sets > 0 || (r.range !== null && r.range.mev > 0))
}
