/**
 * Pure normalization of Google Health API v4 responses into Forja rows.
 *
 * No Deno or Node APIs here: this file is imported by the Edge Function (Deno) and by the
 * Vitest suite (src/lib/googleHealth.normalize.test.ts). Keep it dependency-free.
 *
 * Every field name below comes from the official reference:
 *   DataPoint / ReconciledDataPoint union and nested types:
 *     https://developers.google.com/health/reference/rest/v4/users.dataTypes.dataPoints
 *   dailyRollUp request/response (DailyRollupDataPoint):
 *     https://developers.google.com/health/reference/rest/v4/users.dataTypes.dataPoints/dailyRollUp
 *   reconcile response (ReconciledDataPoint.dataPointName):
 *     https://developers.google.com/health/reference/rest/v4/users.dataTypes.dataPoints/reconcile
 *   Rollup value types:
 *     https://developers.google.com/health/reference/rest/v4/StepsRollupValue
 *     https://developers.google.com/health/reference/rest/v4/ActiveEnergyBurnedRollupValue
 *     https://developers.google.com/health/reference/rest/v4/WeightRollupValue
 *     https://developers.google.com/health/reference/rest/v4/BodyFatRollupValue
 * Note (https://developers.google.com/health/data-types/vitals): 64-bit integers are
 * serialized as JSON strings, so int64 fields are typed `string` and parsed here.
 */

/* ───────────── API shapes (only the fields Forja reads) ───────────── */

/** google.type.Date */
export interface ApiDate {
  year?: number
  month?: number
  day?: number
}

/** CivilDateTime: { date, time } */
export interface ApiCivilDateTime {
  date?: ApiDate
  time?: { hours?: number; minutes?: number; seconds?: number; nanos?: number }
}

/** SessionTimeInterval (sleep, exercise). */
export interface ApiSessionInterval {
  startTime?: string
  startUtcOffset?: string
  endTime?: string
  endUtcOffset?: string
  civilStartTime?: ApiCivilDateTime
  civilEndTime?: ApiCivilDateTime
}

export type ApiSleepStageType =
  'SLEEP_STAGE_TYPE_UNSPECIFIED' | 'AWAKE' | 'LIGHT' | 'DEEP' | 'REM' | 'ASLEEP' | 'RESTLESS'

export interface ApiSleep {
  interval?: ApiSessionInterval
  type?: 'SLEEP_TYPE_UNSPECIFIED' | 'CLASSIC' | 'STAGES'
  metadata?: {
    stagesStatus?: string
    processed?: boolean
    nap?: boolean
    manuallyEdited?: boolean
    mainSleep?: boolean
    /**
     * The endpoints guide example (https://developers.google.com/health/endpoints) shows
     * `main: true` while the reference names it `mainSleep`. Both are read.
     */
    main?: boolean
  }
  summary?: {
    stagesSummary?: { type?: ApiSleepStageType; minutes?: string; count?: string }[]
    minutesInSleepPeriod?: string
    minutesAfterWakeUp?: string
    minutesToFallAsleep?: string
    minutesAsleep?: string
    minutesAwake?: string
  }
}

export interface ApiDailyRestingHeartRate {
  date?: ApiDate
  beatsPerMinute?: string
  dailyRestingHeartRateMetadata?: { calculationMethod?: string }
}

export interface ApiDailyHeartRateVariability {
  date?: ApiDate
  averageHeartRateVariabilityMilliseconds?: number
  nonRemHeartRateBeatsPerMinute?: string
  entropy?: number
  deepSleepRootMeanSquareOfSuccessiveDifferencesMilliseconds?: number
}

export interface ApiDailyVo2Max {
  date?: ApiDate
  estimated?: boolean
  cardioFitnessLevel?: string
  vo2Max?: number
  vo2MaxCovariance?: number
}

export interface ApiExercise {
  interval?: ApiSessionInterval
  exerciseType?: string
  displayName?: string
  /** Duration format, e.g. "1800s". */
  activeDuration?: string
  metricsSummary?: {
    caloriesKcal?: number
    distanceMillimeters?: number
    steps?: string
    averageHeartRateBeatsPerMinute?: string
    activeZoneMinutes?: string
  }
}

