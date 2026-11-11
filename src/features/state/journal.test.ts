import { describe, expect, it } from 'vitest'
import { journalImpact } from './journal'
import type { DayState } from './state'

const state = (date: string, recovery: number | null) => ({ date, recovery }) as DayState

describe('journalImpact', () => {
  // Alcohol on days 1, 3, 5: the mornings after (2, 4, 6) are low.
  const states = Array.from({ length: 10 }, (_, i) =>
    state(`2026-11-0${i}`.replace('-0', '-0').slice(0, 10), i % 2 === 0 ? 70 : 40),
  ).map((s, i) => ({ ...s, date: `2026-11-${String(i + 1).padStart(2, '0')}` }))
  const journal = states.slice(0, 9).map((s, i) => ({
    date: s.date,
    tags: i % 2 === 0 ? ['alcohol'] : ['hydrated'],
  }))

  it('compares the next morning with and without each habit', () => {
    const [top] = journalImpact(journal, states)
    expect(top).toMatchObject({ tag: 'alcohol', withDays: 5, withoutDays: 4 })
    expect(top!.diff).toBe(-30)
  })

  it('stays silent until there are three days on each side', () => {
    const few = journalImpact(journal.slice(0, 4), states)
    expect(few.find((t) => t.tag === 'alcohol')).toMatchObject({ diff: null, withDays: 2 })
  })
})
