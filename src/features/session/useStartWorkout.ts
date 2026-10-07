import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useActiveWorkout, useScans, useTrainingActions, useWorkouts } from '@/data/hooks'
import type { Program, WorkoutFull } from '@/data/rows'
import type { ProgramDay } from '@/domain/types'
import { newId, planFromDay } from './model'

/** Week of the mesocycle (1-based) on `date`, and whether it is the deload week. */
export function mesoWeek(program: Program, date = new Date()): { week: number; deload: boolean } {
  const start = new Date(program.startedOn + 'T00:00:00')
  const days = Math.floor((date.getTime() - start.getTime()) / 86_400_000)
  const cycle = program.mesoWeeks + 1 // the deload week closes each block
  const week = (((Math.floor(days / 7) % cycle) + cycle) % cycle) + 1
  return { week, deload: week === cycle }
}

/**
 * Start (or resume) a session. A session already in progress always wins: the person is sent
 * back to it instead of opening a second one.
 */
export function useStartWorkout() {
  const nav = useNavigate()
  const active = useActiveWorkout()
  const { saveWorkout } = useTrainingActions()
  const workouts = useWorkouts().data
  const scans = useScans().data

  return useCallback(
    async (opts: { program?: Program; day?: ProgramDay; name?: string } = {}) => {
      if (active) {
        nav('/session')
        return
      }
      const lastWeight =
        workouts?.find((w) => w.bodyweight)?.bodyweight ?? scans?.at(-1)?.peso ?? null
      const w: WorkoutFull = {
        id: newId(),
        name: opts.day?.name ?? opts.name ?? 'Entreno libre',
        programId: opts.program?.id ?? null,
        dayId: opts.day?.id ?? null,
        startedAt: new Date().toISOString(),
        endedAt: null,
        notes: null,
        sessionRpe: null,
        bodyweight: lastWeight,
        deload: opts.program ? mesoWeek(opts.program).deload : false,
        plan: opts.day ? planFromDay(opts.day) : [],
      }
      nav('/session')
      await saveWorkout(w)
    },
    [active, nav, saveWorkout, workouts, scans],
  )
}

/** The program day planned for a date: same weekday first, otherwise the next one not yet done this week. */
export function dayForDate(
  program: Program | null,
  doneDayIds: ReadonlySet<string>,
  date = new Date(),
): ProgramDay | null {
  if (!program || !program.days.length) return null
  const wd = (date.getDay() + 6) % 7
  const exact = program.days.find((d) => d.weekday === wd)
  if (exact) return exact
  if (program.days.some((d) => d.weekday !== null)) return null // a rest day in a fixed plan
  return program.days.find((d) => !doneDayIds.has(d.id)) ?? program.days[0] ?? null
}
