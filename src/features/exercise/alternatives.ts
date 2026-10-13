/**
 * Replacements for an exercise (machine taken, discomfort, no equipment): the ones that train
 * the same main muscle with the same movement come first, and the list mixes equipment so a busy
 * machine always has a free-weight or cable way out.
 */
import { EQUIPMENT_LABEL } from '@/content/exercises'
import type { Exercise } from '@/domain/types'

export interface Alternative {
  exercise: Exercise
  /** Short Spanish reason shown under the name. */
  why: string
  score: number
}

/** Guided (machines, cables) or free (bars, dumbbells…): similar feel and setup. */
const GUIDED = new Set(['machine', 'plate_loaded', 'cable', 'smith'])
const family = (e: Exercise) =>
  GUIDED.has(e.equipment) ? 'guided' : e.equipment === 'bodyweight' ? 'body' : 'free'

function score(base: Exercise, c: Exercise): number {
  const main = base.primary[0]
  if (!main || !c.primary.some((m) => base.primary.includes(m))) return -1
  let s = 0
  if (c.primary[0] === main) s += 3
  else if (c.primary.includes(main)) s += 2
  else s += 1
  if (c.pattern === base.pattern) s += 4
  if (c.compound === base.compound) s += 2
  s += Math.min(2, c.secondary.filter((m) => base.secondary.includes(m)).length)
  // Planks and cardio are only swapped among themselves.
  if (Boolean(c.timed) !== Boolean(base.timed)) s -= 6
  if (family(c) === family(base)) s += 1
  // Novelties only break ties: the classics come first.
  if (c.trend) s += 0.25
  return s
}

function reason(base: Exercise, c: Exercise): string {
  const parts = [
    c.pattern === base.pattern ? 'Mismo movimiento' : 'Mismo músculo',
    EQUIPMENT_LABEL[c.equipment],
  ]
  if (c.trend) parts.push('Novedad')
  return parts.join(' · ')
}

/**
 * The best `count` replacements for `base`, never one of `exclude` (already in the session).
 * At most two share the same equipment, so the list is not five machines when the machine is
 * the problem.
 */
export function suggestAlternatives(
  base: Exercise,
  all: readonly Exercise[],
  exclude: ReadonlySet<string> = new Set(),
  count = 5,
): Alternative[] {
  const ranked = all
    .filter((c) => c.id !== base.id && !exclude.has(c.id) && c.equipment !== 'cardio')
    .map((c) => ({ exercise: c, score: score(base, c) }))
    .filter((x) => x.score >= 3)
    .sort((a, b) => b.score - a.score || a.exercise.name.localeCompare(b.exercise.name, 'es'))

  const out: Alternative[] = []
  const perEquipment = new Map<string, number>()
  for (const x of ranked) {
    const used = perEquipment.get(x.exercise.equipment) ?? 0
    if (used >= 2) continue
    perEquipment.set(x.exercise.equipment, used + 1)
    out.push({ ...x, why: reason(base, x.exercise) })
    if (out.length === count) return out
  }
  // Not enough variety: fill with the best of what is left.
  for (const x of ranked) {
    if (out.length === count) break
    if (!out.some((o) => o.exercise.id === x.exercise.id)) {
      out.push({ ...x, why: reason(base, x.exercise) })
    }
  }
  return out
}
