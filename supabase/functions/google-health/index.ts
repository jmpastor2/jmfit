/**
 * Supabase Edge Function: Google Health API (successor of the Fitbit Web API) integration.
 *
 *   POST ?action=start       (user JWT)            → { url } Google OAuth consent URL
 *   GET  ?action=callback    (redirect from Google) → stores tokens, first 30-day sync, redirects to app
 *   POST ?action=sync        (user JWT | x-cron-secret) → refresh token, download, upsert
 *   POST ?action=disconnect  (user JWT)            → revoke at Google, delete token/connection rows
 *
 * Deploy with --no-verify-jwt (Google's redirect carries no Supabase JWT); user JWTs are
 * verified here with auth.getUser().
 *
 * Docs used (fetched 2026-10-07):
 *   Overview / migration:   https://developers.google.com/health/migration
 *   Data access & tokens:   https://developers.google.com/health/migration/data-access
 *   Data type mapping:      https://developers.google.com/health/migration/api-specifications
 *   Scopes:                 https://developers.google.com/health/scopes
 *   Data types:             https://developers.google.com/health/data-types
 *   Endpoints & filters:    https://developers.google.com/health/endpoints
 *                           https://developers.google.com/health/filters
 *   REST reference:         https://developers.google.com/health/reference/rest
 *   Google OAuth (web):     https://developers.google.com/identity/protocols/oauth2/web-server
 */

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import {
  addDaysIso,
  buildDailyRollUpBody,
  normalizeDaily,
  normalizeWorkouts,
  todayIn,
  type ApiDailyRollUpResponse,
  type ApiDailyRollupDataPoint,
  type ApiDataPoint,
  type ApiDataPointsPage,
  type SyncPayload,
} from './normalize.ts'
import { signState, verifyState } from './state.ts'

/* ───────────── Config ───────────── */

const env = (k: string) => Deno.env.get(k) ?? ''

const SUPABASE_URL = env('SUPABASE_URL')
const SERVICE_ROLE_KEY = env('SUPABASE_SERVICE_ROLE_KEY')
const GOOGLE_CLIENT_ID = env('GOOGLE_CLIENT_ID')
const GOOGLE_CLIENT_SECRET = env('GOOGLE_CLIENT_SECRET')
const STATE_SECRET = env('STATE_SECRET')
const APP_URL = env('APP_URL')
const CRON_SECRET = env('CRON_SECRET')
/** User's civil time zone, used only to decide what "today" is. */
const HEALTH_TZ = env('HEALTH_TZ') || 'Europe/Madrid'

/** Must match, character by character, the URI registered on the OAuth client. */
const REDIRECT_URI =
  env('GOOGLE_REDIRECT_URI') || `${SUPABASE_URL}/functions/v1/google-health?action=callback`

const ALLOWED_ORIGINS = ['https://jmpastor2.github.io', 'http://localhost:5173']

// https://developers.google.com/health/migration/data-access
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
// https://developers.google.com/identity/protocols/oauth2/web-server (revoking a token)
const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke'
// https://developers.google.com/health/reference/rest (service endpoint)
const HEALTH_API = 'https://health.googleapis.com/v4'

// Read-only scopes, minimum set. https://developers.google.com/health/scopes
// Scope per data type: https://developers.google.com/health/data-types
const SCOPE_ACTIVITY = 'https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly'
const SCOPE_METRICS =
  'https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly'
const SCOPE_SLEEP = 'https://www.googleapis.com/auth/googlehealth.sleep.readonly'
const SCOPES = [SCOPE_ACTIVITY, SCOPE_METRICS, SCOPE_SLEEP]

const FIRST_SYNC_DAYS = 30
const DEFAULT_SYNC_DAYS = 7
/** dailyRollUp max range for steps, active-energy-burned, weight, body-fat is 90 days. */
const MAX_SYNC_DAYS = 90

const admin = (): SupabaseClient =>
  createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })

/* ───────────── HTTP helpers ───────────── */

function cors(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? ''
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]!,
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type, x-cron-secret',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    Vary: 'Origin',
  }
}

function json(req: Request, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(req), 'Content-Type': 'application/json' },
  })
}

