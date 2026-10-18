import { describe, expect, it } from 'vitest'
import { exerciseById } from '@/content/exercises'
import type { WorkoutFull } from '@/data/rows'
import { fallbackExercise } from '@/features/exercise/lookup'
import { programSwaps } from './ProgramSwaps'

const lookup = (id: string) => exerciseById(id) ?? fallbackExercise(id)
const slot = (id: string, exerciseId: string) => ({
  id,
  exerciseId,
  sets: 3,
  repMin: 8,
  repMax: 10,
  rir: 2,
  restSec: 90,
})
const program = {
  id: 'p',
  days: [
    { id: 'd', name: 'Empuje', slots: [slot('s1', 'bench-press'), slot('s2', 'overhead-press')] },
  ],
}
const workout = (plan: ReturnType<typeof slot>[], programId: string | null = 'p'): WorkoutFull => ({
  id: 'w',
  name: 'Empuje',
  programId,
  dayId: 'd',
  startedAt: '2026-10-12T18:00:00Z',
  endedAt: '2026-10-12T19:00:00Z',
  notes: null,
  sessionRpe: null,
  bodyweight: null,
  deload: false,
  plan,
})

describe('programSwaps', () => {
  it('lists the program slots done with another exercise', () => {
    const swaps = programSwaps(
      workout([slot('s1', 'bench-press'), slot('s2', 'machine-shoulder-press')]),
      program,
      lookup,
    )
    expect(swaps).toHaveLength(1)
    expect(swaps[0]).toMatchObject({ slotId: 's2', dayName: 'Empuje' })
    expect(swaps[0]!.from.id).toBe('overhead-press')
    expect(swaps[0]!.to.id).toBe('machine-shoulder-press')
  })
  it('ignores sessions of another program and added exercises', () => {
    expect(programSwaps(workout([slot('s2', 'dips')], 'other'), program, lookup)).toEqual([])
    expect(programSwaps(workout([slot('new', 'dips')]), program, lookup)).toEqual([])
  })
})
