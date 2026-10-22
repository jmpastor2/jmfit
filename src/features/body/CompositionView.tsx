import { clsx } from 'clsx'
import { FileUp, Plus, Scale, Trash2 } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { LineChart, type ChartPoint } from '@/components/charts/LineChart'
import { Delta, Kpi } from '@/components/kpi/Kpi'
import { Button } from '@/components/ui/Button'
import { Field, Select } from '@/components/ui/Field'
import { Sheet } from '@/components/ui/Sheet'
import { useToast } from '@/components/ui/Toast'
import {
  Chip,
  EmptyState,
  Segmented,
  SectionTitle,
  Skeleton,
  ToggleRow,
} from '@/components/ui/primitives'
import { useScanActions, useScans } from '@/data/hooks'
import type { Scan } from '@/domain/types'
import { useNow } from '@/lib/useNow'
import { parseBoditraxCsv, type BoditraxParse } from './boditrax'
import { AddScanSheet, ImportScansSheet } from './ScanSheets'
import { WeightBlock } from './WeightBlock'
import {
  CHART_METRICS,
  compareScans,
  daysBetween,
  formatMetric,
  formatSigned,
  HERO_METRICS,
  longDate,
  METRIC_DEFS,
  metricDelta,
  SCAN_DUE_DAYS,
  scanBefore,
  type MetricDelta,
  type ScanMetric,
} from './scans'

type Range = '3m' | '6m' | '1a' | 'all'
const RANGE_DAYS: Record<Range, number | null> = { '3m': 91, '6m': 182, '1a': 365, all: null }
const DAY = 86_400_000

