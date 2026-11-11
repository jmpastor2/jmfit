import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatNumber, sleepNeedMin, STRAIN_MAX, strainTarget } from '@/domain/training'
import { useNow } from '@/lib/useNow'
import { bedtimeTonight, clockText, savedWakeAt } from './sleep'
import { BAND_TEXT, lastNight, stateAdvice } from './format'
import { recoveryBand, type DayState } from './state'

/** Hoy's three numbers from the band, the way WHOOP opens: tap for the whole picture. */
export function StateStrip({ states }: { states: DayState[] }) {
  const today = states.at(-1)!
  const night = lastNight(states)
  const band = recoveryBand(today.recovery)
  const target = strainTarget(today.recovery)
  // From the afternoon on, the next thing that matters is tonight's bedtime.
  const evening = useNow().getHours() >= 17
  const bed = evening ? bedtimeTonight(states, sleepNeedMin(today.strain), savedWakeAt()) : null
  return (
    <Link to="/body" className="mb-5 block border-y border-line py-4 active:bg-panel-2">
      <div className="mb-3 flex items-center justify-between">
        <span className="spec text-ink-2">Estado · pulsera</span>
        <span className="spec flex items-center gap-0.5 text-gold">
          Ver <ChevronRight className="size-3.5" aria-hidden />
        </span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Figure
          label="Recuperación"
          value={today.recovery != null ? `${today.recovery}` : '—'}
          unit={today.recovery != null ? '%' : ''}
          className={band ? BAND_TEXT[band] : 'text-muted'}
        />
        <Figure
          label="Carga"
          value={formatNumber(today.strain, 1)}
          unit={target ? `obj. ${target.min}–${target.max}` : `/ ${STRAIN_MAX}`}
        />
        <Figure
          label="Sueño"
          value={night?.sleepScore != null ? `${night.sleepScore}` : '—'}
          unit={night?.sleepScore != null ? '%' : ''}
          className={night?.partialNight ? 'text-muted' : undefined}
        />
      </div>
      <p className="mt-3 text-[13px] leading-snug text-ink-2">{stateAdvice(today, target)}</p>
      {bed && (
        <p className="mt-2 text-[13px] text-ink-2">
          Esta noche, a la cama a las{' '}
          <span className="readout text-[17px] font-semibold text-gold">{clockText(bed.bed)}</span>
        </p>
      )}
    </Link>
  )
}

function Figure({
  label,
  value,
  unit,
  className,
}: {
  label: string
  value: string
  unit: string
  className?: string | undefined
}) {
  return (
    <span className="min-w-0">
      <span className="spec block">{label}</span>
      <span className={`readout block text-[30px] font-semibold leading-none ${className ?? ''}`}>
        {value}
      </span>
      {unit && <span className="mt-0.5 block text-[11.5px] text-muted">{unit}</span>}
    </span>
  )
}
