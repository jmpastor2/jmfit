import { describe, expect, it } from 'vitest'
import type { HealthWorkout } from '@/domain/types'
import { activityLoads, activityName, otherActivities } from './activities'

const hw = (
  activity: string,
  startedAt: string,
  over: Partial<HealthWorkout> = {},
): HealthWorkout => ({
  id: `${activity}-${startedAt}`,
  activity,
  name: null,
  startedAt,
  durationS: 3600,
  avgHr: 140,
  kcal: 500,
  distanceM: null,
  ...over,
})

describe('otherActivities', () => {
  const forja = [{ startedAt: '2026-11-09T05:52:00Z', endedAt: '2026-11-09T07:08:00Z' }]
  it('keeps sports and strength done elsewhere, drops walks and the Forja session itself', () => {
    const acts = otherActivities(
      [
        hw('STRENGTH_TRAINING', '2026-11-09T05:56:00Z'), // the Forja session, seen by the band
        hw('WEIGHTS', '2026-11-09T12:00:00Z'), // a second session at midday
        hw('WALKING', '2026-11-10T13:46:00Z'),
        hw('SOCCER', '2026-11-10T19:00:00Z', { name: 'Fútbol' }),
      ],
      forja,
    )
    expect(acts.map((a) => a.activity)).toEqual(['SOCCER', 'WEIGHTS'])
  })
})

describe('activityName and activityLoads', () => {
  it('names the session and maps the sports that tire muscles', () => {
    expect(activityName(hw('RACKET_SPORTS', 'x'))).toBe('Racket sports')
    expect(activityName(hw('SOCCER', 'x', { name: 'Fútbol' }))).toBe('Fútbol')
    const loads = activityLoads([
      hw('SOCCER', '2026-11-10T19:00:00Z', { name: 'Fútbol' }),
      hw('SOCCER', '2026-11-08T19:00:00Z', { durationS: 600 }), // ten minutes: not a load
      hw('WEIGHTS', '2026-11-09T12:00:00Z'),
    ])
    expect(loads).toEqual([
      {
        muscles: ['quads', 'hamstrings', 'glutes', 'calves'],
        at: '2026-11-10T19:00:00Z',
        name: 'Fútbol',
      },
    ])
  })
})
