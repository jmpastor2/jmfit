/**
 * The habits journal, WHOOP-style: mark what a day had, and once there are enough days, see how
 * each habit moves the next morning's recovery. Pure functions.
 */
import type { JournalDay } from '@/domain/types'
import type { DayState } from './state'

export const JOURNAL_TAGS = [
  { id: 'alcohol', label: 'Alcohol' },
  { id: 'late-meal', label: 'Cena tarde' },
  { id: 'caffeine', label: 'Cafeína por la tarde' },
  { id: 'screens', label: 'Pantallas en la cama' },
  { id: 'stress', label: 'Estrés alto' },
  { id: 'nap', label: 'Siesta' },
  { id: 'late-training', label: 'Entreno por la noche' },
  { id: 'hydrated', label: 'Bien hidratado' },
] as const

export type JournalTag = (typeof JOURNAL_TAGS)[number]['id']

/** Days with and without a habit needed before saying anything about it. */
export const MIN_DAYS = 3

export interface TagImpact {
  tag: JournalTag
  label: string
  /** Next-morning recovery with the habit minus without it, in points. */
  diff: number | null
  withDays: number
  withoutDays: number
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length

/**
 * For each habit: the next day's recovery after days that had it against journaled days that
 * did not. Only journaled days count as «without» (an empty day might just not be written).
 */
export function journalImpact(
  journal: readonly JournalDay[],
  states: readonly DayState[],
): TagImpact[] {
  const next = new Map<string, number>()
  for (let i = 1; i < states.length; i++) {
    const r = states[i]!.recovery
    if (r != null) next.set(states[i - 1]!.date, r)
  }
  return JOURNAL_TAGS.map(({ id, label }) => {
    const withR: number[] = []
    const withoutR: number[] = []
    for (const d of journal) {
      const r = next.get(d.date)
      if (r == null) continue
      ;(d.tags.includes(id) ? withR : withoutR).push(r)
    }
    const enough = withR.length >= MIN_DAYS && withoutR.length >= MIN_DAYS
    return {
      tag: id,
      label,
      diff: enough ? Math.round(mean(withR) - mean(withoutR)) : null,
      withDays: withR.length,
      withoutDays: withoutR.length,
    }
  }).toSorted((a, b) => Math.abs(b.diff ?? 0) - Math.abs(a.diff ?? 0))
}