/** DataPoint (list) or ReconciledDataPoint (reconcile). */
export interface ApiDataPoint {
  /** DataPoint resource name (list). */
  name?: string
  /** ReconciledDataPoint resource name (reconcile). */
  dataPointName?: string
  sleep?: ApiSleep
  dailyRestingHeartRate?: ApiDailyRestingHeartRate
  dailyHeartRateVariability?: ApiDailyHeartRateVariability
  dailyVo2Max?: ApiDailyVo2Max
  exercise?: ApiExercise
}

export interface ApiDataPointsPage {
  dataPoints?: ApiDataPoint[]
  nextPageToken?: string
}

/** DailyRollupDataPoint (only the union members Forja requests). */
export interface ApiDailyRollupDataPoint {
  civilStartTime?: ApiCivilDateTime
  civilEndTime?: ApiCivilDateTime
  steps?: { countSum?: string }
  activeEnergyBurned?: { kcalSum?: number }
  weight?: { weightGramsAvg?: number }
  bodyFat?: { bodyFatPercentageAvg?: number }
}

export interface ApiDailyRollUpResponse {
  rollupDataPoints?: ApiDailyRollupDataPoint[]
}

/* ───────────── Forja rows (snake_case, match supabase/sql/google_health.sql) ───────────── */

export interface HealthDailyRow {
  date: string
  source: 'google_health'
  sleep_min: number | null
  deep_min: number | null
  rem_min: number | null
  light_min: number | null
  awake_min: number | null
  resting_hr: number | null
  hrv_ms: number | null
  steps: number | null
  active_kcal: number | null
  vo2max: number | null
  weight: number | null
  body_fat: number | null
  raw: Record<string, unknown>
}

export interface HealthWorkoutRow {
  source: 'google_health'
  external_id: string
  activity: string
  display_name: string | null
  started_at: string
  duration_s: number | null
  avg_hr: number | null
  /** Not exposed by Exercise.metricsSummary (no max heart rate field). Always null for now. */
  max_hr: number | null
  kcal: number | null
  distance_m: number | null
}

/** Everything one sync downloaded, grouped by data type. Missing scopes → empty arrays. */
export interface SyncPayload {
  steps: ApiDailyRollupDataPoint[]
  activeEnergy: ApiDailyRollupDataPoint[]
  weight: ApiDailyRollupDataPoint[]
  bodyFat: ApiDailyRollupDataPoint[]
  restingHr: ApiDataPoint[]
  hrv: ApiDataPoint[]
  vo2max: ApiDataPoint[]
  sleep: ApiDataPoint[]
}

/* ───────────── Small helpers ───────────── */

const pad = (n: number, len = 2) => String(n).padStart(len, '0')

/** google.type.Date → "YYYY-MM-DD", or null when incomplete. */
export function apiDateToIso(d: ApiDate | undefined): string | null {
  if (!d || !d.year || !d.month || !d.day) return null
  return `${pad(d.year, 4)}-${pad(d.month)}-${pad(d.day)}`
}

/** "YYYY-MM-DD" → google.type.Date. Numbers, never zero-padded strings (see troubleshooting). */
export function isoToApiDate(iso: string): Required<ApiDate> {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) throw new Error(`Invalid ISO date: ${iso}`)
  return { year: y, month: m, day: d }
}

/** Adds whole days to an ISO date, calendar-wise (UTC arithmetic, no DST effects). */
export function addDaysIso(iso: string, days: number): string {
  const { year, month, day } = isoToApiDate(iso)
  const t = new Date(Date.UTC(year, month - 1, day + days))
  return `${pad(t.getUTCFullYear(), 4)}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`
}

/** Today's calendar date in an IANA time zone, e.g. "Europe/Madrid". */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