export function CompositionView() {
  const q = useScans()
  const scans = useMemo(() => q.data ?? [], [q.data])
  const [adding, setAdding] = useState(false)
  const [parsed, setParsed] = useState<BoditraxParse | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const onFile = async (file: File | undefined) => {
    if (!file) return
    try {
      setParsed(parseBoditraxCsv(await file.text()))
    } catch (e) {
      toast(`No se pudo leer el archivo: ${(e as Error).message}`, 'error')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const actions = (
    <div className="grid grid-cols-2 gap-2">
      <Button
        variant="secondary"
        size="sm"
        leading={<Plus className="size-4" />}
        onClick={() => setAdding(true)}
      >
        Añadir
      </Button>
      <Button
        variant="secondary"
        size="sm"
        leading={<FileUp className="size-4" />}
        onClick={() => fileRef.current?.click()}
      >
        Importar CSV
      </Button>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv,text/plain"
        className="hidden"
        aria-label="Archivo CSV de Boditrax"
        onChange={(e) => void onFile(e.target.files?.[0])}
      />
    </div>
  )

  const sheets = (
    <>
      <AddScanSheet open={adding} onClose={() => setAdding(false)} />
      <ImportScansSheet parsed={parsed} existing={scans} onClose={() => setParsed(null)} />
    </>
  )

  if (q.isPending) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-56 rounded-[10px]" />
        <Skeleton className="h-48 rounded-[10px]" />
      </div>
    )
  }
  if (q.isError) {
    return (
      <p className="py-8 text-center text-[14px] text-danger">
        No se pudieron cargar los escáneres.
      </p>
    )
  }
  if (!scans.length) {
    return (
      <div className="flex flex-col gap-6">
        <WeightBlock />
        <EmptyState
          icon={<Scale className="size-6" />}
          title="Sin escáneres todavía"
          description="Importa el CSV que exporta la web de Boditrax o copia a mano el ticket de tu último escáner."
          action={actions}
        />
        {sheets}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <WeightBlock />
      <Hero scans={scans} />
      {actions}
      <Trend scans={scans} />
      {scans.length > 1 && <Comparator scans={scans} />}
      <ScanList scans={scans} />
      {sheets}
    </div>
  )
}

/* ───────────── Latest scan ───────────── */

function Hero({ scans }: { scans: Scan[] }) {
  const last = scans.at(-1)!
  const prev = scans.length > 1 ? scans.at(-2)! : null
  const back3 = scanBefore(scans, last.date, 90)
  const age = daysBetween(last.date, useNow(3_600_000))
  return (
    <section className="card p-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="spec text-gold">Último escáner</span>
        <span className="text-[12.5px] text-muted">
          {longDate(last.date)} · hace {age} {age === 1 ? 'día' : 'días'}
        </span>
      </div>
      {age > SCAN_DUE_DAYS && (
        <p className="mt-3 rounded-[8px] border border-warn/30 bg-warn-soft px-3 py-2 text-[13.5px] text-warn">
          Toca escáner: han pasado más de 4 semanas. Pásate por la Boditrax del club.
        </p>
      )}
      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-5">
        {HERO_METRICS.map((m) => {
          const v = last[m]
          const def = METRIC_DEFS[m]
          const dPrev = metricDelta(m, prev, last)
          const d3 = metricDelta(m, back3, last)
          return (
            <Kpi
              key={m}
              label={def.label}
              size={m === 'peso' || m === 'grasa' || m === 'musculo' ? 'md' : 'sm'}
              value={v === null ? '—' : formatMetric(m, v)}
              unit={v === null ? undefined : def.unit || undefined}
              aside={dPrev.diff !== null ? <DeltaOf d={dPrev} /> : undefined}
              caption={
                d3.diff !== null ? (
                  <>
                    3 meses:{' '}
                    <span className={toneText(d3.tone)}>
                      {formatSigned(m, d3.diff)}
                      {def.unit ? ` ${def.unit}` : ''}
                    </span>
                  </>
                ) : undefined
              }
            />
          )
        })}
      </div>
      <p className="mt-4 text-[12px] text-muted">
        Flecha: cambio frente al escáner anterior
        {prev ? ` (${longDate(prev.date)})` : ''}. Dorado = a mejor, naranja = a peor.
      </p>
    </section>
  )
}

function DeltaOf({ d }: { d: MetricDelta }) {
  if (d.diff === null) return null
  return (
    <Delta
      text={formatSigned(d.metric, d.diff)}
      direction={d.diff > 0 ? 'up' : d.diff < 0 ? 'down' : 'flat'}
      tone={d.tone}
    />
  )
}

const toneText = (t: MetricDelta['tone']) =>
  t === 'good' ? 'text-gold' : t === 'bad' ? 'text-warn' : 'text-ink-2'

/* ───────────── Trend chart ───────────── */

function Trend({ scans }: { scans: Scan[] }) {
  const [metric, setMetric] = useState<ScanMetric>('peso')
  const [range, setRange] = useState<Range>('1a')
  const [compare, setCompare] = useState(false)
  const def = METRIC_DEFS[metric]

  const { points, prior } = useMemo(() => {
    const all: ChartPoint[] = scans.flatMap((s) => {
      const y = s[metric]
      return y === null ? [] : [{ x: s.date, y }]
    })
    const span = RANGE_DAYS[range]
    if (!span || !all.length) return { points: all, prior: [] as ChartPoint[] }
    const end = Date.parse(all.at(-1)!.x + 'T12:00:00')
    const start = end - span * DAY
    const inRange = all.filter((p) => Date.parse(p.x + 'T12:00:00') > start)
    // The same stretch of time just before, slid forward to sit under the current one.
    const before = all
      .filter((p) => {
        const t = Date.parse(p.x + 'T12:00:00')
        return t > start - span * DAY && t <= start
      })
      .map((p) => ({
        x: new Date(Date.parse(p.x + 'T12:00:00') + span * DAY).toISOString().slice(0, 10),
        y: p.y,
      }))
    return { points: inRange, prior: before }
  }, [scans, metric, range])

  const canCompare = range !== 'all' && prior.length > 1

  return (
    <section>
      <SectionTitle>Evolución</SectionTitle>
      <div className="hide-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4">
        {CHART_METRICS.map((m) => (
          <Chip key={m} active={metric === m} onClick={() => setMetric(m)}>
            {METRIC_DEFS[m].short}
          </Chip>
        ))}
      </div>
      <Segmented
        className="mt-2"
        size="sm"
        value={range}
        onChange={setRange}
        options={[
          { value: '3m', label: '3 meses' },
          { value: '6m', label: '6 meses' },
          { value: '1a', label: '1 año' },
          { value: 'all', label: 'Todo' },
        ]}
      />
      <div className="card mt-3 p-4">
        <LineChart
          points={points}
          compare={compare && canCompare ? prior : undefined}
          unit={def.unit}
          format={(n) => formatMetric(metric, n)}
          label={`${def.label}: ${points.length} escáneres`}
        />
        {compare && canCompare && (
          <p className="mt-2 text-[12px] text-muted">
            Línea gris: el periodo anterior de la misma duración, desplazado para superponerlo.
          </p>
        )}
      </div>
      {range !== 'all' && (
        <ToggleRow
          className="mt-2"
          checked={compare && canCompare}
          onChange={setCompare}
          label="Comparar con el periodo anterior"
          hint={canCompare ? undefined : 'No hay escáneres suficientes en el periodo anterior.'}
        />
      )}
    </section>
  )
}

/* ───────────── Comparator ───────────── */

function Comparator({ scans }: { scans: Scan[] }) {
  const last = scans.at(-1)!
  const [aDate, setA] = useState(() => (scanBefore(scans, last.date, 90) ?? scans[0]!).date)
  const [bDate, setB] = useState(last.date)
  const a = scans.find((s) => s.date === aDate) ?? scans[0]!
  const b = scans.find((s) => s.date === bDate) ?? last
  const rows = useMemo(() => compareScans(a, b), [a, b])
  const options = scans.toReversed()

  return (
    <section>
      <SectionTitle>Comparar escáneres</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Desde">
          {(id) => (
            <Select id={id} value={a.date} onChange={(e) => setA(e.target.value)}>
              {options.map((s) => (
                <option key={s.date} value={s.date}>
                  {longDate(s.date)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Hasta">
          {(id) => (
            <Select id={id} value={b.date} onChange={(e) => setB(e.target.value)}>
              {options.map((s) => (
                <option key={s.date} value={s.date}>
                  {longDate(s.date)}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <table className="mt-3 w-full text-[14px]">
        <thead>
          <tr className="spec text-left">
            <th className="py-2 font-semibold">Medida</th>
            <th className="py-2 text-right font-semibold">Desde</th>
            <th className="py-2 text-right font-semibold">Hasta</th>
            <th className="py-2 text-right font-semibold">Cambio</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line border-t border-line">
          {rows.map((r) => {
            const def = METRIC_DEFS[r.metric]
            return (
              <tr key={r.metric}>
                <td className="py-2.5 pr-2">
                  {def.label}
                  {def.unit && <span className="ml-1 text-[12px] text-muted">{def.unit}</span>}
                </td>
                <td className="readout py-2.5 text-right text-[16px] text-ink-2">
                  {r.from === null ? '—' : formatMetric(r.metric, r.from)}
                </td>
                <td className="readout py-2.5 text-right text-[16px]">
                  {r.to === null ? '—' : formatMetric(r.metric, r.to)}
                </td>
                <td
                  className={clsx(
                    'readout py-2.5 text-right text-[16px] font-semibold',
                    toneText(r.tone),
                  )}
                >
                  {r.diff === null ? '—' : formatSigned(r.metric, r.diff)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="mt-2 text-[12px] text-muted">
        Más músculo y menos grasa en dorado; lo contrario en naranja. Peso, agua e IMC no se juzgan.
      </p>
    </section>
  )
}

/* ───────────── List ───────────── */

function ScanList({ scans }: { scans: Scan[] }) {
  const { remove } = useScanActions()
  const { toast } = useToast()
  const [confirm, setConfirm] = useState<Scan | null>(null)
  const [busy, setBusy] = useState(false)
  const list = useMemo(() => scans.toReversed(), [scans])

  const run = async () => {
    if (!confirm) return
    setBusy(true)
    try {
      await remove(confirm.date, { quiet: true })
      toast(`Escáner del ${longDate(confirm.date)} borrado`, 'success')
      setConfirm(null)
    } catch (e) {
      toast(`No se pudo borrar: ${(e as Error).message}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section>
      <SectionTitle>Escáneres ({scans.length})</SectionTitle>
      <ul className="divide-y divide-line border-y border-line">
        {list.map((s) => (
          <li key={s.date} className="flex min-h-[52px] items-center gap-3">
            <div className="min-w-0 flex-1 py-2">
              <div className="text-[15px] font-medium">{longDate(s.date)}</div>
              <div className="text-[12.5px] text-muted">
                {[
                  s.peso !== null && `${formatMetric('peso', s.peso)} kg`,
                  s.grasa !== null && `${formatMetric('grasa', s.grasa)} % grasa`,
                  s.musculo !== null && `${formatMetric('musculo', s.musculo)} kg músculo`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
            </div>
            <button
              type="button"
              aria-label={`Borrar escáner del ${longDate(s.date)}`}
              onClick={() => setConfirm(s)}
              className="grid size-11 shrink-0 place-items-center rounded-full text-muted active:bg-panel-2"
            >
              <Trash2 className="size-4" />
            </button>
          </li>
        ))}
      </ul>
      <Sheet
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title="¿Borrar este escáner?"
        description={confirm ? `${longDate(confirm.date)}. No se puede deshacer.` : undefined}
        footer={
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => setConfirm(null)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={run} loading={busy}>
              Borrar
            </Button>
          </div>
        }
      >
        <p className="text-[14px] text-ink-2">
          Desaparece de las gráficas y del comparador. Si lo tienes en el CSV de Boditrax, puedes
          volver a importarlo.
        </p>
      </Sheet>
    </section>
  )
}
