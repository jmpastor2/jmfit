import { QueryClient } from '@tanstack/react-query'
import type { Persister, PersistedClient } from '@tanstack/react-query-persist-client'
import { del, get, set } from 'idb-keyval'

const PERSIST_KEY = 'forja.query-cache.v1'

/** Every write shares this scope: they reach the server one at a time, in the order made. */
export const WRITE_SCOPE = 'forja-writes'

/**
 * Offline-first cache: queries are persisted to IndexedDB so the app opens
 * instantly with the last known data and paused mutations resume when online.
 */
export function createIdbPersister(key: string = PERSIST_KEY): Persister {
  return {
    persistClient: async (client: PersistedClient) => {
      await set(key, client)
    },
    restoreClient: async () => (await get<PersistedClient>(key)) ?? undefined,
    removeClient: async () => {
      await del(key)
    },
  }
}

/**
 * Codes that say "try again later" rather than "this will never work": PostgREST could not
 * reach the database (PGRST000-002), an expired token the client refreshes on its own
 * (PGRST301/303), and Postgres connection, shutdown, deadlock and serialization failures.
 */
const TRANSIENT_CODES = /^(PGRST00\d|PGRST30[13]|08\w{3}|57P0\d|40001|40P01)$/

/**
 * Whether a failed request is worth sending again. supabase-js does not throw: it answers an
 * error object. A request that never reached the server (no signal, a captive Wi-Fi, a proxy
 * page) carries an empty `code`; a real answer from the database carries its code (`42501`
 * for RLS, `23505` for a duplicate…) and repeating it changes nothing. Auth errors carry an
 * HTTP `status` instead.
 */
export function isTransientError(error: unknown): boolean {
  if (error == null || typeof error !== 'object') return true
  const { code, status } = error as { code?: unknown; status?: unknown }
  if (
    typeof status === 'number' &&
    status >= 400 &&
    status < 500 &&
    status !== 408 &&
    status !== 429
  )
    return false
  if (typeof code === 'string' && code !== '') return TRANSIENT_CODES.test(code)
  return true
}

/**
 * Writes keep trying while the server cannot be reached. Time without connection does not
 * count (TanStack pauses retries while offline); this bounds the attempts made while the
 * phone says "online" but nothing gets through: with the 30 s ceiling, about an hour.
 */
export const MAX_WRITE_ATTEMPTS = 120

export function shouldRetryWrite(failureCount: number, error: unknown): boolean {
  return failureCount < MAX_WRITE_ATTEMPTS && isTransientError(error)
}

/** 1 s, 2 s, 4 s… up to 30 s between attempts. */
export function writeRetryDelay(failureCount: number): number {
  return Math.min(1000 * 2 ** failureCount, 30_000)
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 1000 * 60 * 60 * 24 * 7, // keep a week of cache for offline use
        // Do not hammer auth, permission or other definite errors.
        retry: (failureCount, error) => failureCount < 2 && isTransientError(error),
        refetchOnWindowFocus: true,
        networkMode: 'offlineFirst',
      },
      mutations: {
        networkMode: 'offlineFirst',
        retry: shouldRetryWrite,
        retryDelay: writeRetryDelay,
      },
    },
  })
}

/** Bump when the persisted shape changes so stale caches are discarded. */
export const CACHE_BUSTER = 'f1'
