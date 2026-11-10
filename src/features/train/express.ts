/**
 * A short version of a program day for when there is less time: «tengo 30 minutos». A short
 * session done beats a full one skipped. Pure functions.
 *
 * What goes first is what costs least: the extra sets of each exercise, then exercises whose
 * main muscle another one already trains, from the end of the plan. Every main muscle of the
 * day keeps at least one exercise and two sets, so the result may run a little over.
 */
import type { Exercise, Slot } from '@/domain/types'
import { estimateMinutes } from './history'

type Lookup = (id: string) => Pick<Exercise, 'primary' | 'compound'>

/** Fewer sets, in the order that costs least: compounds down to three, then the rest to two. */
const SET_TRIMS: ((slot: Slot, lookup: Lookup) => number)[] = [
  (s, lookup) => (lookup(s.exerciseId).compound ? Math.min(s.sets, 3) : s.sets),
  (s, lookup) => (lookup(s.exerciseId).compound ? s.sets : Math.min(s.sets, 2)),
]

/** Position of the last slot that can go: its main muscles are all trained by other slots. */
function lastRedundant(slots: readonly Slot[], lookup: Lookup): number {
  for (let i = slots.length - 1; i >= 0; i--) {
    const slot = slots[i]!
    // A superset goes or stays whole: never leave one half alone with no rest.
    if (slot.superset) continue
    const others = new Set(slots.flatMap((s, j) => (j === i ? [] : lookup(s.exerciseId).primary)))
    if (lookup(slot.exerciseId).primary.every((m) => others.has(m))) return i
  }
  return -1
}

/** The day's slots cut down to about `minutes`; unchanged when they already fit. */
export function fitToMinutes(slots: readonly Slot[], minutes: number, lookup: Lookup): Slot[] {
  let out = [...slots]
  const fits = () => estimateMinutes(out) <= minutes
  if (fits()) return out

  for (const trim of SET_TRIMS) {
    if (fits()) return out
    out = out.map((s) => ({ ...s, sets: trim(s, lookup) }))
  }
  while (!fits() && out.length > 2) {
    const i = lastRedundant(out, lookup)
    if (i === -1) break
    out = out.filter((_, j) => j !== i)
  }
  if (!fits()) out = out.map((s) => ({ ...s, sets: Math.min(s.sets, 2) }))
  return out
}

/** The shorter lengths worth offering for a day: those that really shorten it. */
export function expressOptions(slots: readonly Slot[], lookup: Lookup): number[] {
  const full = estimateMinutes(slots)
  return [45, 30].filter(
    (m) => m <= full - 8 && estimateMinutes(fitToMinutes(slots, m, lookup)) < full - 5,
  )
}
