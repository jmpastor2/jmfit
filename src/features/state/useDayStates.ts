import { useCheckins, useHealthDays, useHealthWorkouts, useMe, useSets } from '@/data/hooks'
import { localDateKey } from '@/domain/training'
import { useNow } from '@/lib/useNow'
import { dailyState, type DayState } from './state'

type Inputs = readonly [
  days: unknown,
  workouts: unknown,
  sets: unknown,
  checkins: unknown,
  birthDate: string | null,
  today: string,
  count: number,
]

/**
 * One computation shared by every screen that asks (Hoy, Cuerpo, the session's readiness):
 * the same data on the same day gives the same states, so it is kept until something changes.
 * The query results are stable references, so comparing them by identity is enough.
 */
const cache = new Map<number, { inputs: Inputs; states: DayState[] | null }>()

/** The last `count` days of recovery, strain and sleep; null while the band has no data. */
export function useDayStates(count = 28): DayState[] | null {
  const me = useMe()
  const now = useNow()
  const days = useHealthDays().data
  const workouts = useHealthWorkouts().data
  const sets = useSets().data
  const checkins = useCheckins().data
  const inputs: Inputs = [days, workouts, sets, checkins, me.birthDate, localDateKey(now), count]
  const hit = cache.get(count)
  if (hit && hit.inputs.every((v, i) => v === inputs[i])) return hit.states
  const states = days?.length
    ? dailyState({
        days,
        workouts: workouts ?? [],
        sets: sets ?? [],
        checkins: checkins ?? [],
        birthDate: me.birthDate,
        now,
        count,
      })
    : null
  cache.set(count, { inputs, states })
  return states
}
