import { clsx } from 'clsx'
import { fmtClock, restTimer, useRest } from './restTimer'

/**
 * Rest between sets: a big countdown docked at the bottom, a gold bar that empties, ±15 s and
 * skip. When it reaches zero it says so and stays until dismissed or the next set is logged.
 */
export function RestPanel() {
  const { rest, left } = useRest()
  if (!rest) return null
  const over = left === 0
  const frac = rest.totalSec ? left / rest.totalSec : 0
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-black/95 pb-[max(env(safe-area-inset-bottom),10px)] backdrop-blur-xl">
      <div className="h-[2px] w-full bg-panel-3">
        <div
          className="h-full bg-gold transition-[width] duration-300 ease-linear"
          style={{ width: `${frac * 100}%` }}
        />
      </div>
      <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 pt-3">
        <div className="min-w-0 flex-1">
          <div className={clsx('spec', over && 'text-gold')}>
            {over ? 'A por la siguiente' : 'Descanso'}
          </div>
          <div className="truncate text-[13px] text-muted">{rest.label}</div>
        </div>
        <div
          className={clsx(
            'readout text-[44px] font-semibold leading-none',
            over ? 'text-gold' : 'text-ink',
          )}
          role="timer"
          aria-live="off"
        >
          {fmtClock(left)}
        </div>
      </div>
      <div className="mx-auto grid max-w-2xl grid-cols-3 gap-2 px-4 pt-3">
        <RestButton onClick={() => restTimer.add(-15)}>−15 s</RestButton>
        <RestButton onClick={() => restTimer.add(15)}>+15 s</RestButton>
        <RestButton gold onClick={() => restTimer.stop()}>
          {over ? 'Cerrar' : 'Saltar'}
        </RestButton>
      </div>
    </div>
  )
}

function RestButton({
  children,
  onClick,
  gold,
}: {
  children: React.ReactNode
  onClick: () => void
  gold?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'h-12 rounded-[8px] border font-display text-[16px] font-semibold uppercase tracking-[0.1em] active:scale-[0.98]',
        gold ? 'border-gold text-gold' : 'border-line text-ink-2',
      )}
    >
      {children}
    </button>
  )
}
