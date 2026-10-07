import { FunctionsHttpError } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { HealthDay } from '@/domain/types'

/**
 * Browser side of the Google Health integration. All OAuth secrets and tokens live in the
 * `google-health` Edge Function; the browser only gets a consent URL and sync summaries.
 */

const FN = 'google-health'

/** Error codes the function can return (also arrive as `?error=` on the callback redirect). */
export type GoogleHealthErrorCode =
  | 'not_configured'
  | 'unauthorized'
  | 'not_connected'
  | 'reauth_required'
  | 'ACCOUNT_NOT_LINKED'
  | 'health_api_error'
  | 'db_error'
  | 'internal_error'
  | (string & {})

export class GoogleHealthError extends Error {
  readonly code: GoogleHealthErrorCode
  constructor(code: GoogleHealthErrorCode) {
    super(`google-health: ${code}`)
    this.name = 'GoogleHealthError'
    this.code = code
  }
}

export interface GoogleHealthSyncResult {
  days: number
  dailyRows: number
  workouts: number
}

export type GoogleHealthStatus = 'connected' | 'reauth_required' | 'error'

export interface GoogleHealthConnection {
  status: GoogleHealthStatus
  scopes: string[]
  connectedAt: string
  lastSyncAt: string | null
  lastError: string | null
}

async function call<T>(
  supabase: SupabaseClient,
  action: 'start' | 'sync' | 'disconnect',
  body: Record<string, unknown> = {},
): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(`${FN}?action=${action}`, {
    method: 'POST',
    body: { action, ...body },
  })
  if (error) {
    let code: string = 'internal_error'
    if (error instanceof FunctionsHttpError) {
      const payload = (await (error.context as Response).json().catch(() => null)) as {
        error?: string
      } | null
      if (payload?.error) code = payload.error
    }
    throw new GoogleHealthError(code)
  }
  if (data === null) throw new GoogleHealthError('internal_error')
  return data
}

/** Returns the Google consent URL. The caller navigates to it (`location.assign(url)`). */
export async function startGoogleHealthConnect(supabase: SupabaseClient): Promise<string> {
  const { url } = await call<{ url: string }>(supabase, 'start')
  return url
}

/** Pulls the last `days` days (default 7 on the server, max 90) into health_daily/health_workouts. */
export function syncGoogleHealth(
  supabase: SupabaseClient,
  days?: number,
): Promise<GoogleHealthSyncResult> {
  return call<GoogleHealthSyncResult>(supabase, 'sync', days ? { days } : {})
}

/** Revokes the grant at Google and forgets the tokens. Synced history is kept. */
export async function disconnectGoogleHealth(supabase: SupabaseClient): Promise<void> {
  await call<{ disconnected: boolean }>(supabase, 'disconnect')
}

/** Current connection row (RLS: own row only), or null when not connected. */
export async function getGoogleHealthConnection(
  supabase: SupabaseClient,
): Promise<GoogleHealthConnection | null> {
  const { data, error } = await supabase
    .from('health_connections')
    .select('status, scopes, connected_at, last_sync_at, last_error')
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const row = data as {
    status: GoogleHealthStatus
    scopes: string[] | null
    connected_at: string
    last_sync_at: string | null
    last_error: string | null
  }
  return {
    status: row.status,
    scopes: row.scopes ?? [],
    connectedAt: row.connected_at,
    lastSyncAt: row.last_sync_at,
    lastError: row.last_error,
  }
}

/** Row of `health_daily` as returned by PostgREST. */
export interface HealthDailyDbRow {
  date: string
  source: HealthDay['source']
  sleep_min: number | null
  deep_min: number | null
  rem_min: number | null
  light_min: number | null
  awake_min: number | null
  resting_hr: number | null
  hrv_ms: number | string | null
  steps: number | null
  active_kcal: number | null
  vo2max: number | string | null
  weight: number | string | null
  body_fat: number | string | null
}

const n = (v: number | string | null): number | null => (v === null ? null : Number(v))

export function healthDayFromRow(r: HealthDailyDbRow): HealthDay {
  return {
    date: r.date,
    source: r.source,
    sleepMin: r.sleep_min,
    deepMin: r.deep_min,
    remMin: r.rem_min,
    lightMin: r.light_min,
    awakeMin: r.awake_min,
    restingHr: r.resting_hr,
    hrvMs: n(r.hrv_ms),
    steps: r.steps,
    activeKcal: r.active_kcal,
    vo2max: n(r.vo2max),
    weight: n(r.weight),
    bodyFat: n(r.body_fat),
  }
}
