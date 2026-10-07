import { clsx } from 'clsx'
import { ChevronDown } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { MUSCLE_LABEL } from '@/content/exercises'
import { shortDate } from '@/components/charts/LineChart'
import { Delta, Kpi } from '@/components/kpi/Kpi'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Field, Select } from '@/components/ui/Field'
import { EmptyState, SectionTitle, Segmented, Skeleton } from '@/components/ui/primitives'
import { useMe, useScans, useSets, useWorkouts } from '@/data/hooks'
import { formatNumber } from '@/domain/training'
import type { PersonalRecord, Scan } from '@/domain/types'
import {
  formatMetric,
  formatSigned,
  longDate,
  METRIC_DEFS,
  type MetricDelta,
} from '@/features/body/scans'
import { useExerciseLookup } from '@/features/exercise/lookup'
import { latestBodyweight } from '@/features/exercise/stats'
import { formatInt, monthLabel, PR_LABEL, prValue } from '@/features/train/history'
import {
  buildEvolution,
  compareMonths,
  consistencyGrid,
  defaultComparison,
  monthSummary,
  periodStart,
  summarize,
  weekStreaks,
  type CompareRow,
  type Evolution,
  type MonthSummary,
  type Period,
  type Tone,
  type WeekColumn,
} from './evolution'

const fmt1 = (n: number) => formatNumber(n, 1)

function signedText(diff: number, format: (n: number) => string): string {
  const s = format(Math.abs(diff))
  if (s === '0') return '0'
  return `${diff > 0 ? '+' : '−'}${s}`
}

/** A change where more is better (sets, tonnage, e1RM). */
function UpDelta({ diff, format = fmt1 }: { diff: number; format?: (n: number) => string }) {
  const flat = signedText(diff, format) === '0'
  return (
    <Delta
      text={signedText(diff, format)}
      direction={flat ? 'flat' : diff > 0 ? 'up' : 'down'}
      tone={flat ? 'neutral' : diff > 0 ? 'good' : 'bad'}
    />
  )
}

export function EvolutionPage() {
  const nav = useNavigate()
  const me = useMe()
  const workoutsQ = useWorkouts()
  const setsQ = useSets()
  const scansQ = useScans()
  const lookup = useExerciseLookup()
  const [now] = useState(() => new Date())
  const loading = workoutsQ.isPending || setsQ.isPending || scansQ.isPending

  const workouts = workoutsQ.data
  const sets = setsQ.data
  const scans = scansQ.data
  const ev = useMemo(() => {
    if (!workouts || !sets || !scans) return null
    const bw = latestBodyweight(scans, workouts)
    return buildEvolution({ workouts, sets, scans, lookup, now, bodyweight: bw?.value ?? null })
  }, [workouts, sets, scans, lookup, now])

  return (
    <>
      <PageHeader title="Evolución" back />
      {loading || !ev ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : !ev.sessions.length && !ev.scans.length ? (
        <EmptyState
          title="Tu historia empieza aquí"
          description="Registra tu primera sesión o un escáner corporal y aquí verás mes a mes cómo mejoras: volumen, fuerza, récords y cuerpo."
          action={<Button onClick={() => nav('/train')}>Ir a entrenar</Button>}
        />
      ) : (
        <div className="flex flex-col gap-8 pb-6">
          {ev.sessions.length < 3 && (
            <p className="px-1 text-[13px] text-muted">
              Aún hay pocos datos de entreno ({ev.sessions.length}{' '}
              {ev.sessions.length === 1 ? 'sesión' : 'sesiones'}). Cada sesión que registres suma
              aquí: volumen, 1RM estimado, récords y constancia.
            </p>
          )}
          <SummarySection ev={ev} now={now} />
          <TimelineSection ev={ev} />
          <ConsistencySection ev={ev} now={now} target={me.weeklyTarget} />
          <CompareSection ev={ev} />
        </div>
      )}
    </>
  )
}

/* ───────────── 1 · Resumen ───────────── */

const PERIOD_LABEL: Record<Period, string> = {
  '3m': '3 meses',
  '6m': '6 meses',
  '1y': '1 año',
  all: 'Todo',
}

