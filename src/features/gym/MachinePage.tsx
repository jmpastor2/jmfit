import { Pencil, Play, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import { Kpi } from '@/components/kpi/Kpi'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { EmptyState, SectionTitle, Skeleton } from '@/components/ui/primitives'
import {
  useActiveWorkout,
  useMachines,
  useScans,
  useSets,
  queued,
  useTrainingActions,
  useWorkouts,
} from '@/data/hooks'
import type { WorkoutFull } from '@/data/rows'
import type { Exercise, LoggedSet } from '@/domain/types'
import { bestsByExercise, formatNumber, localDateKey } from '@/domain/training'
import { useExerciseLookup } from '@/features/exercise/lookup'
import { TechniqueBody } from '@/features/exercise/TechniqueSheet'
import { historyFor, newId, slotFor } from '@/features/session/model'
import { longDate } from '@/features/body/scans'
import { parseSettings } from './machine'
import { MachineSheet } from './MachineSheet'

/** A new session that starts with this machine's exercise. */
function machineWorkout(name: string, exercise: Exercise, bodyweight: number | null): WorkoutFull {
  return {
    id: newId(),
    name,
    programId: null,
    dayId: null,
    startedAt: new Date().toISOString(),
    endedAt: null,
    notes: null,
    sessionRpe: null,
    bodyweight,
    deload: false,
    plan: [slotFor(exercise)],
  }
}

/** Last finished session and bests of one exercise. */
function useExerciseStats(
  exerciseId: string,
  sets: LoggedSet[] | undefined,
  workouts: WorkoutFull[] | undefined,
) {
  return useMemo(() => {
    if (!exerciseId || !sets || !workouts) return { last: null, best: null }
    const history = historyFor(exerciseId, sets, workouts, null)
    const mine = sets.filter((s) => s.exerciseId === exerciseId)
    return { last: history[0] ?? null, best: bestsByExercise(mine)[exerciseId] ?? null }
  }, [exerciseId, sets, workouts])
}

const dayOf = (iso: string) => longDate(localDateKey(new Date(iso)))

/** What a machine's QR opens: settings in big type, last time, record, start or add. */
export function MachinePage() {
  const { machineId = '' } = useParams()
  const nav = useNavigate()
  const machines = useMachines()
  const machine = machines.data?.find((m) => m.id === machineId) ?? null
  const lookup = useExerciseLookup()
  const sets = useSets().data
  const workouts = useWorkouts().data
  const scans = useScans().data
  const active = useActiveWorkout()
  const { saveWorkout } = useTrainingActions()
  const { toast } = useToast()
  const [editing, setEditing] = useState(0)

  const exercise = machine ? lookup(machine.exerciseId) : null
  const exId = machine?.exerciseId ?? ''

  const { last, best } = useExerciseStats(exId, sets, workouts)

  if (machines.isPending) {
    return (
      <>
        <PageHeader back="/gym" title="Máquina" />
        <Skeleton className="h-40 rounded-[10px]" />
      </>
    )
  }
  if (!machine || !exercise) {
    return (
      <>
        <PageHeader back="/gym" title="Máquina" />
        <EmptyState
          title="Esta máquina no está en tu gimnasio"
          description="Puede que la borraras o que el QR sea de otra cuenta."
          action={
            <Link to="/gym" className="spec text-gold">
              Ver mi gimnasio
            </Link>
          }
        />
      </>
    )
  }

  const settings = parseSettings(machine.seatSetting)
  const inSession = active?.plan.some((s) => s.exerciseId === exercise.id) ?? false

  const addToSession = async () => {
    if (!active) return
    if (!inSession) {
      queued(saveWorkout({ ...active, plan: [...active.plan, slotFor(exercise)] }))
      toast(`${exercise.name} añadido a la sesión`, 'success')
    }
    nav('/session')
  }

  const start = async () => {
    const bodyweight =
      workouts?.find((x) => x.bodyweight)?.bodyweight ?? scans?.at(-1)?.peso ?? null
    const w = machineWorkout(machine.label, exercise, bodyweight)
    nav('/session')
    await saveWorkout(w)
  }

  const work = last?.sets.filter((s) => s.weight !== null || s.reps !== null) ?? []

  return (
    <>
      <PageHeader
        back
        title={machine.label}
        subtitle={[machine.brand, exercise.name].filter(Boolean).join(' · ')}
        action={
          <button
            type="button"
            aria-label="Editar máquina"
            onClick={() => setEditing(Date.now())}
            className="grid size-11 place-items-center rounded-full bg-panel-2 text-ink"
          >
            <Pencil className="size-4" />
          </button>
        }
      />

      <section className="card p-4">
        <span className="spec text-gold">Tus ajustes</span>
        {settings.length ? (
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-4">
            {settings.map((s, i) => (
              <div key={i} className={s.name ? '' : 'col-span-2'}>
                {s.name && <dt className="spec">{s.name}</dt>}
                <dd
                  className={
                    s.name
                      ? 'readout mt-0.5 text-[40px] font-semibold leading-none'
                      : 'text-[15px] text-ink-2'
                  }
                >
                  {s.value}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-2 text-[14px] text-muted">
            Sin ajustes guardados. Apunta asiento y respaldo la próxima vez que la uses.
          </p>
        )}
        {machine.notes && <p className="mt-4 text-[13.5px] text-ink-2">{machine.notes}</p>}
      </section>

      <div className="mt-4">
        {active ? (
          <Button block size="lg" leading={<Plus className="size-5" />} onClick={addToSession}>
            {inSession ? 'Ir a la sesión' : 'Añadir a la sesión'}
          </Button>
        ) : (
          <Button block size="lg" leading={<Play className="size-5" />} onClick={start}>
            Empezar con esta máquina
          </Button>
        )}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 border-y border-line py-4">
        <Kpi
          label="Récord"
          size="sm"
          tone={best?.e1rm ? 'signal' : 'muted'}
          value={best?.maxWeight ? formatNumber(best.maxWeight.value) : '—'}
          unit={best?.maxWeight ? 'kg' : undefined}
          caption={
            best?.maxWeight
              ? `${best.maxWeight.reps} reps · ${dayOf(best.maxWeight.date)}`
              : 'Aún sin series'
          }
        />
        {/* Machines and cables: the load depends on the machine, so the best set, not a 1RM. */}
        <Kpi
          label="Mejor serie"
          size="sm"
          value={best?.bestSetVolume ? formatNumber(best.bestSetVolume.weight) : '—'}
          unit={best?.bestSetVolume ? 'kg' : undefined}
          caption={
            best?.bestSetVolume
              ? `× ${best.bestSetVolume.reps} reps · ${dayOf(best.bestSetVolume.date)}`
              : undefined
          }
        />
      </div>

      <section className="mt-2">
        <SectionTitle>La última vez</SectionTitle>
        {last && work.length ? (
          <>
            <p className="mb-2 text-[13px] text-muted">{dayOf(last.date)}</p>
            <ul className="divide-y divide-line border-y border-line">
              {work.map((s, i) => (
                <li key={s.id} className="flex min-h-[48px] items-center gap-3">
                  <span className="spec w-6">{i + 1}</span>
                  <span className="readout flex-1 text-[22px] font-semibold">
                    {s.weight !== null ? formatNumber(s.weight) : '—'}
                    <span className="ml-1 font-sans text-[12px] text-muted">kg</span>
                    <span className="mx-2 text-muted">×</span>
                    {s.reps ?? '—'}
                  </span>
                  {s.rir !== null && (
                    <span className="text-[12.5px] text-muted">RIR {formatNumber(s.rir)}</span>
                  )}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-[14px] text-muted">Todavía no has registrado este ejercicio.</p>
        )}
      </section>

      <section className="mt-6">
        <SectionTitle
          action={
            <Link to={`/exercise/${exercise.id}`} className="spec text-gold">
              Historial
            </Link>
          }
        >
          Técnica
        </SectionTitle>
        <TechniqueBody exercise={exercise} />
      </section>

      {editing > 0 && (
        <MachineSheet key={editing} open machine={machine} onClose={() => setEditing(0)} />
      )}
    </>
  )
}
