import { useQueryClient } from '@tanstack/react-query'
import { WifiOff } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Navigate, Outlet, useLocation, useNavigationType } from 'react-router-dom'
import { prefetchCore, useProfile } from '@/data/hooks'
import { useSession } from '@/features/auth/SessionProvider'
import { ActiveSessionBar } from '@/features/session/ActiveSessionBar'
import { useOnline } from '@/lib/useOnline'
import { Splash } from './Splash'
import { TabBar } from './TabBar'

/** Authenticated frame: gates on session and onboarding, renders the dock. */
export function AppShell() {
  useScrollMemory()
  const { status, user } = useSession()
  const qc = useQueryClient()
  const userId = user?.id
  useEffect(() => {
    if (userId) void prefetchCore(qc, userId)
  }, [qc, userId])
  const profile = useProfile(userId)
  const online = useOnline()
  const { pathname } = useLocation()
  // The session player is a full-screen tool: no dock, nothing else competing for the thumb.
  const immersive = pathname === '/session'

  if (status === 'loading') return <Splash />
  if (status === 'signed_out') return <Navigate to="/auth" replace />
  if (profile.isPending) return <Splash />
  if (profile.isError || !profile.data) return <Splash error={profile.error?.message} />
  if (!profile.data.onboarded) return <Navigate to="/onboarding" replace />

  return (
    <div className="min-h-dvh">
      {!online && (
        <div className="safe-top flex items-center justify-center gap-2 bg-warn-soft px-4 py-1.5 text-[12.5px] font-medium text-warn">
          <WifiOff className="size-3.5" /> Sin conexión: todo se guarda y se envía al volver
        </div>
      )}
      <main
        className={immersive ? 'mx-auto w-full max-w-2xl' : 'mx-auto w-full max-w-2xl px-4 pb-36'}
      >
        <Outlet />
      </main>
      {!immersive && (
        <>
          <ActiveSessionBar />
          <TabBar />
        </>
      )}
    </div>
  )
}

/** New screens start at the top; going back returns to where you were. */
function useScrollMemory() {
  const location = useLocation()
  const navType = useNavigationType()
  const positions = useRef(new Map<string, number>())

  useEffect(() => {
    const key = location.key
    const saved = positions.current.get(key)
    window.scrollTo(0, navType === 'POP' && saved !== undefined ? saved : 0)
    const onScroll = () => positions.current.set(key, window.scrollY)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [location.key, navType])
}
