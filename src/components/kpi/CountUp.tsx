import { useEffect, useRef, useState } from 'react'

const canAnimate = () =>
  typeof requestAnimationFrame === 'function' &&
  !(
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )

/**
 * A whole number that counts up to its value when it appears, and on from where it was when it
 * changes. Width stays put with tabular figures (`.readout`). With reduced motion, or where
 * there are no animation frames, it shows the value at once.
 */
export function CountUp({
  value,
  format = String,
  ms = 700,
}: {
  value: number
  format?: (n: number) => string
  ms?: number
}) {
  const [animate] = useState(canAnimate)
  const [shown, setShown] = useState(0)
  // Where the count stands, so a new value (or a restarted effect) goes on from there.
  const at = useRef(0)
  useEffect(() => {
    if (!animate) return
    const start = at.current
    const t0 = performance.now()
    let frame = requestAnimationFrame(function tick(t) {
      const k = Math.min(1, (t - t0) / ms)
      // Ease out: fast at first, settling on the figure.
      at.current = Math.round(start + (value - start) * (1 - (1 - k) ** 3))
      setShown(at.current)
      if (k < 1) frame = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(frame)
  }, [animate, value, ms])
  return <>{format(animate ? shown : value)}</>
}
