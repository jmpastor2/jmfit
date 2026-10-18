/**
 * Web Push on this device: capability checks, permission and the subscription the
 * rest-alarms Edge Function delivers to. iOS only allows it from the installed app
 * (Safari → Compartir → Añadir a pantalla de inicio, iOS 16.4+).
 */
import { env } from './env'
import { requireSupabase } from './supabase'

export type PushSupport = 'ok' | 'ios-install' | 'unsupported'

const ENABLED_KEY = 'forja.push'

export function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function isIos(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1)
  )
}

export function pushSupport(): PushSupport {
  if (!env.vapidPublicKey) return 'unsupported'
  if (isIos() && !isStandalone()) return 'ios-install'
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window))
    return 'unsupported'
  return 'ok'
}

/** Rest alarms are on for this device (it subscribed and the person has not turned them off). */
export function pushEnabledHere(): boolean {
  try {
    return (
      localStorage.getItem(ENABLED_KEY) === '1' &&
      'Notification' in window &&
      Notification.permission === 'granted'
    )
  } catch {
    return false
  }
}

function setEnabledHere(on: boolean) {
  try {
    if (on) localStorage.setItem(ENABLED_KEY, '1')
    else localStorage.removeItem(ENABLED_KEY)
  } catch {
    /* private mode */
  }
}

async function readyRegistration(timeoutMs = 4000): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ])
}

function base64UrlToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

const sameBytes = (a: Uint8Array, b: Uint8Array) =>
  a.length === b.length && a.every((x, i) => x === b[i])

export type PushErrorCode = 'no-key' | 'no-sw' | 'denied' | 'server'

export class PushError extends Error {
  readonly code: PushErrorCode
  constructor(code: PushErrorCode, message?: string) {
    super(message ?? code)
    this.code = code
  }
}

/** Ask for permission (must run from a tap), subscribe this device and store it. */
export async function enablePush(): Promise<void> {
  const key = env.vapidPublicKey
  if (!key) throw new PushError('no-key')
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new PushError('denied')
  const reg = await readyRegistration()
  if (!reg) throw new PushError('no-sw')

  const serverKey = base64UrlToBytes(key)
  let sub = await reg.pushManager.getSubscription()
  // A subscription made with another server key cannot receive our messages.
  const current = sub?.options.applicationServerKey
  if (sub && current && !sameBytes(new Uint8Array(current), serverKey)) {
    await sub.unsubscribe()
    sub = null
  }
  sub ??= await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: serverKey,
  })

  const json = sub.toJSON()
  const { error } = await requireSupabase()
    .from('push_subscriptions')
    .upsert(
      {
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh ?? '',
        auth: json.keys?.auth ?? '',
        user_agent: navigator.userAgent.slice(0, 300),
      },
      { onConflict: 'endpoint' },
    )
  if (error) throw new PushError('server', error.message)
  setEnabledHere(true)
}

export async function disablePush(): Promise<void> {
  setEnabledHere(false)
  const reg = await readyRegistration(1500)
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return
  await requireSupabase().from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
  await sub.unsubscribe()
}
