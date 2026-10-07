/**
 * Development lab entry (lab.html). Runs the real routes and screens on a local copy of the real
 * account; nothing here is imported by the published app.
 */
import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import '@/styles/globals.css'
import { router } from '@/app/App'
import { ToastProvider } from '@/components/ui/Toast'
import { registerMutationDefaults } from '@/data/hooks'
import { FixedSessionProvider, type SessionState } from '@/features/auth/SessionProvider'
import { createQueryClient } from '@/lib/queryClient'
import { setSupabaseClient } from '@/lib/supabase'
import { createFakeSupabase } from './fakeSupabase'
import { loadRealAccount } from './snapshot'

/** `?now=2026-10-08T18:00` makes the lab behave as if it were that moment (the clock keeps ticking). */
function installClock(at: string | null) {
  const target = at ? new Date(at).getTime() : Number.NaN
  if (Number.isNaN(target)) return
  const offset = target - Date.now()
  const Real = Date
  class LabDate extends Real {
    constructor(...args: [] | [number | string | Date] | number[]) {
      if (args.length === 0) super(Real.now() + offset)
      else if (args.length === 1) super(args[0] as number)
      else super(...(args as [number, number]))
    }
    static override now() {
      return Real.now() + offset
    }
  }
  globalThis.Date = LabDate as DateConstructor
}
const params = new URLSearchParams(window.location.search)
installClock(params.get('now'))

const real = loadRealAccount()
const root = createRoot(document.getElementById('root')!)

if (!real) {
  root.render(
    <p style={{ color: '#f3f0e8', padding: 24, fontFamily: 'system-ui' }}>
      Falta src/dev/real-snapshot.json: node scripts/snapshot.mjs &lt;uuid&gt;
    </p>,
  )
} else {
  setSupabaseClient(createFakeSupabase(real.store, real.user))
  // Handy in the browser console: inspect or tweak the data, then reload the screen.
  Object.assign(window, { lab: { store: real.store } })
  const session: SessionState = {
    status: 'signed_in',
    session: null,
    user: { id: real.user.id, email: real.user.email } as SessionState['user'],
  }
  const client = createQueryClient()
  registerMutationDefaults(client)
  root.render(
    <StrictMode>
      <QueryClientProvider client={client}>
        <FixedSessionProvider value={session}>
          <ToastProvider>
            <RouterProvider router={router} />
          </ToastProvider>
        </FixedSessionProvider>
      </QueryClientProvider>
    </StrictMode>,
  )
}