function SummarySection({ ev, now }: { ev: Evolution; now: Date }) {
  const [period, setPeriod] = useState<Period>('all')
  const from = useMemo(() => periodStart(period, now), [period, now])
  const s = useMemo(() => summarize(ev, from), [ev, from])
  const since =
    period === 'all'
      ? ev.firstDate
        ? `Desde tu primer dato, el ${longDate(ev.firstDate)}.`
        : ''
      : `Desde el ${longDate(localIso(from!))}.`

  return (
    <section>
      <SectionTitle>Resumen</SectionTitle>
      <Segmented<Period>
        size="sm"
        value={period}
        onChange={setPeriod}
        options={(Object.keys(PERIOD_LABEL) as Period[]).map((p) => ({
          value: p,
          label: PERIOD_LABEL[p],
        }))}
      />
      <p className="mt-3 px-1 text-[12.5px] text-muted">{since}</p>
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-5 px-1">
        <Kpi label="Sesiones" value={s.sessions} />
        <Kpi label="Series" value={s.sets} caption="Efectivas (RIR ≤ 4)" />
        <Kpi label="Tonelaje" value={formatInt(s.tonnage)} unit="kg" caption="kg × reps" />
        <Kpi
          label="Récords"
          value={s.records}
          tone={s.records ? 'signal' : 'default'}
          caption="Series que batieron una marca"
        />
      </div>

      <div className="mt-6 border-t border-line pt-4">
        <div className="spec mb-2 px-1">Cuerpo</div>
        {s.body.length ? (
          <>
            <ul className="divide-y divide-line">
              {s.body.map((d) => (
                <BodyDeltaRow key={d.metric} d={d} />
              ))}
            </ul>
            <p className="mt-2 px-1 text-[12.5px] text-muted">
              Del escáner del {longDate(s.firstScan!.date)} al del {longDate(s.lastScan!.date)}.
            </p>
          </>
        ) : (
          <p className="px-1 text-[13.5px] text-muted">
            {s.lastScan
              ? `Solo un escáner en este periodo (${longDate(s.lastScan.date)}): hace falta otro para ver el cambio.`
              : 'Sin escáneres en este periodo. Añade uno en Cuerpo para seguir peso, grasa y músculo.'}
          </p>
        )}
      </div>
    </section>
  )
}

