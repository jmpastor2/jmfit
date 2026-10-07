import { clsx } from 'clsx'
import { useId, useMemo, useState } from 'react'

export interface ChartPoint {
  /** ISO date (or any sortable x label). */
  x: string
  y: number
}

/**
 * A quiet time chart: one gold line over hairline min/max guides, an optional dashed target and
 * a second faint series for comparison. Tap or drag reads the nearest point. Dates are spread by
 * their real distance in time, so a gap of two months looks like one.
 */
export function LineChart({
  points,
  compare,
  target,
  height = 160,
  unit = '',
  format = (n) => String(Math.round(n * 10) / 10).replace('.', ','),
  formatX = shortDate,
  color = 'var(--gold)',
  className,
  label,
}: {
  points: ChartPoint[]
  compare?: ChartPoint[]
  target?: number
  height?: number
  unit?: string
  format?: (n: number) => string
  formatX?: (x: string) => string
  color?: string
  className?: string
  /** Accessible summary of what the chart shows. */
  label?: string
}) {
  const id = useId()
  const [hover, setHover] = useState<number | null>(null)
  const geo = useMemo(() => {
    const all = [...points, ...(compare ?? [])]
    if (points.length < 1) return null
    const ts = all.map((p) => Date.parse(p.x))
    const t0 = Math.min(...ts)
    const t1 = Math.max(...ts)
    const ys = all.map((p) => p.y).concat(target !== undefined ? [target] : [])
    let lo = Math.min(...ys)
    let hi = Math.max(...ys)
    if (hi - lo < 1e-9) {
      lo -= 1
      hi += 1
    }
    const pad = (hi - lo) * 0.12
    lo -= pad
    hi += pad
    const W = 100
    const H = 100
    const sx = (x: string) => (t1 === t0 ? W / 2 : ((Date.parse(x) - t0) / (t1 - t0)) * W)
    const sy = (y: number) => H - ((y - lo) / (hi - lo)) * H
    const path = (ps: ChartPoint[]) =>
      ps.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(2)},${sy(p.y).toFixed(2)}`).join(' ')
    return { sx, sy, path, lo: lo + pad, hi: hi - pad }
  }, [points, compare, target])

  if (!geo) {
    return (
      <div
        className={clsx('grid place-items-center text-[13px] text-muted', className)}
        style={{ height }}
      >
        Sin datos todavía
      </div>
    )
  }

  const shown = hover ?? points.length - 1
  const sel = points[shown]!
  const minY = Math.min(...points.map((p) => p.y))
  const maxY = Math.max(...points.map((p) => p.y))

  const pick = (clientX: number, el: HTMLElement) => {
    const r = el.getBoundingClientRect()
    const fx = ((clientX - r.left) / r.width) * 100
    let best = 0
    let bd = Infinity
    points.forEach((p, i) => {
      const d = Math.abs(geo.sx(p.x) - fx)
      if (d < bd) {
        bd = d
        best = i
      }
    })
    setHover(best)
  }

  return (
    <figure className={className} aria-label={label} role={label ? 'img' : undefined}>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="readout text-[26px] font-semibold leading-none" style={{ color }}>
          {format(sel.y)}
          {unit && (
            <span className="ml-1 font-sans text-[12px] font-medium text-muted">{unit}</span>
          )}
        </span>
        <span className="text-[12.5px] text-muted">{formatX(sel.x)}</span>
      </div>
      <div
        className="relative w-full touch-none select-none"
        style={{ height }}
        onPointerDown={(e) => pick(e.clientX, e.currentTarget)}
        onPointerMove={(e) =>
          (e.buttons || e.pointerType === 'mouse') && pick(e.clientX, e.currentTarget)
        }
        onPointerLeave={() => setHover(null)}
      >
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 size-full overflow-visible"
          aria-hidden
        >
          <defs>
            <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={color} stopOpacity="0.16" />
              <stop offset="1" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          {[geo.sy(maxY), geo.sy(minY)].map((y, i) => (
            <line
              key={i}
              x1="0"
              x2="100"
              y1={y}
              y2={y}
              stroke="var(--line)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {target !== undefined && (
            <line
              x1="0"
              x2="100"
              y1={geo.sy(target)}
              y2={geo.sy(target)}
              stroke="var(--gold-dark)"
              strokeDasharray="4 4"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          )}
          {compare && compare.length > 1 && (
            <path
              d={geo.path(compare)}
              fill="none"
              stroke="var(--muted)"
              strokeOpacity="0.55"
              strokeWidth="1.25"
              vectorEffect="non-scaling-stroke"
            />
          )}
          {points.length > 1 && (
            <>
              <path
                d={`${geo.path(points)} L${geo.sx(points.at(-1)!.x)},100 L${geo.sx(points[0]!.x)},100 Z`}
                fill={`url(#${id}-fill)`}
              />
              <path
                d={geo.path(points)}
                fill="none"
                stroke={color}
                strokeWidth="1.75"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </>
          )}
          <line
            x1={geo.sx(sel.x)}
            x2={geo.sx(sel.x)}
            y1="0"
            y2="100"
            stroke="var(--line-strong)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <span
          className="pointer-events-none absolute size-[9px] -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-canvas"
          style={{ left: `${geo.sx(sel.x)}%`, top: `${geo.sy(sel.y)}%`, background: color }}
        />
        <span
          className="readout pointer-events-none absolute right-0 text-[11px] text-muted"
          style={{ top: `calc(${geo.sy(maxY)}% - 14px)` }}
        >
          {format(maxY)}
        </span>
        {format(minY) !== format(maxY) && (
          <span
            className="readout pointer-events-none absolute right-0 text-[11px] text-muted"
            style={{ top: `calc(${geo.sy(minY)}% + 2px)` }}
          >
            {format(minY)}
          </span>
        )}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-muted">
        <span>{formatX(points[0]!.x)}</span>
        {points.length > 1 && <span>{formatX(points.at(-1)!.x)}</span>}
      </div>
    </figure>
  )
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export function shortDate(iso: string): string {
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso)
  if (Number.isNaN(d.getTime())) return iso
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${sameYear ? '' : ` ${String(d.getFullYear()).slice(2)}`}`
}
