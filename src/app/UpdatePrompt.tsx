import { useEffect, useRef } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { Button } from '@/components/ui/Button'

/**
 * Service-worker updates. A new version never reloads the page under someone who is
 * using it. It is applied silently when nothing has been touched yet (the app has just
 * been opened) or the moment the app goes to the background outside a session, so the
 * next time it is opened it is already the new one. The banner stays for the person who
 * is mid-task.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error) {
      console.warn('Service worker registration failed', error)
    },
  })

  const touched = useRef(false)
  useEffect(() => {
    const mark = () => {
      touched.current = true
    }
    window.addEventListener('pointerdown', mark, { once: true, capture: true })
    return () => window.removeEventListener('pointerdown', mark, { capture: true })
  }, [])

  useEffect(() => {
    if (!needRefresh) return
    if (!touched.current) {
      void updateServiceWorker(true)
      return
    }
    const onHide = () => {
      // Not in the middle of a session: the update reloads the page, and coming back from
      // another app meant opening the whole session again. It waits for the summary.
      if (document.visibilityState === 'hidden' && window.location.hash !== '#/session')
        void updateServiceWorker(true)
    }
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
  }, [needRefresh, updateServiceWorker])

  if (!needRefresh) return null

  return (
    <div className="safe-bottom fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-20">
      <div className="fade-up flex items-center gap-3 rounded-full border border-line bg-panel px-4 py-2 shadow-lg">
        <span className="text-[13.5px]">Hay una versión nueva</span>
        <Button size="sm" onClick={() => void updateServiceWorker(true)}>
          Actualizar
        </Button>
        <button
          type="button"
          onClick={() => setNeedRefresh(false)}
          className="text-[13px] text-muted"
          aria-label="Cerrar"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
