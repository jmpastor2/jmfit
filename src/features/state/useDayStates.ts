import { useMemo } from 'react'
import { useCheckins, useHealthDays, useHealthWorkouts, useMe, useSets } from '@/data/hooks'
import { useNow } from '@/lib/useNow'
import { dailyState, type DayState } from './state'

/** The last `count` days of recovery, strain and sleep; null while the band has no data. */
export function useDayStates(count = 28): DayState[] | null {
  const me = useMe()
  const now = useNow()
  const days = useHealthDays().data
  const workouts = useHealthWorkouts().data
  const sets = useSets().data
  const checkins = useCheckins().data
  return useMemo(() => {
    if (!days?.length) return null
    return dailyState({
      days,
      workouts: workouts ?? [],
      sets: sets ?? [],
      checkins: checkins ?? [],
      birthDate: me.birthDate,
      now,
      count,
    })
  }, [days, workouts, sets, checkins, me.birthDate, now, count])
}
