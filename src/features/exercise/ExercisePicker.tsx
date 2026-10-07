import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { EQUIPMENT_LABEL, MUSCLE_LABEL, normalize } from '@/content/exercises'
import { Sheet } from '@/components/ui/Sheet'
import { Chip } from '@/components/ui/primitives'
import type { Exercise, Muscle } from '@/domain/types'
import { useAllExercises } from './lookup'

export const MUSCLE_GROUPS: { label: string; muscles: Muscle[] }[] = [
  { label: 'Pecho', muscles: ['chest'] },
  { label: 'Espalda', muscles: ['back', 'traps', 'lower_back'] },
  { label: 'Hombro', muscles: ['front_delts', 'side_delts', 'rear_delts'] },
  { label: 'Brazos', muscles: ['biceps', 'triceps', 'forearms'] },
  { label: 'Pierna', muscles: ['quads', 'hamstrings', 'adductors', 'calves'] },
  { label: 'Glúteo', muscles: ['glutes'] },
  { label: 'Core', muscles: ['abs'] },
]

/** Filter the catalog by text (name or alias, accent-insensitive) and muscle group. */
export function filterExercises(
  all: readonly Exercise[],
  q: string,
  group: number | null,
  suggestFor?: Exercise,
): Exercise[] {
  const nq = normalize(q)
  const muscles = group === null ? null : new Set(MUSCLE_GROUPS[group]!.muscles)
  const main = suggestFor?.primary[0]
  return all
    .filter((e) => e.id !== suggestFor?.id)
    .filter((e) => !muscles || e.primary.some((m) => muscles.has(m)))
    .filter(
      (e) =>
        !nq || normalize(e.name).includes(nq) || e.aliases?.some((a) => normalize(a).includes(nq)),
    )
    .sort((a, b) => {
      if (main) {
        const am = a.primary.includes(main) ? 0 : 1
        const bm = b.primary.includes(main) ? 0 : 1
        if (am !== bm) return am - bm
      }
      return a.name.localeCompare(b.name, 'es')
    })
}

/** Search field plus muscle chips, shared by the picker and the library. */
export function ExerciseFilters({
  q,
  onQ,
  group,
  onGroup,
}: {
  q: string
  onQ: (v: string) => void
  group: number | null
  onGroup: (g: number | null) => void
}) {
  return (
    <>
      <label className="flex h-12 items-center gap-2 rounded-[8px] border border-line bg-panel-2 px-3">
        <Search className="size-4 text-muted" />
        <input
          value={q}
          onChange={(e) => onQ(e.target.value)}
          placeholder="Buscar: press, remo, prensa…"
          className="h-full min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-muted"
        />
      </label>
      <div className="hide-scrollbar -mx-5 mt-1 flex gap-1.5 overflow-x-auto px-5">
        {MUSCLE_GROUPS.map((g, i) => (
          <Chip key={g.label} active={group === i} onClick={() => onGroup(group === i ? null : i)}>
            {g.label}
          </Chip>
        ))}
      </div>
    </>
  )
}

export function ExerciseLine({ exercise }: { exercise: Exercise }) {
  return (
    <span className="min-w-0">
      <span className="block text-[15px] font-medium">{exercise.name}</span>
      <span className="block text-[12.5px] text-muted">
        {exercise.primary.map((m) => MUSCLE_LABEL[m]).join(' · ')}
        {exercise.primary.length ? ' · ' : ''}
        {EQUIPMENT_LABEL[exercise.equipment]}
      </span>
    </span>
  )
}

/** Pick an exercise: search, filter by muscle group, tap. */
export function ExercisePicker({
  open,
  onClose,
  onPick,
  title = 'Elegir ejercicio',
  suggestFor,
}: {
  open: boolean
  onClose: () => void
  onPick: (e: Exercise) => void
  title?: string
  /** When swapping: exercises for the same main muscle come first. */
  suggestFor?: Exercise
}) {
  const all = useAllExercises()
  const [q, setQ] = useState('')
  const [group, setGroup] = useState<number | null>(null)
  const list = useMemo(
    () => filterExercises(all, q, group, suggestFor).slice(0, 80),
    [all, q, group, suggestFor],
  )

  return (
    <Sheet open={open} onClose={onClose} title={title} tall>
      <div className="sticky top-0 z-10 -mx-5 bg-panel px-5 pb-2">
        <ExerciseFilters q={q} onQ={setQ} group={group} onGroup={setGroup} />
      </div>
      <ul className="divide-y divide-line">
        {list.map((e) => (
          <li key={e.id}>
            <button
              type="button"
              onClick={() => {
                onPick(e)
                onClose()
              }}
              className="flex w-full items-center justify-between gap-3 py-3 text-left active:bg-panel-2"
            >
              <ExerciseLine exercise={e} />
              {e.videos.length > 0 && <span className="spec shrink-0 text-gold">Vídeo</span>}
            </button>
          </li>
        ))}
        {!list.length && (
          <li className="py-10 text-center text-[14px] text-muted">Sin resultados</li>
        )}
      </ul>
    </Sheet>
  )
}
