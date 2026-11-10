import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useActiveWorkout, useScans, useTrainingActions, useWorkouts } from '@/data/hooks'
import type { Program, WorkoutFull } from '@/data/rows'
import type { ProgramDay, Slot } from '@/domain/types'
import { deloadEarned } from '@/features/train/rotation'
import { newId, planFromDay } from './model'

export interface MesoWeek {
  week: number
  deload: boolean
  /** The calendar says deload, but too little was trained lately for one to be needed. */
  postponed: boolean
}

/**
 * Week of the mesocycle (1-based) on `date`, and whether it is the deload week. With the
 * workouts, a deload is only applied when the last three weeks earned it: cutting sets after
 * weeks of one or two sessions takes work away from someone who is short of it.
 */
export function mesoWeek(
  program: Program,
  date = new Date(),
  workouts?: readonly WorkoutFull[],
): MesoWeek {
  const start = new Date(program.startedOn + 'T00:00:00')
  const days = Math.floor((date.getTime() - start.getTime()) / 86_400_000)
  const cycle = program.mesoWeeks + 1 // the deload week closes each block
  const week = (((Math.floor(days / 7) % cycle) + cycle) % cycle) + 1
  const planned = week === cycle
  const postponed = planned && workouts != null && !deloadEarned(workouts, date)
  return { week, deload: planned && !postponed, postponed }
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
    async (opts: { program?: Program; day?: ProgramDay; name?: string; plan?: Slot[] } = {}) => {
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
        deload: opts.program ? mesoWeek(opts.program, new Date(), workouts ?? []).deload : false,
        plan: opts.day ? planFromDay(opts.day) : (opts.plan ?? []),
      }
      nav('/session')
      await saveWorkout(w)
    },
    [active, nav, saveWorkout, workouts, scans],
  )
}
