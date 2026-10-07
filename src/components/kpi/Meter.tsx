import { clsx } from 'clsx'

const clamp01 = (x: number) => Math.min(1, Math.max(0, Number.isFinite(x) ? x : 0))

/**
 * A thin horizontal gauge: how far `value` is along `max`, with an optional `target` tick (an
 * objective, a reorder point, 100 %) and an optional shaded `band` (an expected range). The bar
 * is decoration: the number it stands for is always written next to it, so it is hidden from
 * assistive technology unless `label` is given.
 */
export function Meter({
  value,
  max = 1,
  target,
  band,
  color = 'var(--signal)',
  height = 6,
  label,
  className,
}: {
  value: number
  max?: number
  /** Position of a tick, in the unit of `value`. */
  target?: number
  /** [from, to] range shaded behind the fill, in the unit of `value`. */
  band?: readonly [number, number]
  color?: string
  height?: number
  label?: string
  className?: string
}) {
  const f = max > 0 ? clamp01(value / max) : 0
  const t = target !== undefined && max > 0 ? clamp01(target / max) : null
  const b: [number, number] | null =
    band && max > 0 ? [clamp01(band[0] / max), clamp01(band[1] / max)] : null
  return (
    <div
      className={clsx('relative w-full', className)}
      style={{ height }}
      role={label ? 'meter' : undefined}
      aria-label={label}
      aria-valuemin={label ? 0 : undefined}
      aria-valuemax={label ? max : undefined}
      aria-valuenow={label ? value : undefined}
      aria-hidden={label ? undefined : true}
    >
      <div className="absolute inset-0 overflow-hidden rounded-full bg-panel-3">
        {b && (
          <div
            className="absolute inset-y-0"
            style={{
              left: `${b[0] * 100}%`,
              width: `${Math.max(0, b[1] - b[0]) * 100}%`,
              background: `color-mix(in oklab, ${color} 22%, transparent)`,
            }}
          />
        )}
        <div
          data-fill
          className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none"
          style={{ width: `${f * 100}%`, background: color }}
        />
      </div>
      {t !== null && (
        <span
          className="absolute -top-[3px] w-[2px] -translate-x-1/2 rounded-full bg-ink"
          style={{ left: `${t * 100}%`, height: height + 6 }}
        />
      )}
    </div>
  )
}
