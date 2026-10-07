/** Volume landmarks from the content catalog, in the shape the program editor compares against. */
import { VOLUME_LANDMARKS } from '@/content/landmarks'
import type { Muscle } from '@/domain/types'
import type { VolumeRange } from './programVolume'

export const MUSCLE_ORDER: readonly Muscle[] = [
  'chest',
  'back',
  'traps',
  'front_delts',
  'side_delts',
  'rear_delts',
  'biceps',
  'triceps',
  'forearms',
  'quads',
  'hamstrings',
  'glutes',
  'adductors',
  'calves',
  'abs',
  'lower_back',
]

/** MEV → top of the MAV range is the useful band; above the MRV floor is too much. */
export const VOLUME_RANGES: Partial<Record<Muscle, VolumeRange>> = Object.fromEntries(
  (Object.keys(VOLUME_LANDMARKS) as Muscle[]).map((m) => {
    const l = VOLUME_LANDMARKS[m]
    return [m, { mev: l.mev, mav: l.mav[1], mrv: l.mrv }]
  }),
)
