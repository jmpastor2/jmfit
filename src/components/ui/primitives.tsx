import { clsx } from 'clsx'
import type { HTMLAttributes, ReactNode } from 'react'

/* ---------- Badge ---------- */
type BadgeTone = 'neutral' | 'brand' | 'accent' | 'ok' | 'warn' | 'danger'
const badgeTones: Record<BadgeTone, string> = {
  neutral: 'bg-panel-3 text-ink-2',
  brand: 'bg-signal-soft text-signal',
  accent: 'bg-accent-soft text-accent',
  ok: 'bg-ok-soft text-ok',
  warn: 'bg-warn-soft text-warn',
  danger: 'bg-danger-soft text-danger',
}
export function Badge({
  tone = 'neutral',
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-[3px] text-[11.5px] font-semibold leading-tight',
        badgeTones[tone],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  )
}

/* ---------- Stat: instrument readout ---------- */
export function Stat({
  label,
  value,
  unit,
  hint,
  tone,
  size = 'md',
  className,
}: {
  label: ReactNode
  value: ReactNode
  unit?: ReactNode
  hint?: ReactNode
  tone?: 'brand' | 'accent' | 'warn' | 'danger' | 'ok'
  size?: 'md' | 'lg'
  className?: string
}) {
  const toneClass = {
    brand: 'text-signal',
    accent: 'text-accent',
    warn: 'text-warn',
    danger: 'text-danger',
    ok: 'text-ok',
  }
  return (
    <div className={clsx('flex flex-col', className)}>
      {label && <span className="spec">{label}</span>}
      <span
        className={clsx(
          'readout mt-1 font-semibold leading-none',
          size === 'lg' ? 'text-[34px]' : 'text-[24px]',
          tone && toneClass[tone],
        )}
      >
        {value}
        {unit && <span className="ml-1 text-[12px] font-medium text-muted">{unit}</span>}
      </span>
      {hint && <span className="mt-1.5 text-[12.5px] text-muted">{hint}</span>}
    </div>
  )
}

/* ---------- Switch ---------- */
/** The track and thumb of a switch, 50 x 30. */
function SwitchTrack({ checked }: { checked: boolean }) {
  return (
    <span
      className={clsx(
        'relative block h-[30px] w-[50px] shrink-0 rounded-full border transition',
        checked ? 'glow border-signal/60 bg-signal' : 'border-line-strong bg-panel-3',
      )}
    >
      <span
        className={clsx(
          'absolute top-[3px] size-[22px] rounded-full shadow transition-all',
          checked ? 'left-[23px] bg-signal-ink' : 'left-[3px] bg-ink-2',
        )}
      />
    </span>
  )
}

/** iOS-style on/off switch. The 50 x 30 track sits in a 44 px target. */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="group grid h-11 w-[54px] shrink-0 place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-signal/60 disabled:opacity-50"
    >
      <SwitchTrack checked={checked} />
    </button>
  )
}

/**
 * A setting with a name, a line that explains it and a switch. The whole row is the control
 * (and the target), so the words can be tapped as well as the track.
 */
export function ToggleRow({
  checked,
  onChange,
  label,
  hint,
  tone = 'default',
  className,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: ReactNode
  hint?: ReactNode
  tone?: 'default' | 'signal'
  className?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={clsx(
        'flex min-h-[60px] w-full items-center justify-between gap-3 rounded-control border px-3.5 py-2.5 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-signal/60',
        tone === 'signal' ? 'border-signal/30 bg-signal-soft' : 'border-line bg-panel-2',
        className,
      )}
    >
      <span className="min-w-0">
        <span className="block text-[14px] font-semibold">{label}</span>
        {hint && <span className="block text-[12px] leading-snug text-muted">{hint}</span>}
      </span>
      <SwitchTrack checked={checked} />
    </button>
  )
}

