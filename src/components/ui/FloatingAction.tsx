import { useEffect, type ReactNode } from 'react'

/** Room a floating button takes above the dock: the toast with an undo stacks over it. */
const CLEARANCE = '56px'

/**
 * A button that floats above the dock within thumb reach (the Registro "Registrar"). While it
 * is on screen the undo toast sits above it (it reads `--float-clearance`), so neither covers
 * the other. Pass the button itself, with `pointer-events-auto`.
 */
export function FloatingAction({ children }: { children: ReactNode }) {
  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--float-clearance', CLEARANCE)
    return () => {
      root.style.removeProperty('--float-clearance')
    }
  }, [])
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(max(env(safe-area-inset-bottom),10px)+86px)] z-30">
      <div className="mx-auto flex max-w-2xl justify-end px-4">{children}</div>
    </div>
  )
}
