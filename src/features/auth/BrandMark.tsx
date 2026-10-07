import { clsx } from 'clsx'

/**
 * The Forja mark: an anvil-flat bar with two plates, drawn in flat champagne gold. Inline SVG so it
 * is crisp at every size and needs no request.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={clsx('shrink-0', className)} aria-hidden>
      <defs>
        <linearGradient id="forja-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#c9a55c" />
          <stop offset="0.5" stopColor="#c9a55c" />
          <stop offset="1" stopColor="#c9a55c" />
        </linearGradient>
      </defs>
      <rect
        x="1"
        y="1"
        width="62"
        height="62"
        rx="16"
        fill="#000"
        stroke="url(#forja-gold)"
        strokeWidth="1.5"
      />
      <rect x="10" y="29.5" width="44" height="5" rx="1.5" fill="url(#forja-gold)" />
      <rect x="15" y="19" width="6" height="26" rx="2" fill="url(#forja-gold)" />
      <rect x="43" y="19" width="6" height="26" rx="2" fill="url(#forja-gold)" />
      <rect x="22.5" y="23" width="4" height="18" rx="1.5" fill="url(#forja-gold)" opacity="0.7" />
      <rect x="37.5" y="23" width="4" height="18" rx="1.5" fill="url(#forja-gold)" opacity="0.7" />
    </svg>
  )
}