/** int64-as-string or number → finite number, else null. */
export function num(v: string | number | undefined | null): number | null {
  if (v === undefined || v === null || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

const round = (v: number | null, decimals: number): number | null => {
  if (v === null) return null
  const f = 10 ** decimals
  return Math.round(v * f) / f
}

/** Duration format ("1800s", "3.5s") → seconds. */
export function parseDurationSeconds(v: string | undefined): number | null {
  if (!v) return null
  const m = /^(-?\d+(?:\.\d+)?)s$/.exec(v.trim())
  return m ? Number(m[1]) : null
}

/**
 * Local calendar date of a physical instant, given the stored UTC offset ("3600s").
 * Used only when the API omits the output-only civil time.
 */
export function localDateFromInstant(
  instant: string | undefined,
  utcOffset?: string,
): string | null {
  if (!instant) return null
  const t = Date.parse(instant)
  if (Number.isNaN(t)) return null
  const offsetS = parseDurationSeconds(utcOffset) ?? 0
  const local = new Date(t + offsetS * 1000)
  return `${pad(local.getUTCFullYear(), 4)}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}`
}

/* ───────────── Request builders ───────────── */

/**
 * dailyRollUp body for the closed-open civil range [startIso, endExclusiveIso), 1-day windows.
 * https://developers.google.com/health/reference/rest/v4/users.dataTypes.dataPoints/dailyRollUp
 * Max range is 90 days for the types Forja rolls up (14 days for heart-rate, total-calories,
 * active-minutes and calories-in-heart-rate-zone, which Forja does not roll up).
 */
export function buildDailyRollUpBody(startIso: string, endExclusiveIso: string) {
  const midnight = { hours: 0, minutes: 0, seconds: 0, nanos: 0 }
  return {
    range: {
      start: { date: isoToApiDate(startIso), time: midnight },
      end: { date: isoToApiDate(endExclusiveIso), time: midnight },
    },
    windowSizeDays: 1,
  }
}

/* ───────────── Normalization ───────────── */

const emptyRow = (date: string): HealthDailyRow => ({
  date,
  source: 'google_health',
  sleep_min: null,
  deep_min: null,
  rem_min: null,
  light_min: null,
  awake_min: null,
  resting_hr: null,
  hrv_ms: null,
  steps: null,
  active_kcal: null,
  vo2max: null,
  weight: null,
  body_fat: null,
  raw: {},
})

/** Date a sleep session belongs to: the local day the user woke up (Fitbit convention). */
export function sleepDate(s: ApiSleep): string | null {
  return (
    apiDateToIso(s.interval?.civilEndTime?.date) ??
    localDateFromInstant(s.interval?.endTime, s.interval?.endUtcOffset)
  )
}

const isMainSleep = (s: ApiSleep) => s.metadata?.mainSleep === true || s.metadata?.main === true

/**
 * Picks one sleep per wake-up date: the one flagged main sleep, otherwise the longest.
 * Naps are ignored when a non-nap session exists for that date.
 */
export function pickMainSleeps(points: ApiDataPoint[]): Map<string, ApiSleep> {
  const byDate = new Map<string, ApiSleep[]>()
  for (const p of points) {
    if (!p.sleep) continue
    const date = sleepDate(p.sleep)
    if (!date) continue
    const list = byDate.get(date) ?? []
    list.push(p.sleep)
    byDate.set(date, list)
  }
  const out = new Map<string, ApiSleep>()
  for (const [date, list] of byDate) {
    const main = list.find(isMainSleep)
    if (main) {
      out.set(date, main)
      continue
    }
    const nonNaps = list.filter((s) => s.metadata?.nap !== true)
    const pool = nonNaps.length ? nonNaps : list
    const best = pool.reduce((a, b) =>
      (num(b.summary?.minutesAsleep) ?? 0) > (num(a.summary?.minutesAsleep) ?? 0) ? b : a,
    )
    out.set(date, best)
  }
  return out
}

function stageMinutes(s: ApiSleep, type: ApiSleepStageType): number | null {
  const hit = s.summary?.stagesSummary?.find((x) => x.type === type)
  return hit ? num(hit.minutes) : null
}

/**
 * Merges every downloaded series into one row per local date.
 * Only dates with at least one value produce a row.
 */
export function normalizeDaily(payload: SyncPayload): HealthDailyRow[] {
  const rows = new Map<string, HealthDailyRow>()
  const row = (date: string) => {
    let r = rows.get(date)
    if (!r) {
      r = emptyRow(date)
      rows.set(date, r)
    }
    return r
  }

  const rollupDate = (p: ApiDailyRollupDataPoint) => apiDateToIso(p.civilStartTime?.date)

  for (const p of payload.steps) {
    const date = rollupDate(p)
    const v = num(p.steps?.countSum)
    if (date && v !== null) row(date).steps = Math.round(v)
  }
  for (const p of payload.activeEnergy) {
    const date = rollupDate(p)
    const v = num(p.activeEnergyBurned?.kcalSum)
    if (date && v !== null) row(date).active_kcal = Math.round(v)
  }
  for (const p of payload.weight) {
    const date = rollupDate(p)
    const g = num(p.weight?.weightGramsAvg)
    if (date && g !== null) row(date).weight = round(g / 1000, 2)
  }
  for (const p of payload.bodyFat) {
    const date = rollupDate(p)
    const v = num(p.bodyFat?.bodyFatPercentageAvg)
    if (date && v !== null) row(date).body_fat = round(v, 1)
  }

  for (const p of payload.restingHr) {
    const d = p.dailyRestingHeartRate
    const date = apiDateToIso(d?.date)
    const v = num(d?.beatsPerMinute)
    if (!date || v === null) continue
    const r = row(date)
    r.resting_hr = Math.round(v)
    const method = d?.dailyRestingHeartRateMetadata?.calculationMethod
    if (method) r.raw.resting_hr_method = method
  }
  for (const p of payload.hrv) {
    const d = p.dailyHeartRateVariability
    const date = apiDateToIso(d?.date)
    const v = num(d?.averageHeartRateVariabilityMilliseconds)
    if (!date || v === null) continue
    const r = row(date)
    r.hrv_ms = round(v, 1)
    const deep = num(d?.deepSleepRootMeanSquareOfSuccessiveDifferencesMilliseconds)
    if (deep !== null) r.raw.hrv_deep_rmssd_ms = deep
  }
  for (const p of payload.vo2max) {
    const d = p.dailyVo2Max
    const date = apiDateToIso(d?.date)
    const v = num(d?.vo2Max)
    if (!date || v === null) continue
    const r = row(date)
    r.vo2max = round(v, 1)
    if (d?.cardioFitnessLevel) r.raw.cardio_fitness_level = d.cardioFitnessLevel
    if (d?.estimated !== undefined) r.raw.vo2max_estimated = d.estimated
  }

  for (const [date, s] of pickMainSleeps(payload.sleep)) {
    const asleep = num(s.summary?.minutesAsleep)
    if (asleep === null) continue
    const r = row(date)
    r.sleep_min = Math.round(asleep)
    if (s.type === 'STAGES') {
      r.deep_min = stageMinutes(s, 'DEEP')
      r.rem_min = stageMinutes(s, 'REM')
      r.light_min = stageMinutes(s, 'LIGHT')
    }
    // minutesAwake = sum of all AWAKE stages (reference: Sleep.SleepSummary).
    r.awake_min = num(s.summary?.minutesAwake) ?? stageMinutes(s, 'AWAKE')
    r.raw.sleep = {
      type: s.type ?? null,
      start: s.interval?.startTime ?? null,
      end: s.interval?.endTime ?? null,
      minutes_in_sleep_period: num(s.summary?.minutesInSleepPeriod),
      stages_status: s.metadata?.stagesStatus ?? null,
    }
  }

  return [...rows.values()].sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Exercise data points → workout rows. Points without a resource name or start time are
 * skipped (the name is the stable external id used for upserts).
 */
export function normalizeWorkouts(points: ApiDataPoint[]): HealthWorkoutRow[] {
  const out = new Map<string, HealthWorkoutRow>()
  for (const p of points) {
    const e = p.exercise
    const id = p.dataPointName ?? p.name
    const start = e?.interval?.startTime
    if (!e || !id || !start) continue

    let duration = parseDurationSeconds(e.activeDuration)
    if (duration === null && e.interval?.endTime) {
      const ms = Date.parse(e.interval.endTime) - Date.parse(start)
      duration = Number.isFinite(ms) && ms >= 0 ? ms / 1000 : null
    }
    const m = e.metricsSummary
    const kcal = num(m?.caloriesKcal)
    const mm = num(m?.distanceMillimeters)
    const hr = num(m?.averageHeartRateBeatsPerMinute)

    out.set(id, {
      source: 'google_health',
      external_id: id,
      activity: e.exerciseType ?? 'EXERCISE_TYPE_UNSPECIFIED',
      display_name: e.displayName ?? null,
      started_at: start,
      duration_s: duration === null ? null : Math.round(duration),
      avg_hr: hr === null ? null : Math.round(hr),
      max_hr: null,
      kcal: kcal === null ? null : Math.round(kcal),
      distance_m: mm === null ? null : round(mm / 1000, 1),
    })
  }
  return [...out.values()].sort((a, b) => a.started_at.localeCompare(b.started_at))
}
