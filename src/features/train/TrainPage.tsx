import { BookOpen, ChevronRight, Dumbbell, Trophy } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Badge, SectionTitle, Skeleton } from '@/components/ui/primitives'
import { useActiveProgram, useScans, useSets, useWorkouts } from '@/data/hooks'
import type { Program, WorkoutFull } from '@/data/rows'
import { tonnage } from '@/domain/training'
import type { Exercise } from '@/domain/types'
import { useExerciseLookup } from '@/features/exercise/lookup'
import { dayForDate, mesoWeek, useStartWorkout } from '@/features/session/useStartWorkout'
import { doneDayIdsThisWeek } from '@/features/today/today'
import { useNow } from '@/lib/useNow'
import { dayKeyOf, lastSameDay } from './dayMatch'
import {
  estimateMinutes,
  formatInt,
  formatShortDate,
  groupByMonth,
  recordsBySet,
  setsByWorkout,
  workoutMinutes,
} from './history'

/** How many finished sessions the history shows before "Ver más". */
const PAGE = 30

export function TrainPage() {
  const nav = useNavigate()
  const { program, isPending } = useActiveProgram()
  const start = useStartWorkout()

  return (
    <>
      <PageHeader large title="Entrenar" />
      {isPending ? (
        <Skeleton className="mb-5 h-48 w-full" />
      ) : program ? (
        <ProgramDays program={program} />
      ) : (
        <section className="card mb-5 p-4">
          <span className="spec">Programa</span>
          <h2 className="mt-1 font-display text-[24px] font-semibold uppercase tracking-[0.04em]">
            Sin programa activo
          </h2>
          <p className="mt-1 text-[14px] text-ink-2">
            Elige uno de las plantillas o crea el tuyo: el plan decide series, reps y pesos cada
            día.
          </p>
          <Button block size="lg" className="mt-4" onClick={() => nav('/programs')}>
            Elegir programa
          </Button>
        </section>
      )}

      <div className="mb-6 grid grid-cols-2 gap-2">
        <Button
          variant="secondary"
          leading={<Dumbbell className="size-4" />}
          onClick={() => void start({ name: 'Entreno libre' })}
        >
          Entreno libre
        </Button>
        <Button
          variant="secondary"
          leading={<BookOpen className="size-4" />}
          onClick={() => nav('/library')}
        >
          Ejercicios
        </Button>
      </div>

      <History />
    </>
  )
}

/* ───────────── Program ───────────── */

