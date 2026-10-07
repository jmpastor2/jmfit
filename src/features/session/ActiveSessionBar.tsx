import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useActiveWorkout } from '@/data/hooks'
import { fmtClock, useRest } from './restTimer'

/** While a session is open, a slim gold bar above the dock leads back to it. */
export function ActiveSessionBar() {
  const workout = useActiveWorkout()
  const { rest, left } = useRest()
  if (!workout) return null
  return (
    <Link
      to="/session"
      className="fixed inset-x-0 bottom-[calc(max(env(safe-area-inset-bottom),8px)+62px)] z-40 mx-auto flex max-w-md items-center gap-3 border-y border-gold/50 bg-black/95 px-4 py-2.5 backdrop-blur-xl sm:rounded-[8px] sm:border"
    >
      <span className="size-2 shrink-0 animate-pulse rounded-full bg-gold" />
      <span className="min-w-0 flex-1">
        <span className="spec block text-gold">Sesión en curso</span>
        <span className="block truncate text-[14px] font-medium">{workout.name}</span>
      </span>
      {rest && (
        <span className="readout text-[22px] font-semibold text-ink">
          {left ? fmtClock(left) : '0:00'}
        </span>
      )}
      <ChevronRight className="size-5 text-gold" />
    </Link>
  )
}
