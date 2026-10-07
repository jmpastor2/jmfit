/**
 * Weekly volume landmarks (hard sets per muscle per week).
 *
 * Source: Renaissance Periodization, "<muscle> Hypertrophy Training Tips" articles on
 * rpstrength.com/blogs/articles (e.g. chest-hypertrophy-training-tips, back-hypertrophy-training-tips,
 * bicep-…, triceps-…, quad-…, hamstring-…, glute-…, calves-…, trap-…, side-delt-…, rear-delt-…,
 * front-delt-…, ab-…, forearm-hypertrophy-training-tips), read 2026-10-07. RP states these are
 * averages for intermediate lifters (3–7 years of training); beginners are lower.
 *
 * RP publishes every landmark as a range. We keep the published ranges in `published` and derive
 * single numbers for the engine:
 *   mv  = upper end of the MV range   (enough to keep what you have)
 *   mev = upper end of the MEV range  (growth is likely from here)
 *   mav = MAV range as published
 *   mrv = lower end of the MRV range  (conservative ceiling before fatigue piles up)
 *
 * Adductors and lower back have no RP article: values are our approximation (marked
 * `approximate: true`). Both get heavy indirect work from squats and hinges, so direct
 * volume needs are low; we mirror the RP landmarks of similarly "indirectly trained" muscles
 * (traps, rear delts) scaled down.
 */
import type { Muscle } from '@/domain/types'

type Range = readonly [number, number]

export interface VolumeLandmarks {
  mv: number
  mev: number
  mav: Range
  mrv: number
  published: { mv: Range; mev: Range; mav: Range; mrv: Range } | null
  approximate?: true
}

const rp = (mv: Range, mev: Range, mav: Range, mrv: Range): VolumeLandmarks => ({
  mv: mv[1],
  mev: mev[1],
  mav,
  mrv: mrv[0],
  published: { mv, mev, mav, mrv },
})

export const VOLUME_LANDMARKS: Record<Muscle, VolumeLandmarks> = {
  chest: rp([2, 4], [4, 6], [6, 16], [16, 24]),
  back: rp([2, 6], [6, 8], [8, 20], [20, 26]),
  traps: rp([0, 4], [0, 4], [4, 12], [12, 20]),
  front_delts: rp([0, 2], [0, 2], [4, 8], [8, 12]),
  side_delts: rp([2, 6], [6, 8], [8, 24], [24, 30]),
  rear_delts: rp([0, 4], [0, 4], [4, 12], [12, 20]),
  biceps: rp([6, 8], [8, 10], [14, 20], [20, 26]),
  triceps: rp([0, 4], [4, 6], [6, 16], [16, 20]),
  forearms: rp([0, 4], [0, 8], [8, 24], [24, 30]),
  quads: rp([2, 4], [4, 6], [6, 14], [14, 18]),
  hamstrings: rp([0, 2], [2, 4], [2, 8], [8, 14]),
  glutes: rp([2, 6], [6, 8], [8, 24], [24, 30]),
  calves: rp([2, 4], [4, 6], [6, 16], [16, 24]),
  abs: rp([0, 4], [0, 4], [4, 12], [12, 20]),
  // Approximation (no RP article): direct adductor work on top of squats/lunges.
  adductors: { mv: 0, mev: 2, mav: [4, 10], mrv: 14, published: null, approximate: true },
  // Approximation (no RP article): direct lower-back work (hyperextensions, good mornings)
  // on top of deadlifts and rows; kept low because hinges already load it heavily.
  lower_back: { mv: 0, mev: 2, mav: [2, 6], mrv: 10, published: null, approximate: true },
}

export type VolumeZone = 'below_mv' | 'maintenance' | 'productive' | 'optimal' | 'high' | 'over_mrv'

/** Where a weekly set count falls relative to the muscle's landmarks. */
export function volumeZone(muscle: Muscle, weeklySets: number): VolumeZone {
  const l = VOLUME_LANDMARKS[muscle]
  if (weeklySets > l.mrv) return 'over_mrv'
  if (weeklySets > l.mav[1]) return 'high'
  if (weeklySets >= l.mav[0] && weeklySets >= l.mev) return 'optimal'
  if (weeklySets >= l.mev) return 'productive'
  if (weeklySets >= l.mv && weeklySets > 0) return 'maintenance'
  return 'below_mv'
}
