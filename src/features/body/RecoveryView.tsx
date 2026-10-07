import { HeartPulse } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { LineChart } from '@/components/charts/LineChart'
import { Delta, Kpi } from '@/components/kpi/Kpi'
import { Button } from '@/components/ui/Button'
import { EmptyState, SectionTitle } from '@/components/ui/primitives'
import { addLocalDays, formatDuration, formatNumber, localDateKey } from '@/domain/training'
import type { HealthDay } from '@/domain/types'
import { CheckinSheet } from '@/features/today/CheckinSheet'
import { useRecoveryDays } from '@/features/today/useReadiness'
import { useNow } from '@/lib/useNow'
import { RECOVERY_DEFS, recoveryStats, trendTone, type RecoveryMetric } from './recovery'
import { formatInt, longDate } from './scans'

const METRICS: RecoveryMetric[] = ['sleepMin', 'restingHr', 'hrvMs', 'steps']

function fmt(metric: RecoveryMetric, n: number): string {
  if (metric === 'sleepMin') return formatNumber(n, 1)
  if (metric === 'steps') return formatInt(n)
  return formatNumber(n, 0)
}

export function RecoveryView() {
  const days = useRecoveryDays()
  const [checkin, setCheckin] = useState(false)
  const today = useNow(3_600_000)
  const recent = useMemo(() => {
    const from = localDateKey(addLocalDays(today, -29))
    return days.filter((d) => d.date >= from)
  }, [days, today])
  const synced = recent.filter((d) => d.source === 'google_health').length
  const typed = recent.length - synced
  const phases = useMemo(
    () => recent.findLast((d) => d.deepMin !== null || d.remMin !== null) ?? null,
    [recent],
  )

  const sheet = <CheckinSheet open={checkin} onClose={() => setCheckin(false)} />
  const register = (
    <Button block onClick={() => setCheckin(true)}>
      Registrar hoy
    </Button>
  )

  if (!recent.length) {
    return (
      <>
        <EmptyState
          icon={<HeartPulse className="size-6" />}
          title="Sin datos de recuperación"
          description="Apunta cada mañana sueño, FC en reposo, HRV y pasos desde la app Google Health. Con 7 días ya verás tendencias."
          action={
            <div className="flex flex-col items-center gap-3">
              {register}
              <Link to="/settings/health" className="spec text-gold">
                Pulsera y salud
              </Link>
            </div>
          }
        />
        {sheet}
      </>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-[13px] leading-snug text-muted">
          Últimos 30 días: {synced} {synced === 1 ? 'día sincronizado' : 'días sincronizados'} de la
          pulsera y {typed} {typed === 1 ? 'tecleado' : 'tecleados'} en el check-in. Donde hay los
          dos, manda la pulsera.
        </p>
        <div className="mt-3">{register}</div>
      </div>

      {phases && <SleepPhases day={phases} />}

      {METRICS.map((m) => (
        <MetricBlock key={m} metric={m} days={recent} today={today} />
      ))}
      {sheet}
    </div>
  )
}

function MetricBlock({
  metric,
  days,
  today,
}: {
  metric: RecoveryMetric
  days: HealthDay[]
  today: Date
}) {
  const def = RECOVERY_DEFS[metric]
  const s = useMemo(() => recoveryStats(days, metric, today), [days, metric, today])
  const tone = trendTone(metric, s)
  const diff = s.mean7 !== null && s.mean28 !== null ? s.mean7 - s.mean28 : null
  return (
    <section>
      <SectionTitle>{def.label}</SectionTitle>
      <div className="card p-4">
        {s.points.length === 0 ? (
          <p className="text-[13.5px] text-muted">Sin datos en los últimos 30 días.</p>
        ) : (
          <>
            <Kpi
              label="Media 7 días"
              size="sm"
              value={s.mean7 === null ? '—' : fmt(metric, s.mean7)}
              unit={s.mean7 === null ? undefined : def.unit}
              aside={
                diff !== null && s.n7 >= 3 ? (
                  <Delta
                    text={`${diff > 0 ? '+' : diff < 0 ? '−' : ''}${fmt(metric, Math.abs(diff))}`}
                    direction={tone === 'neutral' ? 'flat' : diff > 0 ? 'up' : 'down'}
                    tone={tone}
                  />
                ) : undefined
              }
              caption={
                s.mean28 !== null
                  ? `Media 28 días: ${fmt(metric, s.mean28)} ${def.unit} (${s.n28} días con dato)`
                  : undefined
              }
            />
            <LineChart
              className="mt-4"
              height={110}
              points={s.points}
              unit={def.unit}
              format={(n) => fmt(metric, n)}
              target={s.mean28 ?? undefined}
              label={`${def.label}, últimos 30 días`}
            />
            <p className="mt-2 text-[11.5px] text-muted">Línea discontinua: tu media de 28 días.</p>
          </>
        )}
      </div>
    </section>
  )
}

const PHASES = [
  { key: 'deepMin', label: 'Profundo', color: 'var(--gold)' },
  { key: 'remMin', label: 'REM', color: 'var(--chart-2)' },
  { key: 'lightMin', label: 'Ligero', color: 'var(--chart-4)' },
  { key: 'awakeMin', label: 'Despierto', color: 'var(--panel-3)' },
] as const

function SleepPhases({ day }: { day: HealthDay }) {
  const parts = PHASES.map((p) => ({ ...p, min: day[p.key] ?? 0 })).filter((p) => p.min > 0)
  const total = parts.reduce((a, p) => a + p.min, 0)
  if (!total) return null
  return (
    <section>
      <SectionTitle>Fases del sueño · {longDate(day.date)}</SectionTitle>
      <div className="card p-4">
        <div className="flex h-3 w-full overflow-hidden rounded-full" aria-hidden>
          {parts.map((p) => (
            <span key={p.key} style={{ width: `${(p.min / total) * 100}%`, background: p.color }} />
          ))}
        </div>
        <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[13.5px]">
          {parts.map((p) => (
            <li key={p.key} className="flex items-center gap-2">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ background: p.color }}
                aria-hidden
              />
              <span className="flex-1 text-ink-2">{p.label}</span>
              <span className="readout text-[15px]">{formatDuration(p.min)}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