function localIso(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function BodyDeltaRow({ d }: { d: MetricDelta }) {
  const def = METRIC_DEFS[d.metric]
  return (
    <li className="flex min-h-[52px] items-center justify-between gap-3 px-1 py-2">
      <span className="text-[14.5px] font-medium text-ink-2">{def.label}</span>
      <span className="flex items-baseline gap-2">
        {d.to != null && (
          <span className="readout text-[20px] font-semibold">
            {formatMetric(d.metric, d.to)}
            <span className="ml-0.5 font-sans text-[11px] text-muted">{def.unit}</span>
          </span>
        )}
        {d.diff != null && (
          <ToneDelta diff={d.diff} tone={d.tone} text={formatSigned(d.metric, d.diff)} />
        )}
      </span>
    </li>
  )
}

function ToneDelta({ diff, tone, text }: { diff: number; tone: Tone; text: string }) {
  return (
    <Delta
      text={text}
      direction={text === '0' ? 'flat' : diff > 0 ? 'up' : 'down'}
      tone={text === '0' ? 'neutral' : tone}
    />
  )
}

/* ───────────── 2 · Línea de tiempo ───────────── */

function TimelineSection({ ev }: { ev: Evolution }) {
  const [open, setOpen] = useState<ReadonlySet<string>>(
    () => new Set(ev.months[0] ? [ev.months[0].key] : []),
  )
  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  return (
    <section>
      <SectionTitle>Mes a mes</SectionTitle>
      <ul className="divide-y divide-line border-y border-line">
        {ev.months.map((m) => (
          <MonthRow key={m.key} m={m} open={open.has(m.key)} onToggle={() => toggle(m.key)} />
        ))}
      </ul>
    </section>
  )
}

function monthSubtitle(m: MonthSummary): string {
  const parts: string[] = []
  if (m.sessions) {
    parts.push(`${m.sessions} ${m.sessions === 1 ? 'sesión' : 'sesiones'}`)
    parts.push(`${m.sets} series`)
  } else parts.push('Sin entrenos')
  if (m.records.length)
    parts.push(`${m.records.length} ${m.records.length === 1 ? 'récord' : 'récords'}`)
  if (m.scans.length) parts.push(m.scans.length === 1 ? '1 escáner' : `${m.scans.length} escáneres`)
  return parts.join(' · ')
}

function MonthRow({ m, open, onToggle }: { m: MonthSummary; open: boolean; onToggle: () => void }) {
  const lookup = useExerciseLookup()
  return (
    <li>
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex min-h-[60px] w-full items-center gap-3 px-1 py-2.5 text-left active:bg-panel-2"
      >
        <span className="min-w-0 flex-1">
          <span className="block font-display text-[18px] font-semibold uppercase tracking-[0.04em]">
            {m.label}
          </span>
          <span className="block text-[12.5px] text-muted">{monthSubtitle(m)}</span>
          {!open && m.milestones[0] && (
            <span className="mt-0.5 block text-[12.5px] text-gold">
              {m.milestones[0].text}
              {m.milestones.length > 1 && ` · +${m.milestones.length - 1}`}
            </span>
          )}
        </span>
        {m.tonnage > 0 && (
          <span className="readout shrink-0 text-[18px] font-semibold">
            {formatInt(m.tonnage)}
            <span className="ml-0.5 font-sans text-[11px] text-muted">kg</span>
          </span>
        )}
        <ChevronDown
          className={clsx('size-4 shrink-0 text-muted transition', open && 'rotate-180')}
          aria-hidden
        />
      </button>

      {open && (
        <div className="flex flex-col gap-5 px-1 pb-5 pt-1">
          {m.milestones.length > 0 && (
            <ul className="flex flex-col gap-1 border-l-2 border-gold pl-3">
              {m.milestones.map((x) => (
                <li key={x.kind + x.text} className="text-[13.5px] font-medium text-gold-light">
                  {x.text}
                </li>
              ))}
            </ul>
          )}

          {m.sessions > 0 && (
            <div className="grid grid-cols-3 gap-3">
              <Kpi
                size="sm"
                label="Sesiones"
                value={m.sessions}
                caption={m.perWeek != null ? `${fmt1(m.perWeek)} por semana` : undefined}
              />
              <Kpi
                size="sm"
                label="Series"
                value={m.sets}
                caption={m.prev ? <UpDelta diff={m.sets - m.prev.sets} /> : 'sin mes previo'}
              />
              <Kpi
                size="sm"
                label="Tonelaje"
                value={formatInt(m.tonnage)}
                unit="kg"
                caption={
                  m.prev ? (
                    <UpDelta diff={m.tonnage - m.prev.tonnage} format={(n) => formatInt(n)} />
                  ) : (
                    'sin mes previo'
                  )
                }
              />
            </div>
          )}

          {m.lifts.length > 0 && (
            <Block title="1RM estimado · principales">
              {m.lifts.map((l) => (
                <Line key={l.exerciseId} label={lookup(l.exerciseId).name}>
                  <Readout value={fmt1(l.best)} unit="kg" />
                  {l.change != null ? (
                    <UpDelta diff={l.change} />
                  ) : (
                    <span className="text-[11.5px] text-muted">primera vez</span>
                  )}
                </Line>
              ))}
            </Block>
          )}

          {m.records.length > 0 && (
            <Block title={`Récords · ${m.records.length}`}>
              {m.records.toReversed().map((pr) => (
                <RecordLine key={pr.setId} pr={pr} name={lookup(pr.exerciseId).name} />
              ))}
            </Block>
          )}

          {m.scans.length > 0 && (
            <Block title="Escáner">
              {m.scans.map((s) => (
                <ScanLine key={s.date} s={s} />
              ))}
            </Block>
          )}

          {m.sessions > 0 && m.lifts.length === 0 && m.records.length === 0 && (
            <p className="text-[12.5px] text-muted">
              Sin levantamientos principales ni récords este mes.
            </p>
          )}
        </div>
      )}
    </li>
  )
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className="spec mb-1">{title}</div>
      <ul className="divide-y divide-line">{children}</ul>
    </div>
  )
}

function Line({
  label,
  sub,
  children,
}: {
  label: ReactNode
  sub?: ReactNode
  children: ReactNode
}) {
  return (
    <li className="flex min-h-[48px] items-center justify-between gap-3 py-2">
      <span className="min-w-0">
        <span className="block text-[14px] font-medium leading-snug">{label}</span>
        {sub && <span className="block text-[12px] text-muted">{sub}</span>}
      </span>
      <span className="flex shrink-0 items-baseline gap-2">{children}</span>
    </li>
  )
}

function Readout({ value, unit, gold }: { value: ReactNode; unit?: string; gold?: boolean }) {
  return (
    <span className={clsx('readout text-[18px] font-semibold', gold && 'text-gold-light')}>
      {value}
      {unit && <span className="ml-0.5 font-sans text-[11px] text-muted">{unit}</span>}
    </span>
  )
}