function redirectToApp(params: Record<string, string>): Response {
  const base = APP_URL.replace(/#.*$/, '').replace(/\/?$/, '/')
  const qs = new URLSearchParams(params).toString()
  return new Response(null, {
    status: 302,
    headers: { Location: `${base}#/settings/health?${qs}` },
  })
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message?: string,
  ) {
    super(message ?? code)
  }
}

async function requireUser(req: Request): Promise<string> {
  const jwt = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!jwt) throw new HttpError(401, 'unauthorized')
  const { data, error } = await admin().auth.getUser(jwt)
  if (error || !data.user) throw new HttpError(401, 'unauthorized')
  return data.user.id
}

function constantTimeEquals(a: string, b: string): boolean {
  if (!a || a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

const googleConfigured = () =>
  Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && STATE_SECRET && APP_URL)

/* ───────────── Google OAuth ───────────── */

interface TokenResponse {
  access_token?: string
  expires_in?: number
  refresh_token?: string
  refresh_token_expires_in?: number
  scope?: string
  token_type?: string
  error?: string
  error_description?: string
}

// Authorization code exchange and refresh: POST https://oauth2.googleapis.com/token,
// application/x-www-form-urlencoded.
// https://developers.google.com/identity/protocols/oauth2/web-server#exchange-authorization-code
// https://developers.google.com/identity/protocols/oauth2/web-server#offline
async function tokenRequest(params: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      ...params,
    }),
  })
  const body = (await res.json().catch(() => ({}))) as TokenResponse
  if (!res.ok) {
    throw new HttpError(res.status, body.error ?? 'token_error', body.error_description)
  }
  return body
}

/* ───────────── Google Health API ───────────── */

interface GoogleApiError {
  error?: {
    code?: number
    status?: string
    message?: string
    details?: { reason?: string; metadata?: Record<string, string> }[]
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Authenticated call with exponential backoff on 429 / 5xx, as the docs require
 * (https://developers.google.com/health/rate-limits, .../endpoints#query-historical-data).
 */
async function healthFetch<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${HEALTH_API}/${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      },
    })
    if (res.ok) return (await res.json()) as T
    if ((res.status === 429 || res.status >= 500) && attempt < 3) {
      await sleep(1000 * 2 ** attempt + Math.random() * 250)
      continue
    }
    const body = (await res.json().catch(() => ({}))) as GoogleApiError
    // ACCOUNT_NOT_LINKED: https://developers.google.com/health/troubleshooting
    const reason = body.error?.details?.find((d) => d.reason)?.reason
    throw new HttpError(
      res.status,
      reason ?? body.error?.status ?? 'health_api_error',
      body.error?.message,
    )
  }
}

/** GET users/me/identity → healthUserId. https://developers.google.com/health/reference/rest/v4/users/getIdentity */
async function getIdentity(
  token: string,
): Promise<{ healthUserId?: string; legacyUserId?: string }> {
  return healthFetch(token, 'users/me/identity')
}

/**
 * POST users/me/dataTypes/{type}/dataPoints:dailyRollUp
 * https://developers.google.com/health/reference/rest/v4/users.dataTypes.dataPoints/dailyRollUp
 */
async function dailyRollUp(
  token: string,
  dataType: string,
  startIso: string,
  endExclusiveIso: string,
): Promise<ApiDailyRollupDataPoint[]> {
  const res = await healthFetch<ApiDailyRollUpResponse>(
    token,
    `users/me/dataTypes/${dataType}/dataPoints:dailyRollUp`,
    { method: 'POST', body: JSON.stringify(buildDailyRollUpBody(startIso, endExclusiveIso)) },
  )
  return res.rollupDataPoints ?? []
}

/**
 * GET users/me/dataTypes/{type}/dataPoints:reconcile?filter=…, following nextPageToken.
 * Reconcile deduplicates overlapping records across sources (sleep/exercise pages cap at 25).
 * https://developers.google.com/health/reference/rest/v4/users.dataTypes.dataPoints/reconcile
 * Filter syntax (snake_case type names): https://developers.google.com/health/filters
 */
