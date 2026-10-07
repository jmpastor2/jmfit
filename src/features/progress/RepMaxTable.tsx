import { formatNumber } from '@/domain/training'

const REP_MAX = [1, 3, 5, 8, 10, 12] as const

/** Heaviest weight for at least 1, 3, 5, 8, 10 and 12 reps, one cell each. */
export function RepMaxTable({ repPRs }: { repPRs: Record<number, number> }) {
  return (
    <div className="mt-5">
      <div className="spec mb-1.5">Rep-max · peso más alto para al menos N reps</div>
      <div className="grid grid-cols-6 divide-x divide-line rounded-[8px] border border-line">
        {REP_MAX.map((n) => (
          <div key={n} className="flex min-w-0 flex-col items-center py-2">
            <span className="spec text-[10.5px]">{n}RM</span>
            <span className="readout mt-0.5 text-[17px] font-semibold">
              {repPRs[n] != null ? formatNumber(repPRs[n]) : '—'}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-[12px] text-muted">
        En kg. Solo series efectivas, sin calentamiento.
      </p>
    </div>
  )
}
