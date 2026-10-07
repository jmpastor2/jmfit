import { clsx } from 'clsx'

const H = 100

/** Vertical positions (0 top .. 100 bottom) for `values`, keeping at least `minSpan` of range. */
export function sparkYs(values: readonly number[], minSpan = 0): number[] {
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const span = Math.max(hi - lo, minSpan, 1e-9)
  const mid = (lo + hi) / 2
  // Small padding so the stroke and the end dot never touch the edges.
  return values.map((v) => 8 + (1 - ((v - mid) / span + 0.5)) * (H - 16))
}

/**
 * A small line of values over time with a faint area under it and a dot on the latest value.
 * Decoration: the value it summarises is written next to it.
 */
export function Spark({
  values,
  color = 'var(--signal)',
  height = 32,
  minSpan = 0,
  area = true,
  className,
}: {
  values: readonly number[]
  color?: string
  height?: number
  minSpan?: number
  area?: boolean
  className?: string
}) {
  if (values.length < 2) return <div className={className} style={{ height }} aria-hidden />
  const ys = sparkYs(values, minSpan)
  const xs = values.map((_, i) => (i / (values.length - 1)) * 100)
  const d = xs.map((x, i) => `${i ? 'L' : 'M'}${x.toFixed(2)},${ys[i]!.toFixed(2)}`).join(' ')
  const last = ys[ys.length - 1]!
  return (
    <div className={clsx('relative w-full', className)} style={{ height }} aria-hidden>
      <svg
        viewBox={`0 0 100 ${H}`}
        preserveAspectRatio="none"
        className="absolute inset-0 size-full overflow-visible"
      >
        {area && (
          <path
            d={`${d} L100,${H} L0,${H} Z`}
            fill={`color-mix(in oklab, ${color} 13%, transparent)`}
          />
        )}
        <path
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={1.75}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span
        className="absolute size-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-panel"
        style={{ left: '100%', top: `${last}%`, background: color }}
      />
    </div>
  )
}
