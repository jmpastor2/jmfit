import { describe, expect, it } from 'vitest'
import {
  addDaysIso,
  apiDateToIso,
  buildDailyRollUpBody,
  localDateFromInstant,
  normalizeDaily,
  normalizeWorkouts,
  parseDurationSeconds,
  pickMainSleeps,
  todayIn,
  type ApiDataPoint,
  type SyncPayload,
} from '../../supabase/functions/google-health/normalize.ts'
import { signState, verifyState } from '../../supabase/functions/google-health/state.ts'

/*
 * Fixtures mirror the documented response shapes:
 *  - sleep:   https://developers.google.com/health/endpoints (reconcile example)
 *  - rollups: https://developers.google.com/health/endpoints (dailyRollUp example) and
 *             https://developers.google.com/health/reference/rest/v4/*RollupValue
 *  - daily:   https://developers.google.com/health/reference/rest/v4/users.dataTypes.dataPoints
 *  - exercise: https://developers.google.com/health/data-types/workouts
 */

const civil = (year: number, month: number, day: number) => ({
  date: { year, month, day },
  time: {},
})

const sleepPoint: ApiDataPoint = {
  dataPointName: 'users/2515055256096816351/dataTypes/sleep/dataPoints/2724123844716220216',
  sleep: {
    interval: {
      startTime: '2026-03-03T20:57:30Z',
      startUtcOffset: '0s',
      endTime: '2026-03-04T04:41:30Z',
      endUtcOffset: '0s',
    },
    type: 'STAGES',
    metadata: { stagesStatus: 'SUCCEEDED', processed: true, main: true },
    summary: {
      minutesInSleepPeriod: '464',
      minutesAfterWakeUp: '0',
      minutesToFallAsleep: '0',
      minutesAsleep: '407',
      minutesAwake: '57',
      stagesSummary: [
        { type: 'AWAKE', minutes: '56', count: '12' },
        { type: 'LIGHT', minutes: '198', count: '19' },
        { type: 'DEEP', minutes: '114', count: '10' },
        { type: 'REM', minutes: '94', count: '4' },
      ],
    },
  },
}

const napPoint: ApiDataPoint = {
  name: 'users/me/dataTypes/sleep/dataPoints/nap-1',
  sleep: {
    interval: {
      startTime: '2026-03-04T14:00:00Z',
      endTime: '2026-03-04T14:40:00Z',
      endUtcOffset: '3600s',
      civilEndTime: { date: { year: 2026, month: 3, day: 4 }, time: { hours: 15, minutes: 40 } },
    },
    type: 'CLASSIC',
    metadata: { nap: true },
    summary: { minutesAsleep: '35', minutesAwake: '5' },
  },
}

const emptyPayload = (): SyncPayload => ({
  steps: [],
  activeEnergy: [],
  weight: [],
  bodyFat: [],
  restingHr: [],
  hrv: [],
  vo2max: [],
  sleep: [],
})

