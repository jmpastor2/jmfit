/**
 * Supabase Edge Function · rest-alarms
 *
 * Called by pg_cron (job 'forja-rest-alarms', supabase/migrations/20261008000000_rest_push.sql)
 * only when a rest alarm is due, with the header `x-cron-secret` instead of a JWT:
 *
 *   npx supabase functions deploy rest-alarms --project-ref jzhltzafdqipeortwdra --no-verify-jwt
 *
 * Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, CRON_SECRET (SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY are provided by Supabase).
 *
 * Sends «Descanso terminado» to every device of each person whose alarm is due, deletes the
 * alarm, and forgets subscriptions the push service reports as gone (404/410).
 */
import { createClient } from 'jsr:@supabase/supabase-js@2'
import webpushModule from 'npm:web-push@3.6.7'

/** web-push is CommonJS without bundled types: the part used here, typed by hand. */
type WebPush = {
  setVapidDetails(subject: string, publicKey: string, privateKey: string): void
  sendNotification(
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
    payload: string,
    options: { TTL: number; urgency: 'very-low' | 'low' | 'normal' | 'high'; timeout: number },
  ): Promise<{ statusCode: number }>
}
const webpush = webpushModule as unknown as WebPush

/** A rest alarm older than this is not worth a notification any more. */
const STALE_MS = 2 * 60_000

function env(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`missing environment variable ${name}`)
  return value
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

/** Constant-time comparison for the cron secret. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

Deno.serve(async (req) => {
  if (!safeEqual(req.headers.get('x-cron-secret') ?? '', env('CRON_SECRET'))) {
    return json(401, { error: 'unauthorized' })
  }
  const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  webpush.setVapidDetails(env('VAPID_SUBJECT'), env('VAPID_PUBLIC_KEY'), env('VAPID_PRIVATE_KEY'))

  const now = Date.now()
  const { data: alarms, error } = await db
    .from('rest_alarms')
    .select('user_id,fire_at,label')
    .lte('fire_at', new Date(now + 1000).toISOString())
  if (error) return json(500, { error: error.message })
  if (!alarms?.length) return json(200, { sent: 0 })

  // Claim the alarms first: a slow push must not make the next cron run send them again.
  const users = alarms.map((a) => a.user_id as string)
  await db.from('rest_alarms').delete().in('user_id', users).lte('fire_at', new Date(now + 1000).toISOString())

  const fresh = alarms.filter((a) => now - Date.parse(a.fire_at as string) < STALE_MS)
  if (!fresh.length) return json(200, { sent: 0, stale: alarms.length })

  const { data: subs } = await db
    .from('push_subscriptions')
    .select('endpoint,user_id,p256dh,auth')
    .in('user_id', fresh.map((a) => a.user_id as string))

  let sent = 0
  const gone: string[] = []
  await Promise.all(
    (subs ?? []).map(async (s) => {
      const alarm = fresh.find((a) => a.user_id === s.user_id)!
      const payload = JSON.stringify({
        title: 'Descanso terminado',
        body: alarm.label ? `${alarm.label}: a por la siguiente serie` : 'A por la siguiente serie',
        url: '#/session',
        tag: 'forja-rest',
      })
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint as string, keys: { p256dh: s.p256dh as string, auth: s.auth as string } },
          payload,
          // A rest alert is useless a minute late: short TTL, high urgency.
          { TTL: 60, urgency: 'high', timeout: 10_000 },
        )
        sent++
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) gone.push(s.endpoint as string)
        else console.error('push failed', status, err instanceof Error ? err.message : err)
      }
    }),
  )
  if (gone.length) await db.from('push_subscriptions').delete().in('endpoint', gone)
  return json(200, { sent, gone: gone.length })
})
