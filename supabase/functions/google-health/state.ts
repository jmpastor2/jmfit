/**
 * Signed OAuth `state`: base64url(JSON payload) + "." + base64url(HMAC-SHA256(payload)).
 * Payload carries the Supabase user id, a random nonce and an expiry (unix seconds).
 * Uses only Web Crypto, available in Deno and in modern Node.
 */

export interface StatePayload {
  /** Supabase auth user id. */
  u: string
  /** Random nonce. */
  n: string
  /** Expiry, unix seconds. */
  e: number
}

const enc = new TextEncoder()

function b64url(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromB64url(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function hmac(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data)))
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!
  return diff === 0
}

export async function signState(
  secret: string,
  userId: string,
  ttlSeconds = 600,
  now: number = Date.now(),
): Promise<string> {
  const nonce = b64url(crypto.getRandomValues(new Uint8Array(16)))
  const payload: StatePayload = { u: userId, n: nonce, e: Math.floor(now / 1000) + ttlSeconds }
  const body = b64url(enc.encode(JSON.stringify(payload)))
  return `${body}.${b64url(await hmac(secret, body))}`
}

/** Returns the payload when the signature is valid and not expired, else null. */
export async function verifyState(
  secret: string,
  state: string,
  now: number = Date.now(),
): Promise<StatePayload | null> {
  const [body, sig] = state.split('.')
  if (!body || !sig) return null
  let given: Uint8Array
  try {
    given = fromB64url(sig)
  } catch {
    return null
  }
  if (!timingSafeEqual(await hmac(secret, body), given)) return null
  try {
    const p = JSON.parse(new TextDecoder().decode(fromB64url(body))) as Partial<StatePayload>
    if (typeof p.u !== 'string' || typeof p.n !== 'string' || typeof p.e !== 'number') return null
    if (p.e < Math.floor(now / 1000)) return null
    return { u: p.u, n: p.n, e: p.e }
  } catch {
    return null
  }
}
