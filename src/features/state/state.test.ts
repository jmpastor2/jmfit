import { describe, expect, it } from 'vitest'
import type { HealthDay, HealthWorkout, LoggedSet } from '@/domain/types'
import { dailyState, recentMean, recoveryBand } from './state'

const day = (date: string, over: Partial<HealthDay> = {}): HealthDay => ({
  date,
  source: 'google_health',
  sleepMin: 420,
  deepMin: 70,
  remMin: 90,
  lightMin: 240,
  awakeMin: 20,
  restingHr: 66,
  hrvMs: 30,
  steps: 8000,
  activeKcal: 500,
  vo2max: null,
  weight: null,
  bodyFat: null,
  kcalIn: null,
  proteinG: null,
  carbsG: null,
  fatG: null,
  ...over,
})

const now = new Date('2026-11-12T10:00:00')
const days = Array.from({ length: 14 }, (_, i) => {
  const d = new Date(2026, 9, 30 + i)
  return day(
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
  )
})
const football: HealthWorkout = {
  id: 'f',
  activity: 'SOCCER',
  name: 'Fútbol',
  startedAt: '2026-11-10T19:00:00',
  durationS: 3600,
  avgHr: 165,
  kcal: 661,
  distanceM: 4580,
}
const set = (doneAt: string): LoggedSet => ({
  id: doneAt,
  workoutId: 'w',
  exerciseId: 'bench-press',
  exerciseIndex: 0,
  setIndex: 0,
  kind: 'work',
  weight: 80,
  reps: 8,
  rir: 2,
  doneAt,
})

describe('dailyState', () => {
  const states = dailyState({
    days: [
      ...days.slice(0, -2),
      day('2026-11-11', { sleepMin: 197, hrvMs: 32 }),
      day('2026-11-12', { sleepMin: null, hrvMs: null }),
    ],
    workouts: [football],
    sets: Array.from({ length: 12 }, (_, i) => set(`2026-11-09T07:${String(10 + i)}:00`)),
    checkins: [],
    birthDate: '1991-07-17',
    now,
    count: 7,
  })

  it('gives one row per day, oldest first, ending today', () => {
    expect(states.map((s) => s.date)).toEqual([
      '2026-11-06',
      '2026-11-07',
      '2026-11-08',
      '2026-11-09',
      '2026-11-10',
      '2026-11-11',
      '2026-11-12',
    ])
  })

  it('scores the football day as the hardest and asks for more sleep after it', () => {
    const fb = states.find((s) => s.date === '2026-11-10')!
    const gym = states.find((s) => s.date === '2026-11-09')!
    expect(fb.strain).toBeGreaterThan(gym.strain)
    expect(fb.strainParts[0]!.label).toBe('Fútbol')
    expect(gym.strainParts.map((p) => p.label)).toContain('12 series efectivas')
    const after = states.find((s) => s.date === '2026-11-11')!
    expect(after.sleepNeedMin).toBeGreaterThan(450)
    expect(after).toMatchObject({ sleepMin: 197, partialNight: true })
    expect(after.recovery).not.toBeNull()
  })

  it('gives no recovery from resting pulse alone', () => {
    const today = states.at(-1)!
    expect(today).toMatchObject({ date: '2026-11-12', hrv: null, sleepMin: null })
    expect(today.recovery).toBeNull()
  })

  it('averages the recent days and bands the recovery', () => {
    expect(recentMean(states, (s) => s.hrv, 7)).toBe(30)
    expect(recoveryBand(80)).toBe('high')
    expect(recoveryBand(40)).toBe('mid')
    expect(recoveryBand(10)).toBe('low')
    expect(recoveryBand(null)).toBeNull()
  })
})
