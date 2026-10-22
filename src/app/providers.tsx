import { QueryClientProvider } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { useState, type ReactNode } from 'react'
import { ToastProvider } from '@/components/ui/Toast'
import { SessionProvider } from '@/features/auth/SessionProvider'
import { registerMutationDefaults } from '@/data/hooks'
import { WriteErrorToasts } from '@/data/WriteErrorToasts'
import { CACHE_BUSTER, createIdbPersister, createQueryClient } from '@/lib/queryClient'

export function Providers({ children }: { children: ReactNode }) {
  // One client and persister per app lifetime (useState initialisers never re-run).
  const [client] = useState(() => {
    const qc = createQueryClient()
    registerMutationDefaults(qc)
    return qc
  })
  const [persister] = useState(() => createIdbPersister())
  const canPersist = typeof indexedDB !== 'undefined'

  const tree = (
    <SessionProvider>
      <ToastProvider>
        <WriteErrorToasts />
        {children}
      </ToastProvider>
    </SessionProvider>
  )

  if (!canPersist) return <QueryClientProvider client={client}>{tree}</QueryClientProvider>

  return (
    <PersistQueryClientProvider
      client={client}
      persistOptions={{
        persister,
        buster: CACHE_BUSTER,
        maxAge: 1000 * 60 * 60 * 24 * 7,
        dehydrateOptions: {
          shouldDehydrateQuery: (q) => q.state.status === 'success',
        },
      }}
      onSuccess={() => {
        void client.resumePausedMutations().then(() => client.invalidateQueries())
      }}
    >
      {tree}
    </PersistQueryClientProvider>
  )
}