function ProgramDays({ program }: { program: Program }) {
  const workouts = useWorkouts().data
  const start = useStartWorkout()
  const now = useNow()
  const meso = mesoWeek(program, now)
  // The day Hoy proposes, marked here too so both screens agree.
  const nextId = useMemo(
    () =>
      workouts ? dayForDate(program, doneDayIdsThisWeek(workouts, program, now), now)?.id : null,
    [workouts, program, now],
  )
  // By day id, or by exercises when the day was re-created or the program changed.
  const lastByDay = useMemo(() => {
    const out = new Map<string, WorkoutFull>()
    if (!workouts?.length) return out
    const ids = program.days.map((d) => d.id)
    for (const d of program.days) {
      const otherDayIds = new Set(ids.filter((id) => id !== d.id))
      const last = lastSameDay(dayKeyOf(d), workouts, { otherDayIds })
      if (last) out.set(d.id, last)
    }
    return out
  }, [workouts, program.days])

  return (
    <section className="mb-5">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="spec text-gold">
            Programa activo ·{' '}
            {meso.deload ? 'Semana de descarga' : `Semana ${meso.week} de ${program.mesoWeeks}`}
          </span>
          <h2 className="mt-0.5 break-words font-display text-[24px] font-semibold uppercase leading-tight tracking-[0.04em]">
            {program.name}
          </h2>
        </div>
      </div>
      <div className="mb-2 flex flex-wrap gap-x-5">
        <Link
          to={`/programs/${program.id}`}
          className="spec tap-link flex min-h-11 items-center text-gold"
        >
          Editar programa
        </Link>
        <Link to="/programs" className="spec tap-link flex min-h-11 items-center text-muted">
          Cambiar programa
        </Link>
      </div>
      {program.days.length ? (
        <ul className="divide-y divide-line border-y border-line">
          {program.days.map((d) => {
            const last = lastByDay.get(d.id)
            return (
              <li key={d.id} className="flex min-h-[64px] items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="break-words font-display text-[18px] font-semibold uppercase leading-tight tracking-[0.04em]">
                      {d.name}
                    </span>
                    {d.id === nextId && <Badge tone="brand">Toca</Badge>}
                  </div>
                  <div className="text-[12.5px] text-muted">
                    {d.focus ? `${d.focus} · ` : ''}
                    {d.slots.length} ejercicios · ≈ {estimateMinutes(d.slots)} min
                  </div>
                  <div className="text-[12px] text-muted">
                    {last ? `Último: ${formatShortDate(last.startedAt)}` : 'Sin hacer todavía'}
                  </div>
                </div>
                <Button
                  variant={d.id === nextId ? 'primary' : 'soft'}
                  size="sm"
                  disabled={!d.slots.length}
                  aria-label={`Empezar ${d.name}`}
                  onClick={() => void start({ program, day: d })}
                >
                  Empezar
                </Button>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-[13.5px] text-muted">
          Este programa no tiene días. Añádelos en el editor.
        </p>
      )}
    </section>
  )
}

/* ───────────── History ───────────── */

function History() {
  const workoutsQ = useWorkouts()
  const sets = useSets().data
  const fallbackBw = useScans().data?.at(-1)?.peso ?? null
  const lookup = useExerciseLookup()
  const [limit, setLimit] = useState(PAGE)

  const finished = useMemo(
    () =>
      (workoutsQ.data ?? [])
        .filter((w) => w.endedAt)
        .toSorted((a, b) => b.startedAt.localeCompare(a.startedAt)),
    [workoutsQ.data],
  )
  const stats = useMemo(() => {
    const all = sets ?? []
    const byWorkout = setsByWorkout(all)
    const prs = recordsBySet(all)
    const exercisesById: Record<string, Exercise> = {}
    for (const s of all)
      if (!exercisesById[s.exerciseId]) exercisesById[s.exerciseId] = lookup(s.exerciseId)
    const out = new Map<string, { sets: number; tonnage: number; prs: number }>()
    for (const w of finished) {
      const list = byWorkout.get(w.id) ?? []
      out.set(w.id, {
        sets: list.filter((s) => s.kind !== 'warmup').length,
        tonnage: tonnage(list, { exercisesById, bodyweight: w.bodyweight ?? fallbackBw }),
        prs: list.reduce((t, s) => t + (prs.get(s.id)?.length ? 1 : 0), 0),
      })
    }
    return out
  }, [sets, finished, lookup, fallbackBw])
  const groups = useMemo(() => groupByMonth(finished.slice(0, limit)), [finished, limit])

  return (
    <section>
      <SectionTitle>Historial</SectionTitle>
      {workoutsQ.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : !finished.length ? (
        <p className="px-1 text-[13.5px] text-muted">
          Aún no hay sesiones terminadas. La primera que acabes aparecerá aquí con su tonelaje y sus
          récords.
        </p>
      ) : (
        <>
          {groups.map((g) => (
            <div key={g.key} className="mb-4">
              <h3 className="spec px-1 pb-1 text-muted">{g.label}</h3>
              <ul className="divide-y divide-line">
                {g.items.map((w) => {
                  const st = stats.get(w.id)
                  const min = workoutMinutes(w)
                  return (
                    <li key={w.id}>
                      <Link
                        to={`/workout/${w.id}`}
                        className="flex min-h-[56px] items-center gap-3 py-2"
                      >
                        <span className="w-[54px] shrink-0 text-[12.5px] leading-tight text-muted">
                          {formatShortDate(w.startedAt)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block break-words text-[14.5px] font-medium">
                            {w.name}
                          </span>
                          <span className="block text-[12.5px] text-muted">
                            {[
                              min != null ? `${min} min` : null,
                              st ? `${st.sets} series` : null,
                              st && st.tonnage ? `${formatInt(st.tonnage)} kg` : null,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        </span>
                        {st && st.prs > 0 && (
                          <Badge tone="brand" aria-label={`${st.prs} récords`}>
                            <Trophy className="size-3" aria-hidden /> {st.prs}
                          </Badge>
                        )}
                        <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
          {finished.length > limit && (
            <Button variant="ghost" block onClick={() => setLimit((l) => l + PAGE)}>
              Ver más sesiones
            </Button>
          )}
        </>
      )}
    </section>
  )
}