describe('date helpers', () => {
  it('converts google.type.Date to ISO and back through addDays', () => {
    expect(apiDateToIso({ year: 2026, month: 3, day: 4 })).toBe('2026-03-04')
    expect(apiDateToIso({ year: 2026, month: 3 })).toBeNull()
    expect(addDaysIso('2026-02-28', 1)).toBe('2026-03-01')
    expect(addDaysIso('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDaysIso('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('computes the local day of an instant from its UTC offset', () => {
    expect(localDateFromInstant('2026-03-03T23:30:00Z', '3600s')).toBe('2026-03-04')
    expect(localDateFromInstant('2026-03-03T23:30:00Z', '0s')).toBe('2026-03-03')
    expect(localDateFromInstant(undefined)).toBeNull()
  })

  it('reads "today" in the requested time zone', () => {
    const now = new Date('2026-10-06T22:30:00Z') // 00:30 on the 7th in Madrid (CEST)
    expect(todayIn('Europe/Madrid', now)).toBe('2026-10-07')
    expect(todayIn('UTC', now)).toBe('2026-10-06')
  })

  it('parses Duration strings', () => {
    expect(parseDurationSeconds('1800s')).toBe(1800)
    expect(parseDurationSeconds('3.5s')).toBe(3.5)
    expect(parseDurationSeconds('abc')).toBeNull()
    expect(parseDurationSeconds(undefined)).toBeNull()
  })

  it('builds a closed-open dailyRollUp body with numeric date parts', () => {
    expect(buildDailyRollUpBody('2026-07-28', '2026-07-30')).toEqual({
      range: {
        start: {
          date: { year: 2026, month: 7, day: 28 },
          time: { hours: 0, minutes: 0, seconds: 0, nanos: 0 },
        },
        end: {
          date: { year: 2026, month: 7, day: 30 },
          time: { hours: 0, minutes: 0, seconds: 0, nanos: 0 },
        },
      },
      windowSizeDays: 1,
    })
  })
})

describe('sleep', () => {
  it('assigns sleep to the wake-up date and prefers the main sleep over naps', () => {
    const picked = pickMainSleeps([napPoint, sleepPoint])
    expect([...picked.keys()]).toEqual(['2026-03-04'])
    expect(picked.get('2026-03-04')?.summary?.minutesAsleep).toBe('407')
  })

  it('falls back to the longest non-nap session when none is flagged main', () => {
    const a: ApiDataPoint = {
      sleep: { ...sleepPoint.sleep!, metadata: {}, summary: { minutesAsleep: '300' } },
    }
    const b: ApiDataPoint = {
      sleep: { ...sleepPoint.sleep!, metadata: {}, summary: { minutesAsleep: '320' } },
    }
    expect(pickMainSleeps([a, napPoint, b]).get('2026-03-04')?.summary?.minutesAsleep).toBe('320')
  })
})

describe('normalizeDaily', () => {
  it('merges rollups, daily summaries and sleep into one row per date', () => {
    const payload: SyncPayload = {
      ...emptyPayload(),
      steps: [
        {
          civilStartTime: civil(2026, 3, 3),
          civilEndTime: civil(2026, 3, 3),
          steps: { countSum: '8430' },
        },
        {
          civilStartTime: civil(2026, 3, 4),
          civilEndTime: civil(2026, 3, 4),
          steps: { countSum: '11245' },
        },
      ],
      activeEnergy: [{ civilStartTime: civil(2026, 3, 4), activeEnergyBurned: { kcalSum: 612.4 } }],
      weight: [{ civilStartTime: civil(2026, 3, 4), weight: { weightGramsAvg: 78150 } }],
      bodyFat: [{ civilStartTime: civil(2026, 3, 4), bodyFat: { bodyFatPercentageAvg: 15.24 } }],
      restingHr: [
        {
          dataPointName: 'users/1/dataTypes/daily-resting-heart-rate/dataPoints/a',
          dailyRestingHeartRate: {
            date: { year: 2026, month: 3, day: 4 },
            beatsPerMinute: '52',
            dailyRestingHeartRateMetadata: { calculationMethod: 'WITH_SLEEP' },
          },
        },
      ],
      hrv: [
        {
          dailyHeartRateVariability: {
            date: { year: 2026, month: 3, day: 4 },
            averageHeartRateVariabilityMilliseconds: 61.37,
            deepSleepRootMeanSquareOfSuccessiveDifferencesMilliseconds: 70.2,
          },
        },
      ],
      vo2max: [
        {
          dailyVo2Max: {
            date: { year: 2026, month: 3, day: 4 },
            vo2Max: 47.26,
            cardioFitnessLevel: 'GOOD',
            estimated: false,
          },
        },
      ],
      sleep: [sleepPoint, napPoint],
    }

    const rows = normalizeDaily(payload)
    expect(rows.map((r) => r.date)).toEqual(['2026-03-03', '2026-03-04'])

    expect(rows[0]).toMatchObject({
      date: '2026-03-03',
      steps: 8430,
      sleep_min: null,
      weight: null,
    })

    expect(rows[1]).toMatchObject({
      date: '2026-03-04',
      source: 'google_health',
      steps: 11245,
      active_kcal: 612,
      weight: 78.15,
      body_fat: 15.2,
      resting_hr: 52,
      hrv_ms: 61.4,
      vo2max: 47.3,
      sleep_min: 407,
      deep_min: 114,
      rem_min: 94,
      light_min: 198,
      awake_min: 57,
    })
    expect(rows[1]?.raw).toMatchObject({
      resting_hr_method: 'WITH_SLEEP',
      cardio_fitness_level: 'GOOD',
      sleep: { type: 'STAGES', stages_status: 'SUCCEEDED', minutes_in_sleep_period: 464 },
    })
  })

  it('leaves stage minutes null for classic sleep', () => {
    const classic: ApiDataPoint = {
      sleep: {
        interval: {
          startTime: '2026-03-04T22:00:00Z',
          endTime: '2026-03-05T05:00:00Z',
          endUtcOffset: '0s',
        },
        type: 'CLASSIC',
        metadata: { mainSleep: true },
        summary: { minutesAsleep: '390', minutesAwake: '30' },
      },
    }
    const [row] = normalizeDaily({ ...emptyPayload(), sleep: [classic] })
    expect(row).toMatchObject({
      date: '2026-03-05',
      sleep_min: 390,
      awake_min: 30,
      deep_min: null,
      rem_min: null,
      light_min: null,
    })
  })

  it('produces no rows when nothing was recorded', () => {
    expect(
      normalizeDaily({
        ...emptyPayload(),
        steps: [{ civilStartTime: civil(2026, 3, 4) }],
        restingHr: [{ dailyRestingHeartRate: { date: { year: 2026, month: 3, day: 4 } } }],
      }),
    ).toEqual([])
  })
})

describe('normalizeWorkouts', () => {
  it('maps exercise summary fields and converts units', () => {
    const run: ApiDataPoint = {
      name: 'users/me/dataTypes/exercise/dataPoints/morning-trail-run-123456',
      exercise: {
        interval: {
          startTime: '2026-04-20T08:00:00Z',
          startUtcOffset: '0s',
          endTime: '2026-04-20T08:35:00Z',
          endUtcOffset: '0s',
        },
        exerciseType: 'RUNNING',
        displayName: 'Morning Trail Run',
        activeDuration: '1800s',
        metricsSummary: {
          caloriesKcal: 380.0,
          distanceMillimeters: 5000000.0,
          steps: '6200',
          averageHeartRateBeatsPerMinute: '148',
          activeZoneMinutes: '30',
        },
      },
    }
    expect(normalizeWorkouts([run])).toEqual([
      {
        source: 'google_health',
        external_id: 'users/me/dataTypes/exercise/dataPoints/morning-trail-run-123456',
        activity: 'RUNNING',
        display_name: 'Morning Trail Run',
        started_at: '2026-04-20T08:00:00Z',
        duration_s: 1800,
        avg_hr: 148,
        max_hr: null,
        kcal: 380,
        distance_m: 5000,
      },
    ])
  })

  it('uses the interval when activeDuration is missing, prefers dataPointName and dedupes', () => {
    const p: ApiDataPoint = {
      dataPointName: 'users/1/dataTypes/exercise/dataPoints/7797422996486764704',
      exercise: {
        interval: { startTime: '2026-09-03T11:20:00Z', endTime: '2026-09-03T11:50:00Z' },
        exerciseType: 'WEIGHTLIFTING',
      },
    }
    const rows = normalizeWorkouts([p, p, { exercise: { exerciseType: 'RUNNING' } }])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      external_id: 'users/1/dataTypes/exercise/dataPoints/7797422996486764704',
      duration_s: 1800,
      avg_hr: null,
      kcal: null,
      distance_m: null,
    })
  })
})

describe('OAuth state', () => {
  it('round-trips, rejects tampering and expiry', async () => {
    const now = Date.parse('2026-10-07T10:00:00Z')
    const s = await signState('secret', 'user-123', 600, now)
    expect((await verifyState('secret', s, now))?.u).toBe('user-123')
    expect(await verifyState('other', s, now)).toBeNull()
    expect(await verifyState('secret', `${s}x`, now)).toBeNull()
    expect(await verifyState('secret', s, now + 601_000)).toBeNull()
    expect(await verifyState('secret', 'garbage', now)).toBeNull()
  })
})
