import { QueryClient } from '@tanstack/react-query'
import type { Persister, PersistedClient } from '@tanstack/react-query-persist-client'
import { del, get, set } from 'idb-keyval'

const PERSIST_KEY = 'forja.query-cache.v1'

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

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 1000 * 60 * 60 * 24 * 7, // keep a week of cache for offline use
        retry: (failureCount, error) => {
          // Do not hammer auth/permission errors.
          const status = (error as { status?: number } | null)?.status
          if (status && status >= 400 && status < 500) return false
          return failureCount < 2
        },
        refetchOnWindowFocus: true,
        networkMode: 'offlineFirst',
      },
      mutations: {
        networkMode: 'offlineFirst',
        retry: 1,
      },
    },
  })
}

/** Bump when the persisted shape changes so stale caches are discarded. */
export const CACHE_BUSTER = 'f1'
