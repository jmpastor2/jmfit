import { STRAIN_MAX } from '@/domain/training'
import { BAND_COLOR, shortDay } from './format'
import { recoveryBand, type DayState } from './state'

const W = 100
const H = 60

/**
 * The signature chart: strain as gold bars (0–21) and recovery as a line (0–100) over the same
 * days, so it shows how hard days were followed by how recovered the body woke up. Bars grow
 * and the line draws itself in when the chart appears.
 */
export function RecoveryStrainChart({ states }: { states: readonly DayState[] }) {
  const n = states.length
  const slot = W / n
  const x = (i: number) => slot * i + slot / 2
  const yRec = (r: number) => H - (r / 100) * (H - 6) - 3
  const points = states
    .map((s, i) => (s.recovery == null ? null : { x: x(i), y: yRec(s.recovery), s }))
    .filter((p): p is NonNullable<typeof p> => p != null)
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ')
  const ticks = [0, Math.floor((n - 1) / 2), n - 1]
  return (
    <figure>
      <div className="relative h-40 w-full">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="absolute inset-0 size-full overflow-visible"
          role="img"
          aria-label={`Carga y recuperación de los últimos ${n} días`}
        >
          {[33, 67].map((r) => (
            <line
              key={r}
              x1="0"
              x2={W}
              y1={yRec(r)}
              y2={yRec(r)}
              stroke="var(--line-strong)"
              strokeDasharray="1 1.5"
              strokeWidth="0.3"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {states.map((s, i) => {
            const h = (s.strain / STRAIN_MAX) * (H - 6)
            return (
              <rect
                key={s.date}
                className="bar-grow"
                style={{ transformBox: 'fill-box' }}
                x={x(i) - slot * 0.32}
                y={H - h}
                width={slot * 0.64}
                height={Math.max(h, 0.4)}
                rx="0.6"
                fill="var(--gold)"
                fillOpacity={i === n - 1 ? 0.75 : 0.32}
              />
            )
          })}
          <path
            d={path}
            className="draw-line"
            pathLength={1}
            fill="none"
            stroke="var(--ink)"
            strokeWidth="1.6"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {/* Dots as HTML so they stay round on a stretched chart. */}
        {points.map((p) => {
          const band = recoveryBand(p.s.recovery)
          return (
            <span
              key={p.s.date}
              className="pop absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-canvas"
              style={{
                left: `${p.x}%`,
                top: `${(p.y / H) * 100}%`,
                background: band ? BAND_COLOR[band] : 'var(--muted)',
              }}
            />
          )
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-muted" aria-hidden>
        {ticks.map((i) => (
          <span key={i}>{i === n - 1 ? 'hoy' : shortDay(states[i]!.date)}</span>
        ))}
      </div>
      <figcaption className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2 rounded-[1px] bg-gold/50" /> Carga (0–21)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-[2px] w-3 bg-ink" /> Recuperación (0–100 %)
        </span>
        <span>Líneas: 33 % y 67 %</span>
      </figcaption>
    </figure>
  )
}
