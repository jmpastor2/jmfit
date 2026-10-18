import { useMemo } from 'react'
import { LineChart, type ChartPoint } from '@/components/charts/LineChart'
import { Kpi } from '@/components/kpi/Kpi'
import { Skeleton } from '@/components/ui/primitives'
import { useMe, useScans, useWorkouts } from '@/data/hooks'
import { formatNumber } from '@/domain/training'
import { useNow } from '@/lib/useNow'
import { longDate } from './scans'
import { weightSourceLabel, weightSummary } from './weight'

/** Signed kg/week with a real minus sign: «−0,6», «+0,2». */
const signedRate = (r: number) => {
  const s = formatNumber(Math.abs(r), 1)
  if (s === '0') return '0'
  return `${r > 0 ? '+' : '−'}${s}`
}

/**
 * «Peso»: the last known bodyweight (session or scan), the 7-day mean, the weekly rate over the
 * last 21 days read against the training goal, and every daily weight of the last 90 days.
 */
export function WeightBlock() {
  const me = useMe()
  const now = useNow(3_600_000)
  const workoutsQ = useWorkouts()
  const scansQ = useScans()
  const s = useMemo(
    () => weightSummary(workoutsQ.data ?? [], scansQ.data ?? [], me.trainingGoal, now),
    [workoutsQ.data, scansQ.data, me.trainingGoal, now],
  )
  const points: ChartPoint[] = useMemo(
    () => s.chart.map((p) => ({ x: p.date, y: p.value })),
    [s.chart],
  )

  if (workoutsQ.isPending || scansQ.isPending) return <Skeleton className="h-56 rounded-[10px]" />

  if (!s.latest) {
    return (
      <section className="border-b border-line pb-6">
        <span className="spec text-gold">Peso</span>
        <p className="mt-2 text-[13.5px] text-muted">
          Sin pesos todavía. Apúntalo al terminar cada sesión o añade un escáner y aquí verás la
          tendencia.
        </p>
      </section>
    )
  }

  const { latest } = s
  return (
    <section className="border-b border-line pb-6">
      <Kpi
        label={<span className="text-gold">Peso</span>}
        size="lg"
        value={formatNumber(latest.value, 1)}
        unit="kg"
        caption={`${weightSourceLabel(latest, now)} · ${longDate(latest.date)}`}
      />
      <div className="mt-4 grid grid-cols-2 gap-4">
        <Kpi
          size="sm"
          label="Media 7 días"
          value={s.mean7 != null ? formatNumber(s.mean7, 1) : '—'}
          unit={s.mean7 != null ? 'kg' : undefined}
          caption={s.mean7 == null ? 'Sin pesos esta semana.' : undefined}
        />
        <Kpi
          size="sm"
          label="Ritmo"
          value={s.rate != null ? signedRate(s.rate) : '—'}
          unit={s.rate != null ? 'kg/sem' : undefined}
          caption={s.rate == null ? 'Hacen falta 3 pesos en al menos 6 días.' : undefined}
        />
      </div>
      {s.verdict && <p className="mt-3 text-[14px] text-ink-2">{s.verdict}</p>}
      {s.rateBasis && (
        <p className="mt-1 text-[12px] text-muted">Ritmo de los últimos 21 días: {s.rateBasis}.</p>
      )}
      <LineChart
        className="mt-4"
        points={points}
        unit="kg"
        format={(n) => formatNumber(n, 1)}
        label={`Peso: ${points.length} días con medida en los últimos 90`}
      />
      <p className="mt-2 text-[12px] text-muted">
        90 días · un punto por día con peso (sesiones y escáneres; si hay varios, el último).
      </p>
    </section>
  )
}
