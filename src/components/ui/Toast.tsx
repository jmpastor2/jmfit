import { clsx } from 'clsx'
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react'
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

type ToastTone = 'info' | 'success' | 'warn' | 'error'

/** A button on the toast, usually "Deshacer". */
export interface ToastAction {
  label: string
  onAction: () => void | Promise<void>
}

export interface ToastOptions {
  /** With an action the toast waits longer, sits above the dock and replaces an older one. */
  action?: ToastAction
  /** How long it stays, in ms. */
  durationMs?: number
}

interface Toast {
  id: number
  tone: ToastTone
  message: string
  action?: ToastAction
}

interface ToastApi {
  toast: (message: string, tone?: ToastTone, options?: ToastOptions) => void
}

/** Long enough to read a line; an undo needs longer to be reached for. */
const PLAIN_MS = 3200
const ACTION_MS = 8000

const ToastContext = createContext<ToastApi | null>(null)

const icons: Record<ToastTone, ReactNode> = {
  info: <Info className="size-4 shrink-0" />,
  success: <CheckCircle2 className="size-4 shrink-0" />,
  warn: <AlertTriangle className="size-4 shrink-0" />,
  error: <XCircle className="size-4 shrink-0" />,
}
// Canvas ink reads on every tone in both themes (dark ink on the bright night tones, light
// ink on the deep clean-bench ones); white did not on mint, amber and pink.
const tones: Record<ToastTone, string> = {
  info: 'bg-ink text-canvas',
  success: 'bg-ok text-canvas',
  warn: 'bg-warn text-canvas',
  error: 'bg-danger text-canvas',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([])
  const seq = useRef(0)

  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), [])

  const toast = useCallback(
    (message: string, tone: ToastTone = 'info', options: ToastOptions = {}) => {
      const id = ++seq.current
      const { action, durationMs = action ? ACTION_MS : PLAIN_MS } = options
      const next: Toast = { id, tone, message, ...(action ? { action } : {}) }
      // One way back at a time: the newest replaces the one still waiting.
      setItems((xs) => [...(action ? xs.filter((x) => !x.action) : xs), next])
      window.setTimeout(() => dismiss(id), durationMs)
    },
    [dismiss],
  )

  const api = useMemo(() => ({ toast }), [toast])
  const plain = items.filter((x) => !x.action)
  const withAction = items.find((x) => x.action)

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-[max(env(safe-area-inset-top),12px)] z-[100] flex flex-col items-center gap-2 px-4"
      >
        {plain.map((t) => (
          <div
            key={t.id}
            role="status"
            className={clsx(
              'fade-up pointer-events-auto flex max-w-md items-center gap-2 rounded-full px-4 py-2 text-[13.5px] font-medium shadow-lg',
              tones[t.tone],
            )}
          >
            {icons[t.tone]}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
      <div
        aria-live="polite"
        // A screen with a floating button above the dock sets --float-clearance (see
        // FloatingAction) so the undo stacks above it instead of covering it.
        className="pointer-events-none fixed inset-x-0 bottom-[calc(max(env(safe-area-inset-bottom),10px)+88px+var(--float-clearance,0px))] z-[100] flex justify-center px-4"
      >
        {withAction?.action && (
          <ActionToast
            key={withAction.id}
            toast={withAction}
            action={withAction.action}
            dismiss={dismiss}
          />
        )}
      </div>
    </ToastContext.Provider>
  )
}

/** The toast with a button, within thumb reach above the dock. */
function ActionToast({
  toast,
  action,
  dismiss,
}: {
  toast: Toast
  action: ToastAction
  dismiss: (id: number) => void
}) {
  const run = () => {
    dismiss(toast.id)
    void action.onAction()
  }
  return (
    <div
      role="status"
      className="fade-up pointer-events-auto flex w-full max-w-md items-center gap-2.5 rounded-[24px] bg-ink py-1.5 pl-4 pr-1.5 text-[13.5px] font-medium text-canvas shadow-lg"
    >
      {icons[toast.tone === 'info' ? 'success' : toast.tone]}
      <span className="min-w-0 flex-1 text-balance py-1 leading-snug">{toast.message}</span>
      <button
        type="button"
        onClick={run}
        className="h-11 shrink-0 rounded-full bg-canvas px-4 text-[13.5px] font-semibold text-signal active:scale-95"
      >
        {action.label}
      </button>
    </div>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>')
  return ctx
}
