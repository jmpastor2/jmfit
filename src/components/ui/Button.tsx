import { clsx } from 'clsx'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft'
type Size = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  leading?: ReactNode
  trailing?: ReactNode
  block?: boolean
}

const variants: Record<Variant, string> = {
  // The main action is the one gold surface on the screen.
  primary:
    'bg-signal text-signal-ink hover:brightness-110 active:scale-[0.98] disabled:bg-panel-3 disabled:text-muted',
  secondary:
    'bg-panel-2 text-ink border border-line hover:border-line-strong active:scale-[0.98] disabled:text-muted',
  soft: 'bg-signal-soft text-signal hover:bg-signal/20 active:scale-[0.98] disabled:opacity-60',
  ghost:
    'bg-transparent text-ink-2 hover:bg-panel-2 hover:text-ink active:scale-[0.98] disabled:text-muted',
  danger:
    'bg-danger-soft text-danger border border-danger/30 active:scale-[0.98] disabled:opacity-60',
}

// Every size is at least a 44 px target: "sm" differs in type size and padding, not in height.
const sizes: Record<Size, string> = {
  sm: 'h-11 px-4 text-[14px] gap-1.5 rounded-[8px]',
  md: 'h-12 px-5 text-[16px] gap-2 rounded-[8px]',
  lg: 'h-14 px-6 text-[18px] gap-2 rounded-[8px]',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  leading,
  trailing,
  block = false,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={clsx(
        'inline-flex select-none items-center justify-center whitespace-nowrap font-display font-semibold uppercase tracking-[0.12em] outline-none transition-[transform,background-color,color,filter,border-color] duration-150 focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        block && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? (
        <span
          className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden
        />
      ) : (
        leading
      )}
      {children}
      {trailing}
    </button>
  )
}
