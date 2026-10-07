import { clsx } from 'clsx'
import type { HTMLAttributes, ReactNode } from 'react'

export interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: ReactNode
  /** Silkscreen label above the title, e.g. "01 · PAUTAS". */
  eyebrow?: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
  padded?: boolean
  /** Hero panels get registration marks in two corners. */
  instrument?: boolean
  tone?: 'default' | 'signal' | 'warn' | 'danger' | 'accent'
}

const tones = {
  default: '',
  signal: 'border-signal/25 bg-[color-mix(in_oklab,var(--signal)_6%,var(--panel))]',
  warn: 'border-warn/30 bg-[color-mix(in_oklab,var(--warn)_7%,var(--panel))]',
  danger: 'border-danger/30 bg-[color-mix(in_oklab,var(--danger)_7%,var(--panel))]',
  accent: 'border-accent/25 bg-[color-mix(in_oklab,var(--accent)_7%,var(--panel))]',
}

export function Card({
  title,
  eyebrow,
  subtitle,
  action,
  padded = true,
  instrument = false,
  tone = 'default',
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <section
      className={clsx(
        'card fade-up',
        instrument && 'instrument',
        tones[tone],
        padded && 'p-4',
        className,
      )}
      {...rest}
    >
      {(title || action || eyebrow) && (
        <header className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {eyebrow && <div className="spec mb-1">{eyebrow}</div>}
            {title && (
              <h2 className="font-display text-[19px] font-semibold uppercase tracking-[0.06em] text-ink">
                {title}
              </h2>
            )}
            {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      {children}
    </section>
  )
}