async function reconcileAll(
  token: string,
  dataType: string,
  filter: string,
): Promise<ApiDataPoint[]> {
  const out: ApiDataPoint[] = []
  let pageToken = ''
  for (let page = 0; page < 40; page++) {
    const qs = new URLSearchParams({ filter })
    if (pageToken) qs.set('pageToken', pageToken)
    const res = await healthFetch<ApiDataPointsPage>(
      token,
      `users/me/dataTypes/${dataType}/dataPoints:reconcile?${qs}`,
    )
    out.push(...(res.dataPoints ?? []))
    pageToken = res.nextPageToken ?? ''
    if (!pageToken) break
  }
  return out
}

/* ───────────── Token storage ───────────── */

interface TokenRow {
  user_id: string
  refresh_token: string
  access_token: string | null
  expires_at: string | null
}

async function getAccessToken(db: SupabaseClient, userId: string): Promise<string> {
  const { data, error } = await db
    .from('health_tokens')
    .select('user_id, refresh_token, access_token, expires_at')
    .eq('user_id', userId)
    .maybeSingle<TokenRow>()
  if (error) throw new HttpError(500, 'db_error', error.message)
  if (!data) throw new HttpError(409, 'not_connected')

  if (data.access_token && data.expires_at && Date.parse(data.expires_at) - Date.now() > 60_000) {
    return data.access_token
  }

  let t: TokenResponse
  try {
    t = await tokenRequest({ grant_type: 'refresh_token', refresh_token: data.refresh_token })
  } catch (e) {
    // invalid_grant: revoked, unused 6 months, or 7-day Testing-mode expiry.
    if (e instanceof HttpError && e.code === 'invalid_grant') {
      await db
        .from('health_connections')
        .update({ status: 'reauth_required', last_error: 'invalid_grant' })
        .eq('user_id', userId)
      throw new HttpError(409, 'reauth_required')
    }
    throw e
  }
  if (!t.access_token) throw new HttpError(502, 'token_error')

  const expiresAt = new Date(Date.now() + (t.expires_in ?? 3600) * 1000).toISOString()
  await db
    .from('health_tokens')
    .update({
      access_token: t.access_token,
      expires_at: expiresAt,
      ...(t.refresh_token ? { refresh_token: t.refresh_token } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
  return t.access_token
}

/* ───────────── Sync ───────────── */

interface SyncResult {
  userId: string
  days: number
  dailyRows: number
  workouts: number
  error?: string
}

async function syncUser(
  db: SupabaseClient,
  userId: string,
  requestedDays?: number,
): Promise<SyncResult> {
  const { data: conn } = await db
    .from('health_connections')
    .select('scopes, last_sync_at')
    .eq('user_id', userId)
    .maybeSingle<{ scopes: string[] | null; last_sync_at: string | null }>()
  if (!conn) throw new HttpError(409, 'not_connected')

  const days = Math.min(
    MAX_SYNC_DAYS,
    Math.max(1, requestedDays ?? (conn.last_sync_at ? DEFAULT_SYNC_DAYS : FIRST_SYNC_DAYS)),
  )
  const granted = new Set(conn.scopes ?? SCOPES)
  const has = (s: string) => granted.has(s)

  try {
    const token = await getAccessToken(db, userId)

    const today = todayIn(HEALTH_TZ)
    const start = addDaysIso(today, -(days - 1))
    const endExclusive = addDaysIso(today, 1)
    const none = async <T>() => [] as T[]

    // Data type ids and scopes: https://developers.google.com/health/data-types
    const [steps, activeEnergy, weight, bodyFat, restingHr, hrv, vo2max, sleepPts, exercise] =
      await Promise.all([
        has(SCOPE_ACTIVITY)
          ? dailyRollUp(token, 'steps', start, endExclusive)
          : none<ApiDailyRollupDataPoint>(),
        has(SCOPE_ACTIVITY)
          ? dailyRollUp(token, 'active-energy-burned', start, endExclusive)
          : none<ApiDailyRollupDataPoint>(),
        has(SCOPE_METRICS)
          ? dailyRollUp(token, 'weight', start, endExclusive)
          : none<ApiDailyRollupDataPoint>(),
        has(SCOPE_METRICS)
          ? dailyRollUp(token, 'body-fat', start, endExclusive)
          : none<ApiDailyRollupDataPoint>(),
        has(SCOPE_METRICS)
          ? reconcileAll(
              token,
              'daily-resting-heart-rate',
              `daily_resting_heart_rate.date >= "${start}"`,
            )
          : none<ApiDataPoint>(),
        has(SCOPE_METRICS)
          ? reconcileAll(
              token,
              'daily-heart-rate-variability',
              `daily_heart_rate_variability.date >= "${start}"`,
            )
          : none<ApiDataPoint>(),
        has(SCOPE_ACTIVITY)
          ? reconcileAll(token, 'daily-vo2-max', `daily_vo2_max.date >= "${start}"`)
          : none<ApiDataPoint>(),
        has(SCOPE_SLEEP)
          ? reconcileAll(token, 'sleep', `sleep.interval.civil_end_time >= "${start}"`)
          : none<ApiDataPoint>(),
        has(SCOPE_ACTIVITY)
          ? reconcileAll(token, 'exercise', `exercise.interval.civil_start_time >= "${start}"`)
          : none<ApiDataPoint>(),
      ])

    const payload: SyncPayload = {
      steps,
      activeEnergy,
      weight,
      bodyFat,
      restingHr,
      hrv,
      vo2max,
      sleep: sleepPts,
    }
    const now = new Date().toISOString()
    const daily = normalizeDaily(payload).map((r) => ({ ...r, user_id: userId, updated_at: now }))
    const workouts = normalizeWorkouts(exercise).map((w) => ({
      ...w,
      user_id: userId,
      updated_at: now,
    }))

    if (daily.length) {
      const { error } = await db
        .from('health_daily')
        .upsert(daily, { onConflict: 'user_id,date,source' })
      if (error) throw new HttpError(500, 'db_error', error.message)
    }
    if (workouts.length) {
      const { error } = await db
        .from('health_workouts')
        .upsert(workouts, { onConflict: 'user_id,external_id' })
      if (error) throw new HttpError(500, 'db_error', error.message)
    }

    await db
      .from('health_connections')
      .update({ status: 'connected', last_sync_at: now, last_error: null })
      .eq('user_id', userId)

    return { userId, days, dailyRows: daily.length, workouts: workouts.length }
  } catch (e) {
    const code = e instanceof HttpError ? e.code : 'sync_failed'
    const status =
      code === 'reauth_required'
        ? 'reauth_required'
        : code === 'ACCOUNT_NOT_LINKED'
          ? 'error'
          : undefined
    await db
      .from('health_connections')
      .update({ last_error: code, ...(status ? { status } : {}) })
      .eq('user_id', userId)
    throw e
  }
}

/* ───────────── Actions ───────────── */

async function actionStart(req: Request): Promise<Response> {
  if (!googleConfigured()) return json(req, 503, { error: 'not_configured' })
  const userId = await requireUser(req)
  const state = await signState(STATE_SECRET, userId)
  // https://developers.google.com/identity/protocols/oauth2/web-server#creatingclient
  const url = new URL(GOOGLE_AUTH_URL)
  url.search = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline', // refresh token (data-access guide)
    prompt: 'consent', // always return a refresh token on reconnect
    state,
  }).toString()
  return json(req, 200, { url: url.toString() })
}

async function actionCallback(url: URL): Promise<Response> {
  if (!googleConfigured()) return redirectToApp({ error: 'not_configured' })
  const err = url.searchParams.get('error')
  if (err) return redirectToApp({ error: err }) // e.g. access_denied
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  if (!code || !state) return redirectToApp({ error: 'invalid_request' })

  const payload = await verifyState(STATE_SECRET, state)
  if (!payload) return redirectToApp({ error: 'invalid_state' })
  const userId = payload.u
  const db = admin()

  let tokens: TokenResponse
  try {
    tokens = await tokenRequest({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
    })
  } catch (e) {
    return redirectToApp({ error: e instanceof HttpError ? e.code : 'token_error' })
  }
  if (!tokens.access_token || !tokens.refresh_token) {
    return redirectToApp({ error: 'no_refresh_token' })
  }

  const granted = (tokens.scope ?? '').split(' ').filter((s) => s.includes('googlehealth'))
  if (!granted.length) return redirectToApp({ error: 'missing_permissions' })

  // Verify the Google Account is linked to Google Health before marking it connected.
  // https://developers.google.com/health/setup (Link Google Health), /troubleshooting
  let healthUserId: string | null = null
  try {
    healthUserId = (await getIdentity(tokens.access_token)).healthUserId ?? null
  } catch (e) {
    const code = e instanceof HttpError ? e.code : 'identity_error'
    return redirectToApp({ error: code === 'ACCOUNT_NOT_LINKED' ? 'account_not_linked' : code })
  }

  const now = new Date().toISOString()
  const { error: tErr } = await db.from('health_tokens').upsert({
    user_id: userId,
    refresh_token: tokens.refresh_token,
    access_token: tokens.access_token,
    expires_at: new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString(),
    updated_at: now,
  })
  if (tErr) return redirectToApp({ error: 'db_error' })

  const { error: cErr } = await db.from('health_connections').upsert({
    user_id: userId,
    provider: 'google_health',
    status: 'connected',
    scopes: granted,
    connected_at: now,
    last_sync_at: null,
    last_error: null,
    google_user_id: healthUserId,
  })
  if (cErr) return redirectToApp({ error: 'db_error' })

  try {
    await syncUser(db, userId, FIRST_SYNC_DAYS)
  } catch (e) {
    // Connected, but the first sync failed: the app shows last_error and can retry.
    console.error('initial sync failed', e)
    return redirectToApp({ connected: '1', sync: 'failed' })
  }
  return redirectToApp({ connected: '1' })
}

async function actionSync(req: Request, body: Record<string, unknown>): Promise<Response> {
  const db = admin()
  const days = typeof body.days === 'number' ? Math.floor(body.days) : undefined

  const cronHeader = req.headers.get('x-cron-secret') ?? ''
  if (cronHeader) {
    if (!constantTimeEquals(CRON_SECRET, cronHeader))
      return json(req, 401, { error: 'unauthorized' })
    const { data, error } = await db
      .from('health_connections')
      .select('user_id')
      .eq('provider', 'google_health')
      .eq('status', 'connected')
    if (error) return json(req, 500, { error: 'db_error' })
    const results: SyncResult[] = []
    for (const { user_id } of (data ?? []) as { user_id: string }[]) {
      try {
        results.push(await syncUser(db, user_id, days))
      } catch (e) {
        results.push({
          userId: user_id,
          days: 0,
          dailyRows: 0,
          workouts: 0,
          error: e instanceof HttpError ? e.code : 'sync_failed',
        })
      }
    }
    return json(req, 200, { results })
  }

  const userId = await requireUser(req)
  const r = await syncUser(db, userId, days)
  return json(req, 200, { days: r.days, dailyRows: r.dailyRows, workouts: r.workouts })
}

async function actionDisconnect(req: Request): Promise<Response> {
  const userId = await requireUser(req)
  const db = admin()
  const { data } = await db
    .from('health_tokens')
    .select('refresh_token, access_token')
    .eq('user_id', userId)
    .maybeSingle<{ refresh_token: string; access_token: string | null }>()

  let revoked = false
  if (data?.refresh_token) {
    // https://developers.google.com/identity/protocols/oauth2/web-server#tokenrevoke
    // Revoking the refresh token also invalidates its access tokens.
    const res = await fetch(GOOGLE_REVOKE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: data.refresh_token }),
    }).catch(() => null)
    revoked = Boolean(res?.ok)
  }

  await db.from('health_tokens').delete().eq('user_id', userId)
  await db.from('health_connections').delete().eq('user_id', userId)
  return json(req, 200, { disconnected: true, revoked })
}

/* ───────────── Router ───────────── */

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) })
  const url = new URL(req.url)

  let body: Record<string, unknown> = {}
  if (req.method === 'POST') {
    body = ((await req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>
  }
  const action =
    url.searchParams.get('action') ?? (typeof body.action === 'string' ? body.action : '')

  try {
    if (action === 'callback' && req.method === 'GET') return await actionCallback(url)
    if (req.method !== 'POST') return json(req, 405, { error: 'method_not_allowed' })
    switch (action) {
      case 'start':
        return await actionStart(req)
      case 'sync':
        return await actionSync(req, body)
      case 'disconnect':
        return await actionDisconnect(req)
      default:
        return json(req, 400, { error: 'unknown_action' })
    }
  } catch (e) {
    if (e instanceof HttpError) {
      const status = e.status >= 400 && e.status < 600 ? e.status : 500
      return json(req, status, { error: e.code })
    }
    console.error(e)
    return json(req, 500, { error: 'internal_error' })
  }
})
