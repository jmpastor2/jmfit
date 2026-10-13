import { describe, expect, it } from 'vitest'
import { EXERCISES, exerciseById } from '@/content/exercises'
import { suggestAlternatives } from './alternatives'

const get = (id: string) => {
  const e = exerciseById(id)
  if (!e) throw new Error(`missing ${id}`)
  return e
}

describe('suggestAlternatives', () => {
  it('gives five replacements for the same main muscle, never the exercise itself', () => {
    const base = get('seated-cable-row')
    const alts = suggestAlternatives(base, EXERCISES)
    expect(alts).toHaveLength(5)
    for (const a of alts) {
      expect(a.exercise.id).not.toBe(base.id)
      expect(a.exercise.primary.some((m) => base.primary.includes(m))).toBe(true)
      expect(a.why.length).toBeGreaterThan(0)
    }
  })

  it('prefers the same movement pattern first', () => {
    const base = get('bench-press')
    const [first] = suggestAlternatives(base, EXERCISES)
    expect(first!.exercise.pattern).toBe(base.pattern)
  })

  it('mixes equipment: at most two of one kind while there is variety', () => {
    const alts = suggestAlternatives(get('machine-pulldown'), EXERCISES)
    const counts = new Map<string, number>()
    for (const a of alts)
      counts.set(a.exercise.equipment, (counts.get(a.exercise.equipment) ?? 0) + 1)
    expect(Math.max(...counts.values())).toBeLessThanOrEqual(2)
  })

  it('skips what is already in the session', () => {
    const base = get('squat')
    const first = suggestAlternatives(base, EXERCISES)[0]!.exercise.id
    const again = suggestAlternatives(base, EXERCISES, new Set([first]))
    expect(again.map((a) => a.exercise.id)).not.toContain(first)
  })

  it('swaps a plank only for other held exercises or core work, never cardio', () => {
    const alts = suggestAlternatives(get('plank'), EXERCISES)
    for (const a of alts) expect(a.exercise.equipment).not.toBe('cardio')
    expect(alts.length).toBeGreaterThan(0)
  })
})
