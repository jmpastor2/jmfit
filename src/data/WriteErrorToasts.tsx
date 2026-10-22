import { useEffect } from 'react'
import { useToast } from '@/components/ui/Toast'
import { onWriteError } from './writeErrors'

/** Shows the writes that could not be saved (the screen shows the server's data again). */
export function WriteErrorToasts() {
  const { toast } = useToast()
  useEffect(() => onWriteError((message) => toast(message, 'error', { durationMs: 6000 })), [toast])
  return null
}
