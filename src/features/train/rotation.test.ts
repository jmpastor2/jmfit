import { describe, expect, it } from 'vitest'
import type { Program, WorkoutFull } from '@/data/rows'
import {
  cadence,
  daysAhead,
  deloadEarned,
  fitsCadence,
  nextProgramDay,
  realDaysPerWeek,
} from './rotation'

const day = (id: string, weekday: number | null) => ({
  id,
  name: id,
  focus: '',
  weekday,
  slots: [],
})

const program = (days: ReturnType<typeof day>[]): Program => ({
  id: 'p',
  name: 'P',
  templateId: null,
  mesoWeeks: 6,
  startedOn: '2026-10-05',
  days,
  archived: false,
})

const done = (dayId: string | null, startedAt: string): WorkoutFull => ({
  id: `${dayId}-${startedAt}`,
  name: dayId ?? 'Entreno libre',
  programId: dayId ? 'p' : null,
  dayId,
  startedAt,
  endedAt: startedAt,
  notes: null,
  sessionRpe: null,
  bodyweight: null,
  deload: false,
  plan: [],
})

// Monday push … Friday torso.
const week = program([
  day('push', 0),
  day('pull', 1),
  day('legs', 2),
  day('arms', 3),
  day('torso', 4),
])
const at = (iso: string) => new Date(iso)

describe('nextProgramDay', () => {
  it('follows the calendar before the first session and while it is kept', () => {
    expect(nextProgramDay(week, [], at('2026-11-10T10:00:00'))).toMatchObject({
      day: { id: 'pull' },
      mode: 'calendar',
    })
    const kept = [done('push', '2026-11-09T19:00:00')] // Monday, on its day
    expect(nextProgramDay(week, kept, at('2026-11-10T10:00:00')).day?.id).toBe('pull')
    const friday = [done('torso', '2026-11-06T19:00:00')]
    expect(nextProgramDay(week, friday, at('2026-11-07T10:00:00'))).toMatchObject({
      day: null, // Saturday: rest
      mode: 'calendar',
    })
    expect(nextProgramDay(week, friday, at('2026-11-09T10:00:00')).day?.id).toBe('push')
  })

  it('off the calendar, goes on with the day after the last one done', () => {
    // Push on a Thursday and pull on a Monday: neither on its weekday.
    const real = [done('push', '2026-11-05T22:36:00'), done('pull', '2026-11-09T06:52:00')]
    const next = nextProgramDay(week, real, at('2026-11-10T10:00:00')) // Tuesday: calendar says pull
    expect(next).toMatchObject({
      day: { id: 'legs' },
      mode: 'rotation',
      last: { day: { id: 'pull' } },
    })
    // A weekend is not a rest day for someone behind, and a free session does not move the order.
    const withFree = [...real, done(null, '2026-11-12T19:00:00')]
    expect(nextProgramDay(week, withFree, at('2026-11-14T10:00:00')).day?.id).toBe('legs')
  })

  it('a planned day skipped takes the calendar away; the last day wraps to the first', () => {
    const monday = [done('push', '2026-11-09T19:00:00')]
    // Wednesday: Tuesday's pull went by.
    expect(nextProgramDay(week, monday, at('2026-11-11T10:00:00'))).toMatchObject({
      day: { id: 'pull' },
      mode: 'rotation',
    })
    const late = [done('torso', '2026-11-08T19:00:00')] // torso on a Sunday
    expect(nextProgramDay(week, late, at('2026-11-10T10:00:00')).day?.id).toBe('push')
  })

  it('plans without weekdays rotate across weeks; the day done today stays today', () => {
    const p = program([day('a', null), day('b', null), day('c', null)])
    const last = [done('b', '2026-11-06T19:00:00')] // Friday of the week before
    expect(nextProgramDay(p, last, at('2026-11-10T10:00:00')).day?.id).toBe('c')
    expect(nextProgramDay(p, last, at('2026-11-06T22:00:00')).day?.id).toBe('b')
    expect(nextProgramDay(p, [], at('2026-11-10T10:00:00')).day?.id).toBe('a')
    expect(nextProgramDay(null, [], at('2026-11-10T10:00:00')).day).toBeNull()
  })
})

describe('daysAhead', () => {
  it('lists the next days in program order, wrapping, at most one round', () => {
    expect(daysAhead(week, week.days[3]!, 3).map((d) => d.id)).toEqual(['arms', 'torso', 'push'])
    expect(daysAhead(week, week.days[0]!, 9)).toHaveLength(5)
    expect(daysAhead(week, null, 3)).toEqual([])
  })
})

describe('cadence', () => {
  const now = at('2026-11-10T12:00:00')
  it('says how long a round of the program takes at the real pace', () => {
    const nine = [
      '10-14',
      '10-15',
      '10-17',
      '10-19',
      '10-22',
      '10-23',
      '10-28',
      '11-05',
      '11-09',
    ].map((d) => done('push', `2026-${d}T19:00:00`))
    const c = cadence(week, nine, now)!
    expect(c.perWeek).toBe(2.25)
    expect(c.cycleDays).toBe(16)
    expect(fitsCadence(c)).toBe(false)
    expect(
      fitsCadence(cadence(program([day('a', null), day('b', null), day('c', null)]), nine, now)!),
    ).toBe(true)
  })
  it('sizes the plan to the pace: three days from two sessions a week', () => {
    expect([1, 1.5, 2, 2.5, 3, 3.25, 5].map(realDaysPerWeek)).toEqual([2, 2, 3, 3, 3, 4, 5])
  })
  it('waits for three weeks of history', () => {
    expect(cadence(week, [done('push', '2026-11-01T19:00:00')], now)).toBeNull()
    expect(cadence(week, [], now)).toBeNull()
  })
})

describe('deloadEarned', () => {
  it('needs eight sessions in the last three weeks', () => {
    const now = at('2026-11-20T12:00:00')
    const sessions = (n: number) =>
      Array.from({ length: n }, (_, i) =>
        done('push', `2026-11-${String(2 + i * 2).padStart(2, '0')}T19:00:00`),
      )
    expect(deloadEarned(sessions(8), now)).toBe(true)
    expect(deloadEarned(sessions(3), now)).toBe(false)
  })
})
