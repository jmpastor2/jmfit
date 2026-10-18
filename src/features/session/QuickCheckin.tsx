import { clsx } from 'clsx'
import { X } from 'lucide-react'
import { useState } from 'react'
import { useCheckins, useSaveCheckin } from '@/data/hooks'
import { localDateKey } from '@/domain/training'
import type { Checkin } from '@/domain/types'
import { useNow } from '@/lib/useNow'

const ENERGY = ['Fundido', 'Flojo', 'Normal', 'Bien', 'A tope'] as const
const SLEEP = [5, 6, 7, 8, 9] as const

/**
 * «¿Cómo llegas hoy?» at the top of a session without a check-in: energy and hours slept in two
 * taps. It feeds today's readiness, which decides whether the plan pushes or holds the weights.
 * Stays until both are answered or it is closed.
 */
export function QuickCheckin() {
  const checkins = useCheckins()
  const save = useSaveCheckin()
  const today = localDateKey(useNow(60_000))
  const existing = checkins.data?.find((c) => c.date === today) ?? null
  const [closed, setClosed] = useState(false)
  const [picked, setPicked] = useState<{ energy?: number; sleep?: number }>({})
  const energy = picked.energy ?? existing?.energy ?? null
  const sleep = picked.sleep ?? existing?.sleepH ?? null

  // Visible while today's energy or sleep is missing; answering both (here or in Hoy) hides it.
  if (
    closed ||
    checkins.isPending ||
    (energy != null && sleep != null && !picked.energy && !picked.sleep)
  )
    return null

  const store = (patch: Partial<Checkin>) => {
    const base: Checkin = existing ?? {
      date: today,
      sleepH: null,
      sleepQuality: null,
      energy: null,
      soreness: null,
      stress: null,
    }
    const next = { ...base, energy, sleepH: sleep, ...patch }
    void save(next)
    if (next.energy != null && next.sleepH != null) setClosed(true)
  }

  return (
    <section className="mb-4 border-y border-line py-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="spec text-gold">¿Cómo llegas hoy?</h2>
        <button
          type="button"
          onClick={() => setClosed(true)}
          aria-label="Cerrar"
          className="-mr-2 grid size-9 place-items-center text-muted"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {ENERGY.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => {
              setPicked((p) => ({ ...p, energy: i + 1 }))
              store({ energy: i + 1 })
            }}
            className={clsx(
              'min-h-11 rounded-[6px] border px-1 text-[12px] font-medium leading-tight',
              energy === i + 1
                ? 'border-gold bg-gold text-signal-ink'
                : 'border-line bg-panel-2 text-ink-2',
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className="w-14 shrink-0 text-[12.5px] text-muted">Dormí</span>
        <div className="grid flex-1 grid-cols-5 gap-1.5">
          {SLEEP.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => {
                setPicked((p) => ({ ...p, sleep: h }))
                store({ sleepH: h })
              }}
              className={clsx(
                'readout min-h-10 rounded-[6px] border text-[16px] font-semibold',
                sleep === h
                  ? 'border-gold bg-gold text-signal-ink'
                  : 'border-line bg-panel-2 text-ink-2',
              )}
            >
              {h === 9 ? '9+' : h} h
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
