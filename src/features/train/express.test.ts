import { describe, expect, it } from 'vitest'
import { exerciseById } from '@/content/exercises'
import { templateById } from '@/content/programs'
import { expressOptions, fitToMinutes } from './express'
import { estimateMinutes } from './history'

const lookup = (id: string) => exerciseById(id)!
const day = (id: string) => templateById('jm-ppl-arms-5')!.days.find((d) => d.id === id)!.slots
const muscles = (slots: readonly { exerciseId: string }[]) =>
  new Set(slots.flatMap((s) => lookup(s.exerciseId).primary))

describe('fitToMinutes', () => {
  it('leaves a day that already fits untouched', () => {
    const slots = day('jm5-push')
    expect(fitToMinutes(slots, 90, lookup)).toEqual(slots)
  })

  it('shortens every day of the program and keeps each main muscle trained', () => {
    for (const d of templateById('jm-ppl-arms-5')!.days) {
      const full = estimateMinutes(d.slots)
      for (const minutes of [45, 30]) {
        const short = fitToMinutes(d.slots, minutes, lookup)
        expect(estimateMinutes(short), `${d.id} ${minutes}`).toBeLessThanOrEqual(full)
        expect(muscles(short), d.id).toEqual(muscles(d.slots))
        expect(short.every((s) => s.sets >= 2)).toBe(true)
        // Slots keep their ids and order: the session still counts as this program day.
        const ids = d.slots.map((s) => s.id)
        expect(short.map((s) => ids.indexOf(s.id))).toEqual(
          short.map((s) => ids.indexOf(s.id)).toSorted((a, b) => a - b),
        )
      }
    }
  })

  it('reaches thirty minutes on push by trimming sets and dropping the repeated chest work', () => {
    const short = fitToMinutes(day('jm5-push'), 30, lookup)
    expect(estimateMinutes(short)).toBeLessThanOrEqual(34)
    expect(short[0]!.exerciseId).toBe('bench-press')
    expect(short.length).toBeLessThan(5)
  })

  it('never splits a superset', () => {
    const short = fitToMinutes(day('jm5-torso'), 30, lookup)
    expect(short.filter((s) => s.superset === 'A')).toHaveLength(2)
  })
})

describe('expressOptions', () => {
  it('offers only lengths that shorten the day', () => {
    expect(expressOptions(day('jm5-pull'), lookup)).toEqual([45, 30])
    expect(expressOptions(day('jm5-pull').slice(0, 2), lookup)).toEqual([])
  })
})
