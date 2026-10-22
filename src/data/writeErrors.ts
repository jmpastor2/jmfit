/**
 * A write that the server refused, or that never got through after every retry. The queue in
 * `hooks.ts` reports it here (it also runs for writes resumed after a reload, when the screen
 * that made them is long gone) and `WriteErrorToasts` tells the person.
 */
import { isTransientError } from '@/lib/queryClient'

type Listener = (message: string) => void
const listeners = new Set<Listener>()

export function onWriteError(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function reportWriteError(error: unknown) {
  const message = writeErrorMessage(error)
  for (const l of listeners) l(message)
}

export function writeErrorMessage(error: unknown): string {
  if (isTransientError(error)) return 'No se pudo guardar: el servidor no responde'
  const code = (error as { code?: unknown } | null)?.code
  if (code === '42501') return 'No se pudo guardar: sin permiso'
  return 'No se pudo guardar un cambio'
}
