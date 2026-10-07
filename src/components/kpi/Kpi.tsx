import { clsx } from 'clsx'
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react'
import type { ReactNode } from 'react'

const TONE = {
  default: 'text-ink',
  signal: 'text-signal',
  warn: 'text-warn',
  danger: 'text-danger',
  muted: 'text-muted',
} as const

export type KpiTone = keyof typeof TONE

/**
 * One indicator: a quiet label, one big number with its unit, a line that says what it means,
 * and room underneath for a small graphic (Meter, Ticks, Steps, Spark). Everything a reader
 * needs is in the text; the graphic only shows the shape.
 */
export function Kpi({
  label,
  value,
  unit,
  caption,
  tone = 'default',
  size = 'md',
  aside,
  children,
  className,
}: {
  label: ReactNode
  value: ReactNode
  unit?: ReactNode
  caption?: ReactNode
  tone?: KpiTone
  size?: 'sm' | 'md' | 'lg'
  /** Small content at the right of the number (a Delta, a badge). */
  aside?: ReactNode
  children?: ReactNode
  className?: string
}) {
  return (
    <div className={clsx('flex min-w-0 flex-col', className)}>
      <span className="spec">{label}</span>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span
          className={clsx(
            'readout font-semibold leading-none',
            size === 'lg' ? 'text-[40px]' : size === 'md' ? 'text-[28px]' : 'text-[22px]',
            TONE[tone],
          )}
        >
          {value}
          {unit && (
            <span className="ml-1 font-sans text-[13px] font-medium tracking-normal text-muted">
              {unit}
            </span>
          )}
        </span>
        {aside}
      </div>
      {caption && <span className="mt-1.5 text-[12.5px] leading-snug text-muted">{caption}</span>}
      {children && <div className="mt-3">{children}</div>}
    </div>
  )
}

/**
 * A change with its direction. `tone` says whether the change is good news for this measure
 * (weight down is not good news for everyone, so the caller decides): good uses the accent,
 * bad uses amber, neutral stays muted. No red and green.
 */
export function Delta({
  text,
  direction,
  tone = 'neutral',
  className,
}: {
  text: ReactNode
  direction: 'up' | 'down' | 'flat'
  tone?: 'good' | 'bad' | 'neutral'
  className?: string
}) {
  const Icon =
    direction === 'up' ? ArrowUpRight : direction === 'down' ? ArrowDownRight : ArrowRight
  return (
    <span
      className={clsx(
        'readout inline-flex items-center gap-0.5 text-[13px] font-semibold',
        tone === 'good' ? 'text-signal' : tone === 'bad' ? 'text-warn' : 'text-muted',
        className,
      )}
    >
      <Icon className="size-3.5" strokeWidth={2.4} aria-hidden />
      {text}
    </span>
  )
}
