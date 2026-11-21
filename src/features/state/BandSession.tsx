import { Kpi } from '@/components/kpi/Kpi'
import { useHealthWorkouts } from '@/data/hooks'
import type { WorkoutFull } from '@/data/rows'
import { formatNumber, strainFromLoad, zoneLoad } from '@/domain/training'
import type { HealthWorkout } from '@/domain/types'
import { bandSessionFor } from '@/features/train/activities'
import { ZonesBar } from './StateExtras'

/**
 * What the band recorded during a Forja session: time, average pulse, calories, minutes in each
 * heart rate zone and the strain the heart alone puts on the day. Nothing when the band did not
 * record it.
 */
export function BandSessionCard({
  workout,
}: {
  workout: Pick<WorkoutFull, 'startedAt' | 'endedAt'>
}) {
  const health = useHealthWorkouts().data
  const band = health ? bandSessionFor(workout, health) : null
  if (!band) return null
  return (
    <section className="border-t border-line py-5">
      <h2 className="spec mb-3 text-ink-2">Según la pulsera</h2>
      <BandFigures band={band} />
    </section>
  )
}

export function BandFigures({ band }: { band: HealthWorkout }) {
  const load = zoneLoad(band.zones)
  return (
    <>
      <div className="mb-4 grid grid-cols-3 gap-3">
        <Kpi
          size="sm"
          label="Pulso medio"
          value={band.avgHr ?? '—'}
          unit={band.avgHr ? 'ppm' : undefined}
        />
        <Kpi
          size="sm"
          label="Calorías"
          value={band.kcal ?? '—'}
          unit={band.kcal ? 'kcal' : undefined}
        />
        <Kpi
          size="sm"
          label="Carga cardio"
          value={load != null ? formatNumber(strainFromLoad(load), 1) : '—'}
          unit={load != null ? '/21' : undefined}
        />
      </div>
      <ZonesBar zones={band.zones ?? null} title="Minutos por zona de pulso" />
      <p className="text-[12px] text-muted">
        La carga cardio es solo la del corazón; las series efectivas suman aparte en tu carga del
        día.
      </p>
    </>
  )
}