function RecordLine({ pr, name }: { pr: PersonalRecord; name: string }) {
  return (
    <Line label={name} sub={`${shortDate(pr.date)} · ${PR_LABEL[pr.kind]}`}>
      <Readout gold value={prValue(pr, fmt1)} />
    </Line>
  )
}

const scanPart = (v: number | null, metric: 'peso' | 'grasa' | 'musculo') =>
  v == null
    ? null
    : `${METRIC_DEFS[metric].short} ${formatMetric(metric, v)} ${METRIC_DEFS[metric].unit}`

function ScanLine({ s }: { s: Scan }) {
  return (
    <Line
      label={longDate(s.date)}
      sub={[scanPart(s.peso, 'peso'), scanPart(s.grasa, 'grasa'), scanPart(s.musculo, 'musculo')]
        .filter(Boolean)
        .join(' · ')}
    >
      {s.musculo != null && <Readout value={formatMetric('musculo', s.musculo)} unit="kg músc." />}
    </Line>
  )
}

/* ───────────── 3 · Constancia ───────────── */

const DAY_LETTERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const SHORT_MONTH = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
]
const LEVEL_BG = [
  'var(--panel-3)',
  'color-mix(in oklab, var(--gold) 40%, var(--panel-3))',
  'color-mix(in oklab, var(--gold) 70%, var(--panel-3))',
  'var(--gold)',
] as const

function ConsistencySection({ ev, now, target }: { ev: Evolution; now: Date; target: number }) {
  const grid = useMemo(() => consistencyGrid(ev.sessions, now, 26), [ev, now])
  const streaks = useMemo(() => weekStreaks(ev.sessions, target, now), [ev, target, now])
  const trainedDays = grid.reduce((t, w) => t + w.days.filter((d) => d.sessions > 0).length, 0)

  return (
    <section>
      <SectionTitle>Constancia · 26 semanas</SectionTitle>
      <ConsistencyGrid grid={grid} trainedDays={trainedDays} />
      <p className="mt-2 px-1 text-[12.5px] text-muted">
        <span className="readout text-[15px] text-ink">{trainedDays}</span> días entrenados. Cuanto
        más dorado, más series ese día.
      </p>
      <div className="mt-5 grid grid-cols-2 gap-4 px-1">
        <Kpi
          label="Racha actual"
          value={streaks.current}
          unit={streaks.current === 1 ? 'semana' : 'semanas'}
          tone={streaks.current > 0 ? 'signal' : 'default'}
          caption={`Esta semana: ${streaks.thisWeek} de ${streaks.target}`}
        />
        <Kpi
          label="Mejor racha"
          value={streaks.best}
          unit={streaks.best === 1 ? 'semana' : 'semanas'}
          caption={`Semanas con ${streaks.target} o más sesiones`}
        />
      </div>
    </section>
  )
}

function ConsistencyGrid({ grid, trainedDays }: { grid: WeekColumn[]; trainedDays: number }) {
  const cols = `14px repeat(${grid.length}, minmax(0, 1fr))`
  return (
    <div
      role="img"
      aria-label={`${trainedDays} días entrenados en las últimas ${grid.length} semanas`}
      className="px-1"
    >
      <div className="grid gap-[2px]" style={{ gridTemplateColumns: cols }} aria-hidden>
        <span />
        {grid.map((w, i) => {
          const show = i === 0 || w.month !== grid[i - 1]!.month
          const mon = Number(w.month.slice(5, 7)) - 1
          return (
            <span key={w.start} className="relative h-4">
              {show && i < grid.length - 2 && (
                <span className="absolute left-0 top-0 whitespace-nowrap text-[10.5px] text-muted">
                  {SHORT_MONTH[mon]}
                </span>
              )}
            </span>
          )
        })}
        {DAY_LETTERS.map((letter, row) => (
          <GridRow key={letter} letter={letter} row={row} grid={grid} />
        ))}
      </div>
    </div>
  )
}

function GridRow({ letter, row, grid }: { letter: string; row: number; grid: WeekColumn[] }) {
  return (
    <>
      <span className="self-center text-[10px] leading-none text-muted">
        {row % 2 === 0 ? letter : ''}
      </span>
      {grid.map((w) => {
        const d = w.days[row]!
        return (
          <span
            key={d.date}
            title={d.sessions ? `${d.date}: ${d.sets} series` : d.date}
            className="aspect-square rounded-[2px]"
            style={{
              background: d.future ? 'transparent' : LEVEL_BG[d.level],
            }}
          />
        )
      })}
    </>
  )
}

/* ───────────── 4 · Comparador ───────────── */

