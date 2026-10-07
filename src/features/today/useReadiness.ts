import { useMemo } from 'react'
import { useCheckins, useHealthDays } from '@/data/hooks'
import { checkinAsHealthDay } from '@/data/rows'
import { computeReadiness, localDateKey } from '@/domain/training'
import type { HealthDay, Readiness } from '@/domain/types'
import { useNow } from '@/lib/useNow'

/**
 * Days of recovery data: the wearable's when synced, otherwise what was typed in the morning
 * check-in. One list, oldest first, one entry per date.
 */
export function useRecoveryDays(): HealthDay[] {
  const health = useHealthDays().data
  const checkins = useCheckins().data
  return useMemo(() => {
    const byDate = new Map<string, HealthDay>()
    for (const c of checkins ?? []) byDate.set(c.date, checkinAsHealthDay(c))
    // Synced data wins where both exist; typed values fill what the sync did not bring.
    for (const h of health ?? []) {
      const typed = byDate.get(h.date)
      byDate.set(h.date, typed ? mergeDays(h, typed) : h)
    }
    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
  }, [health, checkins])
}

function mergeDays(synced: HealthDay, typed: HealthDay): HealthDay {
  const out = { ...synced }
  for (const k of Object.keys(typed) as (keyof HealthDay)[]) {
    if (out[k] == null && typed[k] != null) (out as Record<string, unknown>)[k] = typed[k]
  }
  return out
}

/** Today's readiness from the wearable and/or the morning check-in. */
export function useReadiness(): Readiness & { hasCheckin: boolean } {
  const days = useRecoveryDays()
  const checkins = useCheckins().data
  const now = useNow()
  const today = localDateKey(now)
  return useMemo(() => {
    const todayDay = days.find((d) => d.date === today) ?? null
    const checkin = checkins?.find((c) => c.date === today) ?? null
    const r = computeReadiness({ today: todayDay, baseline: days, checkin })
    return { ...r, hasCheckin: Boolean(checkin) }
  }, [days, checkins, today])
}
