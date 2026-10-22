import { clsx } from 'clsx'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { Sheet } from '@/components/ui/Sheet'
import { useToast } from '@/components/ui/Toast'
import { useCheckins, useSaveCheckin } from '@/data/hooks'
import { addLocalDays, formatNumber, localDateKey } from '@/domain/training'
import { useNow } from '@/lib/useNow'
import { checkinWrites, stepsToPrefill } from './checkin'

type ScaleKey = 'sleepQuality' | 'energy' | 'soreness' | 'stress'

const SCALES: { key: ScaleKey; label: string; low: string; high: string }[] = [
  { key: 'sleepQuality', label: 'Calidad del sueño', low: 'Fatal', high: 'Perfecto' },
  { key: 'energy', label: 'Energía', low: 'Vacío', high: 'A tope' },
  { key: 'soreness', label: 'Agujetas', low: 'Nada', high: 'Muchas' },
  { key: 'stress', label: 'Estrés', low: 'Tranquilo', high: 'Mucho' },
]

const parse = (s: string): number | null => {
  const n = Number(s.replace(',', '.'))
  return s.trim() !== '' && Number.isFinite(n) ? n : null
}
const int = (s: string) => {
  const n = parse(s)
  return n == null || n <= 0 ? null : Math.round(n)
}
const show = (n: number | null | undefined) => (n == null ? '' : formatNumber(n))

/** Morning check-in: sleep, how you feel and, optionally, the numbers from your band. */
export function CheckinSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  // A fresh form on every opening, prefilled with today's check-in.
  return <CheckinForm key={open ? 'open' : 'closed'} open={open} onClose={onClose} />
}

function CheckinForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const now = useNow()
  const today = localDateKey(now)
  const yesterdayKey = localDateKey(addLocalDays(now, -1))
  const checkins = useCheckins().data
  const existing = checkins?.find((c) => c.date === today) ?? null
  const yesterday = checkins?.find((c) => c.date === yesterdayKey) ?? null
  const save = useSaveCheckin()
  const { toast } = useToast()

  const [sleepH, setSleepH] = useState(() => show(existing?.sleepH))
  const [scales, setScales] = useState<Record<ScaleKey, number | null>>(() => ({
    sleepQuality: existing?.sleepQuality ?? null,
    energy: existing?.energy ?? null,
    soreness: existing?.soreness ?? null,
    stress: existing?.stress ?? null,
  }))
  const [hr, setHr] = useState(() => show(existing?.restingHr))
  const [hrv, setHrv] = useState(() => show(existing?.hrvMs))
  // Yesterday's steps live on yesterday's row (Recuperación shows them on that day).
  const [steps, setSteps] = useState(() => {
    const prefill = stepsToPrefill(existing, yesterday)
    return prefill == null ? '' : String(prefill)
  })
  const [busy, setBusy] = useState(false)

  const sleep = parse(sleepH)
  const sleepBad = sleep != null && (sleep < 0 || sleep > 16)
  const empty =
    sleep == null && Object.values(scales).every((v) => v == null) && !hr && !hrv && !steps

  const submit = async () => {
    const writes = checkinWrites(
      {
        sleepH: sleep,
        sleepQuality: scales.sleepQuality,
        energy: scales.energy,
        soreness: scales.soreness,
        stress: scales.stress,
        restingHr: int(hr),
        hrvMs: int(hrv),
        steps: int(steps),
      },
      { today, yesterday: yesterdayKey },
      { today: existing, yesterday },
    )
    setBusy(true)
    onClose()
    // Queued at once; without signal the queue keeps it and sends it when the connection returns.
    const online = navigator.onLine
    const saving = Promise.all(
      [writes.today, writes.yesterday].flatMap((c) => (c ? [save(c, { quiet: true })] : [])),
    )
    if (!online) toast('Sin conexión: el check-in se guardará al volver')
    try {
      await saving
      if (online) toast('Check-in guardado')
    } catch {
      toast('No se pudo guardar el check-in', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Check-in de hoy"
      description="Treinta segundos. Ajusta el plan del día a cómo llegas."
      footer={
        <Button block size="lg" loading={busy} disabled={empty || sleepBad} onClick={submit}>
          Guardar check-in
        </Button>
      }
    >
      <div className="flex flex-col gap-5">
        <Field label="Horas de sueño" {...(sleepBad ? { error: 'Entre 0 y 16 horas' } : {})}>
          {(id, describedBy) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              inputMode="decimal"
              placeholder="7,5"
              value={sleepH}
              onChange={(e) => setSleepH(e.target.value)}
              suffix="h"
              invalid={sleepBad}
            />
          )}
        </Field>

        {SCALES.map((s) => (
          <Scale
            key={s.key}
            label={s.label}
            low={s.low}
            high={s.high}
            value={scales[s.key]}
            onChange={(v) => setScales((prev) => ({ ...prev, [s.key]: v }))}
          />
        ))}

        <div className="border-t border-line pt-4">
          <span className="spec">De tu pulsera · opcional</span>
          <p className="mt-1 text-[12.5px] text-muted">
            Cópialo de la app de tu pulsera si no se ha sincronizado.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Field label="FC en reposo">
              {(id) => (
                <Input
                  id={id}
                  inputMode="numeric"
                  value={hr}
                  onChange={(e) => setHr(e.target.value)}
                  suffix="lpm"
                />
              )}
            </Field>
            <Field label="HRV">
              {(id) => (
                <Input
                  id={id}
                  inputMode="numeric"
                  value={hrv}
                  onChange={(e) => setHrv(e.target.value)}
                  suffix="ms"
                />
              )}
            </Field>
          </div>
          <Field label="Pasos de ayer" className="mt-3">
            {(id) => (
              <Input
                id={id}
                inputMode="numeric"
                value={steps}
                onChange={(e) => setSteps(e.target.value)}
              />
            )}
          </Field>
        </div>
      </div>
    </Sheet>
  )
}

function Scale({
  label,
  low,
  high,
  value,
  onChange,
}: {
  label: string
  low: string
  high: string
  value: number | null
  onChange: (v: number | null) => void
}) {
  return (
    <div role="group" aria-label={label}>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="spec">{label}</span>
        <span className="text-[12px] text-muted">
          1 {low} · 5 {high}
        </span>
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={value === n}
            aria-label={`${label}: ${n}`}
            onClick={() => onChange(value === n ? null : n)}
            className={clsx(
              'readout h-11 rounded-[6px] border text-[18px] font-semibold transition',
              value === n
                ? 'border-gold bg-gold text-signal-ink'
                : 'border-line bg-panel-2 text-ink-2',
            )}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  )
}