const TONE_CLASS: Record<Tone, string> = {
  good: 'text-gold',
  bad: 'text-warn',
  neutral: 'text-muted',
}

function valueOf(r: CompareRow, v: number | null): string {
  if (v == null) return '—'
  const s = r.subject
  if (s.group === 'body') return formatMetric(s.metric, v)
  if (s.group === 'training' && s.metric === 'tonnage') return formatInt(v)
  return fmt1(v)
}

function diffOf(r: CompareRow): string {
  if (r.diff == null) return ''
  const s = r.subject
  if (s.group === 'body') return formatSigned(s.metric, r.diff)
  if (s.group === 'training' && s.metric === 'tonnage') return signedText(r.diff, formatInt)
  return signedText(r.diff, fmt1)
}

function CompareSection({ ev }: { ev: Evolution }) {
  const lookup = useExerciseLookup()
  const def = useMemo(() => defaultComparison(ev), [ev])
  const [a, setA] = useState(def.a)
  const [b, setB] = useState(def.b)
  const options = useMemo(
    () => [...new Set([...ev.monthKeys, def.a, def.b])].toSorted().toReversed(),
    [ev, def],
  )
  const rows = useMemo(() => compareMonths(ev, a, b), [ev, a, b])
  const ma = monthSummary(ev, a)
  const mb = monthSummary(ev, b)

  const groups: { title: string; rows: CompareRow[] }[] = [
    { title: 'Entreno', rows: rows.filter((r) => r.subject.group === 'training') },
    { title: 'Series por músculo', rows: rows.filter((r) => r.subject.group === 'muscle') },
    { title: '1RM estimado', rows: rows.filter((r) => r.subject.group === 'lift') },
    {
      title: 'Cuerpo · último escáner del mes',
      rows: rows.filter((r) => r.subject.group === 'body'),
    },
  ].filter((g) => g.rows.length)

  const labelOf = (r: CompareRow): string => {
    const s = r.subject
    switch (s.group) {
      case 'training':
        return s.metric === 'sessions' ? 'Sesiones' : s.metric === 'sets' ? 'Series' : 'Tonelaje'
      case 'muscle':
        return MUSCLE_LABEL[s.muscle]
      case 'lift':
        return lookup(s.exerciseId).name
      case 'body':
        return METRIC_DEFS[s.metric].label
    }
  }
  return (
    <section>
      <SectionTitle>Comparar meses</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Mes A">
          {(id) => (
            <Select id={id} value={a} onChange={(e) => setA(e.target.value)}>
              {options.map((k) => (
                <option key={k} value={k}>
                  {monthLabel(k)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Mes B">
          {(id) => (
            <Select id={id} value={b} onChange={(e) => setB(e.target.value)}>
              {options.map((k) => (
                <option key={k} value={k}>
                  {monthLabel(k)}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <p className="mt-2 px-1 text-[12.5px] text-muted">
        Diferencia de B respecto a A: dorado si mejora, naranja si empeora.
      </p>

      {!ma.sessions && !mb.sessions && !ma.scans.length && !mb.scans.length ? (
        <p className="mt-4 px-1 text-[13.5px] text-muted">
          Ninguno de los dos meses tiene entrenos ni escáneres. Elige otros meses.
        </p>
      ) : (
        <div className="mt-3 flex flex-col gap-5">
          {groups.map((g) => (
            <div key={g.title}>
              <div className="grid grid-cols-[1fr_64px_64px_64px] items-baseline gap-x-2 px-1 pb-1">
                <span className="spec">{g.title}</span>
                <span className="spec text-right">A</span>
                <span className="spec text-right">B</span>
                <span className="spec text-right">Dif.</span>
              </div>
              <ul className="divide-y divide-line">
                {g.rows.map((r) => (
                  <li
                    key={JSON.stringify(r.subject)}
                    className="grid min-h-[44px] grid-cols-[1fr_64px_64px_64px] items-center gap-x-2 px-1 py-1.5"
                  >
                    <span className="min-w-0 break-words text-[13.5px] text-ink-2">
                      {labelOf(r)}
                    </span>
                    <span className="readout text-right text-[16px] text-ink-2">
                      {valueOf(r, r.a)}
                    </span>
                    <span className="readout text-right text-[16px] font-semibold">
                      {valueOf(r, r.b)}
                    </span>
                    <span
                      className={clsx(
                        'readout text-right text-[15px] font-semibold',
                        TONE_CLASS[r.tone],
                      )}
                    >
                      {diffOf(r) || '—'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
