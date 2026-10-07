import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { Sheet } from '@/components/ui/Sheet'
import { useToast } from '@/components/ui/Toast'
import { useScanActions } from '@/data/hooks'
import { localDateKey } from '@/domain/training'
import { useNow } from '@/lib/useNow'
import type { Scan } from '@/domain/types'
import { emptyScan, type BoditraxParse } from './boditrax'
import { COMPARE_METRICS, longDate, METRIC_DEFS, parseDecimal, type ScanMetric } from './scans'

/** Form order: what the Boditrax ticket shows first. */
const FORM_METRICS: ScanMetric[] = [
  'peso',
  'grasa',
  ...COMPARE_METRICS.filter((m) => m !== 'peso' && m !== 'grasa'),
]

/** Add one scan by hand. Empty fields are saved as "no data". */
export function AddScanSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { save } = useScanActions()
  const { toast } = useToast()
  const today = localDateKey(useNow(3_600_000))
  const [date, setDate] = useState(today)
  const [values, setValues] = useState<Partial<Record<ScanMetric, string>>>({})
  const [busy, setBusy] = useState(false)

  const invalid = FORM_METRICS.filter((m) => {
    const v = values[m]?.trim()
    return v && parseDecimal(v) === null
  })
  const peso = parseDecimal(values.peso ?? '')
  const canSave = Boolean(date) && peso !== null && peso > 0 && invalid.length === 0

  const submit = async () => {
    if (!canSave) return
    const scan: Scan = emptyScan(date)
    for (const m of FORM_METRICS) scan[m] = parseDecimal(values[m] ?? '')
    // Derive the missing one of % fat / fat kg when the other is there.
    if (scan.grasa === null && scan.grasaKg !== null && scan.peso)
      scan.grasa = Math.round((scan.grasaKg / scan.peso) * 1000) / 10
    if (scan.grasaKg === null && scan.grasa !== null && scan.peso)
      scan.grasaKg = Math.round(scan.grasa * scan.peso) / 100
    setBusy(true)
    try {
      await save([scan])
      toast(`Escáner del ${longDate(date)} guardado`, 'success')
      setValues({})
      onClose()
    } catch (e) {
      toast(`No se pudo guardar: ${(e as Error).message}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Añadir escáner"
      description="Copia los números del ticket de Boditrax. Deja en blanco lo que no tengas."
      tall
      footer={
        <Button block onClick={submit} disabled={!canSave} loading={busy}>
          Guardar escáner
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Fecha">
          {(id) => (
            <Input
              id={id}
              type="date"
              value={date}
              max={today}
              onChange={(e) => setDate(e.target.value)}
            />
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          {FORM_METRICS.map((m) => {
            const def = METRIC_DEFS[m]
            const bad = invalid.includes(m)
            return (
              <Field
                key={m}
                label={m === 'peso' ? `${def.label} *` : def.label}
                error={bad ? 'Número no válido' : undefined}
              >
                {(id, describedBy) => (
                  <Input
                    id={id}
                    aria-describedby={describedBy}
                    inputMode="decimal"
                    autoComplete="off"
                    value={values[m] ?? ''}
                    invalid={bad}
                    suffix={def.unit || undefined}
                    onChange={(e) => setValues((v) => ({ ...v, [m]: e.target.value }))}
                    className="text-[16px]"
                  />
                )}
              </Field>
            )
          })}
        </div>
      </div>
    </Sheet>
  )
}

/** Confirm a parsed Boditrax CSV before saving it. */
export function ImportScansSheet({
  parsed,
  existing,
  onClose,
}: {
  parsed: BoditraxParse | null
  existing: readonly Scan[]
  onClose: () => void
}) {
  const { save } = useScanActions()
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)
  const scans = parsed?.scans ?? []
  const known = new Set(existing.map((s) => s.date))
  const fresh = scans.filter((s) => !known.has(s.date)).length
  const updated = scans.length - fresh

  const run = async () => {
    setBusy(true)
    try {
      await save(scans)
      toast(`${scans.length} escáneres importados`, 'success')
      onClose()
    } catch (e) {
      toast(`No se pudo importar: ${(e as Error).message}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet
      open={parsed !== null}
      onClose={onClose}
      title="Importar de Boditrax"
      footer={
        scans.length > 0 ? (
          <Button block onClick={run} loading={busy}>
            Importar {scans.length}
          </Button>
        ) : undefined
      }
    >
      {scans.length === 0 ? (
        <p className="text-[14px] text-ink-2">
          El archivo no tiene escáneres con peso. Usa el CSV que exporta la web de Boditrax
          (secciones «User Scan Details»).
        </p>
      ) : (
        <div className="flex flex-col gap-3 text-[14px]">
          <p className="text-ink-2">
            {scans.length} escáneres, del {longDate(scans[0]!.date)} al{' '}
            {longDate(scans.at(-1)!.date)}.
          </p>
          <ul className="divide-y divide-line border-y border-line">
            <li className="flex justify-between py-3">
              <span>Nuevos</span>
              <span className="readout text-[18px] text-gold">{fresh}</span>
            </li>
            <li className="flex justify-between py-3">
              <span>Ya estaban (se actualizan)</span>
              <span className="readout text-[18px]">{updated}</span>
            </li>
            {parsed!.skipped > 0 && (
              <li className="flex justify-between py-3 text-warn">
                <span>Filas ilegibles (se ignoran)</span>
                <span className="readout text-[18px]">{parsed!.skipped}</span>
              </li>
            )}
          </ul>
          <p className="text-[12.5px] text-muted">
            El % de grasa se calcula como grasa (kg) ÷ peso, y el metabolismo basal pasa de kJ a
            kcal.
          </p>
        </div>
      )}
    </Sheet>
  )
}
