import type { Session, User } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { getSupabase } from '@/lib/supabase'

export type SessionStatus = 'loading' | 'signed_out' | 'signed_in'

export interface SessionState {
  status: SessionStatus
  session: Session | null
  user: User | null
}

const SessionContext = createContext<SessionState>({
  status: 'loading',
  session: null,
  user: null,
})

/** A fixed session, for the development lab (lab.html). The app itself never uses it. */
export function FixedSessionProvider({
  value,
  children,
}: {
  value: SessionState
  children: ReactNode
}) {
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const supabase = getSupabase()
  const [state, setState] = useState<SessionState>(() =>
    supabase
      ? { status: 'loading', session: null, user: null }
      : { status: 'signed_out', session: null, user: null },
  )

  useEffect(() => {
    if (!supabase) return
    let cancelled = false

    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      setState({
        status: data.session ? 'signed_in' : 'signed_out',
        session: data.session,
        user: data.session?.user ?? null,
      })
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({
        status: session ? 'signed_in' : 'signed_out',
        session,
        user: session?.user ?? null,
      })
    })

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [supabase])

  const value = useMemo(() => state, [state])
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): SessionState {
  return useContext(SessionContext)
}

/** Throws when used outside a signed-in tree (guarded by <AuthGate>). */
export function useUser(): User {
  const { user } = useSession()
  if (!user) throw new Error('useUser requires a signed-in session')
  return user
}
