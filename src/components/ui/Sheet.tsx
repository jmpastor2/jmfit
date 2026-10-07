import { clsx } from 'clsx'
import { X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export interface SheetProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  /** Full-height sheet for long forms. */
  tall?: boolean
}

interface Viewport {
  height: number
  top: number
  /** The on-screen keyboard is covering part of the layout viewport. */
  keyboard: boolean
}

/** A hardware keyboard and a precise pointer: focusing a field will not pop a keyboard up. */
export function canAutoFocusFields(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(hover: hover) and (pointer: fine)').matches
    : true
}

/**
 * The part of the screen left above the on-screen keyboard, or null while there is none. On
 * iOS the layout viewport does not shrink when the keyboard opens, so a sheet sized to it ends
 * up half behind the keyboard; following the visual viewport keeps it above. Only then: with
 * no keyboard the sheet keeps its plain CSS layout, so opening it never moves it a second time.
 */
function useKeyboardViewport(active: boolean): Viewport | null {
  const [vp, setVp] = useState<Viewport | null>(null)
  useEffect(() => {
    const v = typeof window === 'undefined' ? undefined : window.visualViewport
    if (!active || !v) return
    const read = () => {
      const keyboard = window.innerHeight - v.height > 120
      const height = Math.round(v.height)
      const top = Math.round(v.offsetTop)
      setVp((prev) =>
        !keyboard
          ? null
          : prev && prev.height === height && prev.top === top
            ? prev
            : { height, top, keyboard },
      )
    }
    read()
    v.addEventListener('resize', read)
    v.addEventListener('scroll', read)
    return () => {
      v.removeEventListener('resize', read)
      v.removeEventListener('scroll', read)
      setVp(null)
    }
  }, [active])
  return vp
}

/**
 * iOS-style bottom sheet. Uses a native <dialog> for focus trapping and Escape
 * handling, portalled to body so it escapes any transformed ancestor.
 */
export function Sheet({ open, onClose, title, description, children, footer, tall }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const vp = useKeyboardViewport(open)
  // The panel is drawn off screen first and only then slides in. A keyframe animation that
  // starts when the dialog appears showed it in place for a frame on iOS before it slid in
  // from below: the sheet seemed to appear and then jump.
  const [entered, setEntered] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) {
      const panel = el.querySelector<HTMLElement>('[role="document"]')
      // The panel takes the dialog's first focus, so showModal() does not focus (and scroll
      // to) the close button.
      panel?.setAttribute('autofocus', '')
      el.showModal()
      // A field marked data-autofocus gets the focus where there is a hardware keyboard; on a
      // phone that would open the on-screen keyboard over the sheet the moment it appears.
      const field = canAutoFocusFields() ? el.querySelector<HTMLElement>('[data-autofocus]') : null
      ;(field ?? panel)?.focus({ preventScroll: true })
    }
    if (!open && el.open) el.close()
  }, [open])

  // Two frames after opening: the off-screen position has been drawn, so the change to the
  // resting one is a transition. Its own effect, so a re-run (Strict Mode) schedules it again.
  useEffect(() => {
    if (!open) return
    // Without frames (tests, old engines) it simply shows.
    if (typeof requestAnimationFrame !== 'function') {
      const timer = setTimeout(() => setEntered(true), 0)
      return () => {
        clearTimeout(timer)
        setEntered(false)
      }
    }
    let second = 0
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setEntered(true))
    })
    return () => {
      cancelAnimationFrame(first)
      cancelAnimationFrame(second)
      // Closed: the next opening starts off screen again.
      setEntered(false)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (typeof document === 'undefined') return null

  return createPortal(
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      // Where `overflow: clip` is not supported (iOS 15) a focus could still scroll it: undo it.
      onScroll={(e) => {
        if (e.currentTarget.scrollTop) e.currentTarget.scrollTop = 0
      }}
      onClick={(e) => {
        // Click on backdrop (outside the panel) closes.
        if (e.target === ref.current) onClose()
      }}
      className={clsx(
        // No blur behind: blurring the whole page every frame of the slide made it stutter on phones.
        'm-0 max-h-none max-w-none bg-transparent p-0 backdrop:bg-black/65',
        // Never scrollable: focusing the panel while it is still below the screen made the
        // dialog scroll to it, and once it slid up it was left scrolled out of view (iOS).
        'fixed inset-0 h-full w-full overflow-clip overscroll-none',
      )}
    >
      {open && (
        <div
          className="absolute inset-x-0 top-0 flex h-full w-full items-end justify-center overflow-clip sm:items-center"
          onScroll={(e) => {
            if (e.currentTarget.scrollTop) e.currentTarget.scrollTop = 0
          }}
          style={vp ? { height: vp.height, top: vp.top } : undefined}
        >
          <div
            role="document"
            tabIndex={-1}
            data-entered={entered || undefined}
            className={clsx(
              'outline-none will-change-transform',
              'flex w-full max-w-lg flex-col overflow-hidden rounded-t-[14px] border border-line-strong bg-panel shadow-2xl sm:rounded-[14px]',
              'transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none',
              entered ? 'translate-y-0' : 'translate-y-full',
              vp?.keyboard ? 'h-full' : tall ? 'h-[92dvh]' : 'max-h-[92dvh]',
            )}
          >
            <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-line-strong sm:hidden" />
            <header className="flex items-start justify-between gap-3 px-5 pb-2 pt-3">
              <div className="min-w-0">
                {title && (
                  <h2 className="break-words text-[19px] font-semibold leading-snug">{title}</h2>
                )}
                {description && (
                  <p className="mt-0.5 break-words text-[13px] text-muted">{description}</p>
                )}
              </div>
              {/* A 44 px target that takes the room of the 36 px it looks like. */}
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar"
                className="-mr-2.5 -my-1 grid size-11 shrink-0 place-items-center rounded-full text-muted outline-none hover:bg-panel-2 focus-visible:ring-2 focus-visible:ring-signal/60 active:bg-panel-2"
              >
                <X className="size-5" />
              </button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">{children}</div>
            {footer && (
              <footer
                className={clsx(
                  'border-t border-line bg-panel px-5 pt-3',
                  vp?.keyboard ? 'pb-3' : 'safe-bottom',
                )}
              >
                {footer}
              </footer>
            )}
          </div>
        </div>
      )}
    </dialog>,
    document.body,
  )
}
