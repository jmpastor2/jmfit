import { useMemo, useState } from 'react'
import { useToast } from '@/components/ui/Toast'
import { queued, useActiveProgram, useProgramActions } from '@/data/hooks'
import type { WorkoutFull } from '@/data/rows'
import type { Exercise } from '@/domain/types'

export interface ProgramSwap {
  slotId: string
  dayName: string
  from: Exercise
  to: Exercise
}

/**
 * Exercises of the session that replaced the program's (same slot, other exercise). Swaps of
 * a session from another program, or of slots the program no longer has, are left out.
 */
export function programSwaps(
  workout: WorkoutFull,
  program: {
    id: string
    days: { id: string; name: string; slots: { id: string; exerciseId: string }[] }[]
  } | null,
  lookup: (id: string) => Exercise,
): ProgramSwap[] {
  if (!program || workout.programId !== program.id) return []
  const out: ProgramSwap[] = []
  for (const slot of workout.plan) {
    for (const day of program.days) {
      const original = day.slots.find((s) => s.id === slot.id)
      if (original && original.exerciseId !== slot.exerciseId) {
        out.push({
          slotId: slot.id,
          dayName: day.name,
          from: lookup(original.exerciseId),
          to: lookup(slot.exerciseId),
        })
      }
    }
  }
  return out
}

/** «Cambios respecto al programa» in the session summary: keep each swap for next time. */
export function ProgramSwapsSection({
  workout,
  lookup,
}: {
  workout: WorkoutFull
  lookup: (id: string) => Exercise
}) {
  const { program } = useActiveProgram()
  const { save } = useProgramActions()
  const { toast } = useToast()
  const [saved, setSaved] = useState<Set<string>>(new Set())
  const swaps = useMemo(() => programSwaps(workout, program, lookup), [workout, program, lookup])
  if (!program || !swaps.length) return null

  const keep = (swap: ProgramSwap) => {
    queued(
      save({
        ...program,
        days: program.days.map((d) => ({
          ...d,
          slots: d.slots.map((s) =>
            s.id === swap.slotId ? { ...s, exerciseId: swap.to.id, restSec: swap.to.restSec } : s,
          ),
        })),
      }),
    )
    setSaved((prev) => new Set(prev).add(swap.slotId))
    toast(`${swap.dayName}: ahora ${swap.to.name}`, 'success')
  }

  return (
    <section className="mb-6">
      <h2 className="spec mb-1 text-ink-2">Cambios respecto al programa</h2>
      <p className="mb-2 text-[12.5px] text-muted">
        Guárdalos y la próxima vez la sesión empezará así.
      </p>
      <ul className="divide-y divide-line border-y border-line">
        {swaps.map((swap) => (
          <li key={swap.slotId} className="flex min-h-14 items-center justify-between gap-3 py-2">
            <span className="min-w-0">
              <span className="block text-[14.5px] font-medium">{swap.to.name}</span>
              <span className="block text-[12.5px] text-muted">en lugar de {swap.from.name}</span>
            </span>
            {saved.has(swap.slotId) ? (
              <span className="spec shrink-0 text-ok">Guardado</span>
            ) : (
              <button
                type="button"
                onClick={() => keep(swap)}
                className="shrink-0 rounded-[8px] border border-gold/60 px-3 py-2 text-[12.5px] font-semibold text-gold"
              >
                Guardar
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
