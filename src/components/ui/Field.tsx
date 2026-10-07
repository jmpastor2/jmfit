import { clsx } from 'clsx'
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'
import { useId } from 'react'

interface FieldProps {
  label?: ReactNode
  hint?: ReactNode
  error?: ReactNode
  trailing?: ReactNode
  className?: string
  children: (id: string, describedBy: string | undefined) => ReactNode
}

/** Label + control + hint/error wrapper with a11y wiring. */
export function Field({ label, hint, error, trailing, className, children }: FieldProps) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errId = error ? `${id}-err` : undefined
  const describedBy = [hintId, errId].filter(Boolean).join(' ') || undefined
  return (
    <div className={clsx('flex flex-col gap-1.5', className)}>
      {(label || trailing) && (
        <div className="flex items-center justify-between">
          {label && (
            <label htmlFor={id} className="text-[13px] font-medium text-ink-2">
              {label}
            </label>
          )}
          {trailing}
        </div>
      )}
      {children(id, describedBy)}
      {error ? (
        <p id={errId} role="alert" className="text-[12.5px] text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-[12.5px] text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

export const controlClass =
  'h-12 w-full rounded-control border border-line bg-panel-2 px-4 text-[15px] text-ink placeholder:text-muted/70 outline-none transition focus:border-signal/60 focus:bg-panel focus:ring-4 focus:ring-signal/10 disabled:opacity-60'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  suffix?: ReactNode
  invalid?: boolean
}

export function Input({ suffix, invalid, className, ...rest }: InputProps) {
  if (!suffix) {
    return (
      <input
        className={clsx(
          controlClass,
          invalid && 'border-danger! focus:border-danger! focus:ring-danger/30',
          className,
        )}
        aria-invalid={invalid || undefined}
        {...rest}
      />
    )
  }
  return (
    <div className="relative">
      <input
        className={clsx(
          controlClass,
          'pr-16',
          invalid && 'border-danger! focus:border-danger! focus:ring-danger/30',
          className,
        )}
        aria-invalid={invalid || undefined}
        {...rest}
      />
      <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center font-mono text-[12px] font-semibold text-muted">
        {suffix}
      </span>
    </div>
  )
}

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>

export function Select({ className, children, ...rest }: SelectProps) {
  return (
    <div className="relative">
      <select className={clsx(controlClass, 'appearance-none pr-10', className)} {...rest}>
        {children}
      </select>
      <svg
        aria-hidden
        viewBox="0 0 20 20"
        className="pointer-events-none absolute inset-y-0 right-3.5 my-auto size-4 text-muted"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="m6 8 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>

export function Textarea({ className, ...rest }: TextareaProps) {
  return (
    <textarea
      className={clsx(controlClass, 'h-auto min-h-24 resize-y py-2.5 leading-relaxed', className)}
      {...rest}
    />
  )
}
