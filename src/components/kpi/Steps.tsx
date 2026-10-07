import { clsx } from 'clsx'

export interface Step {
  /** Relative height 0..1 (a dose step drawn as a staircase); 1 when omitted. */
  level?: number
  kind?: 'done' | 'current' | 'planned' | 'rest'
}

/**
 * A row of steps for a cycle or a titration: weeks done are solid, the current one is solid
 * with a marker underneath, planned ones are faint and rest weeks are hatched. With `level`
 * the bars rise with the dose, so the shape of the plan reads at a glance.
 */
export function Steps({
  steps,
  color = 'var(--signal)',
  height = 28,
  label,
  className,
}: {
  steps: readonly Step[]
  color?: string
  height?: number
  label?: string
  className?: string
}) {
  return (
    <div
      className={clsx('flex items-end gap-[3px]', className)}
      style={{ height: height + 6 }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {steps.map((s, i) => {
        const kind = s.kind ?? 'planned'
        const level = Math.min(1, Math.max(0.18, s.level ?? 1))
        return (
          <span key={i} data-kind={kind} className="flex min-w-[4px] flex-1 flex-col items-stretch">
            <span
              className="rounded-[3px]"
              style={{
                height: height * level,
                background:
                  kind === 'done'
                    ? `color-mix(in oklab, ${color} 55%, var(--panel-3))`
                    : kind === 'current'
                      ? color
                      : kind === 'rest'
                        ? 'repeating-linear-gradient(135deg, var(--line-strong) 0 2px, transparent 2px 5px)'
                        : 'var(--panel-3)',
              }}
            />
            <span
              className="mx-auto mt-[3px] h-[3px] w-[3px] rounded-full"
              style={{ background: kind === 'current' ? 'var(--ink)' : 'transparent' }}
            />
          </span>
        )
      })}
    </div>
  )
}
