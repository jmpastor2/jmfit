/**
 * Mirrors the running rest into `rest_alarms` so the server can send «Descanso terminado» when
 * the phone is locked. Best effort: the in-app beep still covers the app in the foreground,
 * and a failed write only means no push for that rest.
 */
import { pushEnabledHere } from '@/lib/push'
import { getSupabase } from '@/lib/supabase'
import { onRestChange, type RestState } from './restTimer'

let started = false
let lastSent: number | null = null
let cancelTimer: ReturnType<typeof setTimeout> | undefined

/** Seconds before the end at which an app still on screen withdraws the push. */
const FOREGROUND_CANCEL_MS = 4000

async function sync(rest: RestState | null) {
  clearTimeout(cancelTimer)
  const sb = getSupabase()
  if (!sb || !pushEnabledHere()) return
  // A rest that is already over needs no alarm (and «Cerrar» after it ends sends nothing).
  if (!rest || rest.endsAt <= Date.now()) {
    if (lastSent === null) return
    lastSent = null
    await sb.from('rest_alarms').delete().not('user_id', 'is', null)
    return
  }
  // With the app on screen the in-app beep is enough: withdraw the push just before the end.
  // A locked phone does not run this timer, so the push stays and arrives.
  cancelTimer = setTimeout(
    () => {
      if (document.visibilityState === 'visible') void sync(null)
    },
    Math.max(0, rest.endsAt - Date.now() - FOREGROUND_CANCEL_MS),
  )
  if (lastSent === rest.endsAt) return
  lastSent = rest.endsAt
  await sb
    .from('rest_alarms')
    .upsert(
      { fire_at: new Date(rest.endsAt).toISOString(), label: rest.label.slice(0, 120) },
      { onConflict: 'user_id' },
    )
}

/** Start mirroring once per app lifetime (called by the session screen). */
export function startRestAlarmSync() {
  if (started) return
  started = true
  onRestChange((rest) => {
    void sync(rest).catch((e: unknown) => console.warn('rest alarm sync failed', e))
  })
}