/* ---------- Segmented control ---------- */
/**
 * Pill with two to four choices. Each option is a full 44 px target that fills the height of
 * the track; the lit pill inside keeps the size it always had.
 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  size = 'md',
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: ReactNode }[]
  className?: string
  size?: 'sm' | 'md'
}) {
  return (
    <div
      role="tablist"
      className={clsx(
        'inline-flex h-[46px] w-full items-stretch rounded-full border border-line bg-panel-2',
        className,
      )}
    >
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className="group flex min-w-0 flex-1 items-center justify-center px-0.5 outline-none"
          >
            <span
              className={clsx(
                'flex w-full min-w-0 items-center justify-center rounded-full px-2 font-semibold transition group-focus-visible:ring-2 group-focus-visible:ring-signal/60',
                size === 'sm'
                  ? 'h-[34px] text-[clamp(11.5px,3.4vw,12.5px)]'
                  : 'h-[38px] text-[clamp(12px,3.7vw,14px)]',
                active
                  ? 'bg-panel text-ink shadow-[inset_0_0_0_1px_var(--line-strong)]'
                  : 'text-muted group-hover:text-ink-2',
              )}
            >
              <span className="min-w-0 whitespace-nowrap">{o.label}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

/* ---------- Chip (filter / toggle) ---------- */
/** A pill that filters or toggles. The pill is 33 px; the button around it is a 44 px target. */
export function Chip({
  active,
  onClick,
  children,
  color,
  className,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
  /** Colour for the leading dot. */
  color?: string
  className?: string
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={clsx('group inline-flex min-h-11 shrink-0 items-center outline-none', className)}
    >
      <span
        className={clsx(
          'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold transition group-focus-visible:ring-2 group-focus-visible:ring-signal/60',
          active
            ? 'border-transparent bg-ink text-canvas'
            : 'border-line bg-panel text-ink-2 group-hover:border-line-strong',
        )}
      >
        {color && <Dot color={color} />}
        {children}
      </span>
    </button>
  )
}

/* ---------- Colour dot ---------- */
export function Dot({ color, size = 8 }: { color: string; size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-block shrink-0 rounded-full"
      style={{
        width: size,
        height: size,
        background: color,
      }}
    />
  )
}

/* ---------- Empty state ---------- */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={clsx('flex flex-col items-center px-4 py-10 text-center', className)}>
      {icon && (
        <div className="glow mb-4 grid size-14 place-items-center rounded-2xl border border-signal/25 bg-signal-soft text-signal">
          {icon}
        </div>
      )}
      <h3 className="font-display text-[17px] font-semibold">{title}</h3>
      {description && <p className="mt-1.5 max-w-xs text-[13.5px] text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

/* ---------- Skeleton ---------- */
export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('skeleton', className)} aria-hidden />
}

/* ---------- List row ---------- */
export function Row({
  leading,
  title,
  subtitle,
  trailing,
  onClick,
  className,
}: {
  leading?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  trailing?: ReactNode
  onClick?: () => void
  className?: string
}) {
  const Comp = onClick ? 'button' : 'div'
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={clsx(
        'flex w-full items-center gap-3 py-3 text-left',
        onClick && '-mx-2 w-[calc(100%+1rem)] rounded-xl px-2 transition active:bg-panel-2',
        className,
      )}
    >
      {leading && <div className="shrink-0">{leading}</div>}
      <div className="min-w-0 flex-1">
        <div className="line-clamp-2 break-words text-[15px] font-medium">{title}</div>
        {subtitle && (
          <div className="line-clamp-2 break-words text-[13px] text-muted">{subtitle}</div>
        )}
      </div>
      {trailing && <div className="shrink-0 text-right text-[13px] text-muted">{trailing}</div>}
    </Comp>
  )
}

/* ---------- Divider ---------- */
export function Divider({ className }: { className?: string }) {
  return <hr className={clsx('border-0 border-t border-line', className)} />
}

/* ---------- Section title ---------- */
/** `index` ("01", "◆") is accepted for compatibility and no longer drawn: numbered sections were decoration. */
export function SectionTitle({
  children,
  action,
}: {
  children: ReactNode
  index?: string
  action?: ReactNode
}) {
  return (
    <div className="mb-2.5 mt-3 flex items-center justify-between gap-3 px-1">
      <h2 className="spec flex min-w-0 items-center gap-2 text-ink-2">{children}</h2>
      {action}
    </div>
  )
}
