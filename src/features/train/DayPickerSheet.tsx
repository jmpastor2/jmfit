import { ChevronRight } from 'lucide-react'
import { Sheet } from '@/components/ui/Sheet'
import type { Program } from '@/data/rows'
import type { ProgramDay } from '@/domain/types'
import { estimateMinutes } from './history'

/** Choose which day of the program to train now. */
export function DayPickerSheet({
  open,
  onClose,
  program,
  onPick,
}: {
  open: boolean
  onClose: () => void
  program: Program
  onPick: (day: ProgramDay) => void
}) {
  return (
    <Sheet open={open} onClose={onClose} title="¿Qué día entrenas?" description={program.name}>
      <ul className="divide-y divide-line pb-2">
        {program.days.map((d) => (
          <li key={d.id}>
            <button
              type="button"
              onClick={() => {
                onClose()
                onPick(d)
              }}
              className="flex min-h-[56px] w-full items-center gap-3 py-2 text-left active:bg-panel-2"
            >
              <span className="min-w-0 flex-1">
                <span className="block font-display text-[18px] font-semibold uppercase tracking-[0.04em]">
                  {d.name}
                </span>
                <span className="block text-[12.5px] text-muted">
                  {d.focus ? `${d.focus} · ` : ''}
                  {d.slots.length} ejercicios · ≈ {estimateMinutes(d.slots)} min
                </span>
              </span>
              <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  )
}
