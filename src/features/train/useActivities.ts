import { useMemo } from 'react'
import { useHealthWorkouts, useWorkouts } from '@/data/hooks'
import { otherActivities } from './activities'

/** The band's sessions that are not walks nor a Forja session, newest first. */
export function useOtherActivities() {
  const health = useHealthWorkouts().data
  const workouts = useWorkouts().data
  return useMemo(() => otherActivities(health ?? [], workouts ?? []), [health, workouts])
}
