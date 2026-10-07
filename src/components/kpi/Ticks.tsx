import { clsx } from 'clsx'

export type TickState = 'full' | 'partial' | 'missed' | 'none' | 'rest'

const FILL: Record<TickState, string> = {
  full: 'var(--tick-color)',
  partial: 'color-mix(in oklab, var(--tick-color) 42%, var(--panel-3))',
  missed: 'var(--danger-soft)',
  none: 'var(--panel-3)',
  rest: 'transparent',
}

/**
 * One slim bar per day, oldest first. Full days are solid, partial ones half-tone, missed ones
 * rose, days without anything planned stay as a faint track and rest days as an outline. Today
 * (the last bar, or `todayIndex`) gets a small mark underneath. Decoration: the summary goes in `label` or in nearby text.
 */
export function Ticks({
  cells,
  color = 'var(--signal)',
  height = 18,
  todayLast = true,
  todayIndex,
  label,
  className,
}: {
  cells: readonly TickState[]
  color?: string
  height?: number
  todayLast?: boolean
  /** Index of today when it is not the last bar (a Monday-to-Sunday week); wins over todayLast. */
  todayIndex?: number
  label?: string
  className?: string
}) {
  return (
    <div
      className={clsx('flex gap-[3px]', className)}
      style={{ ['--tick-color' as string]: color }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {cells.map((state, i) => {
        const today =
          todayIndex !== undefined ? i === todayIndex : todayLast && i === cells.length - 1
        return (
          <span key={i} className="flex min-w-[3px] flex-1 flex-col">
            <span className="flex items-end" style={{ height }}>
              <span
                data-state={state}
                data-today={today || undefined}
                className={clsx(
                  'w-full rounded-[3px]',
                  state === 'rest' && 'shadow-[inset_0_0_0_1px_var(--line-strong)]',
                  state === 'missed' &&
                    'shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--danger)_55%,transparent)]',
                )}
                style={{
                  height: state === 'none' || state === 'rest' ? '45%' : '100%',
                  background: FILL[state],
                }}
              />
            </span>
            {/* today: a small ink mark under its bar, as in Steps */}
            <span
              className="mx-auto mt-[3px] h-[3px] w-[3px] rounded-full"
              style={{ background: today ? 'var(--ink)' : 'transparent' }}
            />
          </span>
        )
      })}
    </div>
  )
}
