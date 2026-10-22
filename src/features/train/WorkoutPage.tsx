import { clsx } from 'clsx'
import { Repeat, Trash2, Trophy } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Kpi } from '@/components/kpi/Kpi'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { Sheet } from '@/components/ui/Sheet'
import { useToast } from '@/components/ui/Toast'
import { EmptyState, Skeleton } from '@/components/ui/primitives'
import {
  useActiveWorkout,
  usePrograms,
  useScans,
  useSets,
  queued,
  useTrainingActions,
  useWorkouts,
} from '@/data/hooks'
import type { WorkoutFull } from '@/data/rows'
import { formatNumber, tonnage } from '@/domain/training'
import type { Exercise, LoggedSet, PersonalRecord, Slot } from '@/domain/types'
import { useExerciseLookup } from '@/features/exercise/lookup'
import { newId, slotFor } from '@/features/session/model'
import { mesoWeek } from '@/features/session/useStartWorkout'
import {
  PR_LABEL,
  formatInt,
  formatLongDate,
  prValue,
  recordsBySet,
  workoutMinutes,
} from './history'

const kg = (n: number | null) => (n == null ? '—' : formatNumber(n))

export function WorkoutPage() {
  const { workoutId } = useParams()
  const workoutsQ = useWorkouts()
  const workout = workoutsQ.data?.find((w) => w.id === workoutId) ?? null

  if (workoutsQ.isPending) {
    return (
      <>
        <PageHeader back="/train" title="Sesión" />
        <Skeleton className="h-60 w-full" />
      </>
    )
  }
  if (!workout) {
    return (
      <>
        <PageHeader back="/train" title="Sesión" />
        <EmptyState
          title="Esta sesión ya no existe"
          description="Puede que la borraras desde otro dispositivo."
          action={
            <Link to="/train" className="spec tap-link text-gold">
              Volver al historial
            </Link>
          }
        />
      </>
    )
  }
  return <WorkoutDetail workout={workout} />
}

interface ExerciseGroup {
  index: number
  exercise: Exercise
  sets: LoggedSet[]
}

function WorkoutDetail({ workout }: { workout: WorkoutFull }) {
  const nav = useNavigate()
  const { toast } = useToast()
  const allSets = useSets().data
  const scans = useScans().data
  const programs = usePrograms().data
  const active = useActiveWorkout()
  const lookup = useExerciseLookup()
  const { saveWorkout, deleteWorkout, saveSets, deleteSets } = useTrainingActions()
  const [editing, setEditing] = useState<LoggedSet | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const mine = useMemo(
    () => (allSets ?? []).filter((s) => s.workoutId === workout.id),
    [allSets, workout.id],
  )
  const prs = useMemo(() => recordsBySet(allSets ?? []), [allSets])
  const groups = useMemo(() => {
    const map = new Map<number, LoggedSet[]>()
    for (const s of mine) map.set(s.exerciseIndex, [...(map.get(s.exerciseIndex) ?? []), s])
    return [...map.entries()]
      .toSorted(([a], [b]) => a - b)
      .map(([index, list]): ExerciseGroup => {
        const sorted = list.toSorted((a, b) => a.setIndex - b.setIndex)
        return { index, exercise: lookup(sorted[0]!.exerciseId), sets: sorted }
      })
  }, [mine, lookup])

  const work = mine.filter((s) => s.kind !== 'warmup')
  const exercisesById = useMemo(() => {
    const out: Record<string, Exercise> = {}
    for (const g of groups) out[g.exercise.id] = g.exercise
    return out
  }, [groups])
  const ton = tonnage(mine, {
    exercisesById,
    bodyweight: workout.bodyweight ?? scans?.at(-1)?.peso ?? null,
  })
  const min = workoutMinutes(workout)
  const started = new Date(workout.startedAt)

  const repeat = async () => {
    if (active) {
      toast('Ya tienes una sesión en curso')
      nav('/session')
      return
    }
    // Imported sessions have no plan: rebuild one from what was done.
    const plan: Slot[] = workout.plan.length
      ? workout.plan.map((s) => ({ ...s, id: newId() }))
      : groups.map((g) =>
          slotFor(g.exercise, {
            sets: Math.max(1, g.sets.filter((s) => s.kind !== 'warmup').length),
          }),
        )
    const program = programs?.find((p) => p.id === workout.programId) ?? null
    const w: WorkoutFull = {
      id: newId(),
      name: workout.name,
      programId: workout.programId,
      dayId: workout.dayId,
      startedAt: new Date().toISOString(),
      endedAt: null,
      notes: null,
      sessionRpe: null,
      bodyweight: workout.bodyweight ?? scans?.at(-1)?.peso ?? null,
      deload: program ? mesoWeek(program).deload : false,
      plan,
    }
    nav('/session')
    await saveWorkout(w)
  }

  const remove = async () => {
    setConfirmDelete(false)
    nav('/train', { replace: true })
    await deleteWorkout(workout.id)
    toast('Sesión borrada')
  }

  return (
    <>
      <PageHeader
        back="/train"
        title={workout.name}
        subtitle={`${formatLongDate(started)} · ${started.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`}
      />

      <section className="grid grid-cols-3 gap-x-3 gap-y-4 pb-5">
        <Kpi size="sm" label="Duración" value={min ?? '—'} unit={min != null ? 'min' : undefined} />
        <Kpi size="sm" label="Series" value={work.length} />
        <Kpi size="sm" label="Tonelaje" value={formatInt(ton)} unit="kg" />
        <Kpi
          size="sm"
          label="RPE"
          value={workout.sessionRpe ?? '—'}
          unit={workout.sessionRpe != null ? '/ 10' : undefined}
        />
        <Kpi
          size="sm"
          label="Peso corporal"
          value={workout.bodyweight != null ? formatNumber(workout.bodyweight, 1) : '—'}
          unit={workout.bodyweight != null ? 'kg' : undefined}
        />
      </section>
      {workout.notes && (
        <p className="mb-5 whitespace-pre-line border-l-2 border-line-strong pl-3 text-[14px] text-ink-2">
          {workout.notes}
        </p>
      )}

      {groups.length ? (
        <ol className="flex flex-col">
          {groups.map((g) => (
            <li key={g.index} className="border-t border-line py-4">
              <Link
                to={`/exercise/${g.exercise.id}`}
                className="block break-words font-display text-[19px] font-semibold uppercase leading-tight tracking-[0.04em]"
              >
                {g.exercise.name}
              </Link>
              <ul className="mt-2">
                {g.sets.map((s, i) => (
                  <SetRow
                    key={s.id}
                    set={s}
                    label={setLabel(g.sets, i)}
                    prs={prs.get(s.id) ?? []}
                    onEdit={() => setEditing(s)}
                  />
                ))}
              </ul>
            </li>
          ))}
        </ol>
      ) : (
        <p className="border-t border-line py-6 text-[13.5px] text-muted">
          Esta sesión no tiene series registradas.
        </p>
      )}

      <div className="mt-4 flex flex-col gap-2 border-t border-line pt-5">
        <Button
          block
          size="lg"
          leading={<Repeat className="size-5" />}
          onClick={() => void repeat()}
          disabled={!groups.length && !workout.plan.length}
        >
          Repetir esta sesión
        </Button>
        <Button
          variant="ghost"
          block
          leading={<Trash2 className="size-4" />}
          onClick={() => setConfirmDelete(true)}
        >
          Borrar sesión
        </Button>
      </div>

      <EditSetSheet
        set={editing}
        onClose={() => setEditing(null)}
        onSave={async (s) => {
          setEditing(null)
          queued(saveSets([s]))
          toast('Serie actualizada')
        }}
        onDelete={async (s) => {
          setEditing(null)
          queued(deleteSets([s.id]))
          toast('Serie borrada')
        }}
      />

      <Sheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="¿Borrar esta sesión?"
        description={`${workout.name} · ${work.length} series. No se puede deshacer.`}
        footer={
          <div className="flex flex-col gap-2 pb-1">
            <Button variant="danger" block size="lg" onClick={() => void remove()}>
              Borrar sesión
            </Button>
            <Button variant="ghost" block onClick={() => setConfirmDelete(false)}>
              Cancelar
            </Button>
          </div>
        }
      >
        <p className="text-[14px] text-ink-2">
          Se borran sus series y los récords que se batieron en ella.
        </p>
      </Sheet>
    </>
  )
}

function setLabel(sets: LoggedSet[], i: number): string {
  const s = sets[i]!
  if (s.kind === 'warmup')
    return `C${sets.slice(0, i + 1).filter((x) => x.kind === 'warmup').length}`
  return String(sets.slice(0, i + 1).filter((x) => x.kind !== 'warmup').length)
}

const KIND_TAG: Partial<Record<LoggedSet['kind'], string>> = { drop: 'Drop', failure: 'Fallo' }

function SetRow({
  set,
  label,
  prs,
  onEdit,
}: {
  set: LoggedSet
  label: string
  prs: PersonalRecord[]
  onEdit: () => void
}) {
  const warm = set.kind === 'warmup'
  const pr = prs[0]
  return (
    <li>
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Editar serie ${label}`}
        className={clsx(
          'flex min-h-12 w-full items-center gap-3 border-b border-line text-left last:border-0 active:bg-panel-2',
          warm && 'opacity-55',
        )}
      >
        <span className={clsx('readout w-7 text-[16px]', pr ? 'text-gold' : 'text-muted')}>
          {label}
        </span>
        <span className="readout flex-1 text-[19px] font-semibold">
          {kg(set.weight)}
          <span className="ml-1 font-sans text-[12px] font-medium text-muted">kg</span>
          <span className="mx-2 text-muted">×</span>
          {set.reps ?? '—'}
          {KIND_TAG[set.kind] && (
            <span className="ml-2 font-sans text-[11.5px] font-medium text-muted">
              {KIND_TAG[set.kind]}
            </span>
          )}
        </span>
        {set.rir != null && (
          <span className="text-[12.5px] text-muted">RIR {formatNumber(set.rir)}</span>
        )}
        {pr && (
          <span
            className="flex items-center gap-1 text-[12px] font-semibold text-gold"
            title={prValue(pr, formatNumber)}
          >
            <Trophy className="size-3.5" aria-hidden />
            <span className="sr-only">Récord: </span>
            {PR_LABEL[pr.kind]}
          </span>
        )}
      </button>
    </li>
  )
}

const parse = (s: string): number | null => {
  const n = Number(s.replace(',', '.'))
  return s.trim() !== '' && Number.isFinite(n) ? n : null
}

function EditSetSheet(props: {
  set: LoggedSet | null
  onClose: () => void
  onSave: (s: LoggedSet) => Promise<void>
  onDelete: (s: LoggedSet) => Promise<void>
}) {
  // A fresh form for every set opened.
  return <EditSetForm key={props.set?.id ?? 'none'} {...props} />
}

function EditSetForm({
  set,
  onClose,
  onSave,
  onDelete,
}: {
  set: LoggedSet | null
  onClose: () => void
  onSave: (s: LoggedSet) => Promise<void>
  onDelete: (s: LoggedSet) => Promise<void>
}) {
  const [weight, setWeight] = useState(set?.weight == null ? '' : formatNumber(set.weight))
  const [reps, setReps] = useState(set?.reps == null ? '' : String(set.reps))
  const [rir, setRir] = useState(set?.rir == null ? '' : formatNumber(set.rir))
  const w = parse(weight)
  const r = parse(reps)
  const ri = parse(rir)
  const warm = set?.kind === 'warmup'
  const invalid =
    (w != null && w < 0) ||
    (r != null && (r < 0 || !Number.isInteger(r))) ||
    (ri != null && (ri < 0 || ri > 10))
  return (
    <Sheet
      open={set !== null}
      onClose={onClose}
      title="Editar serie"
      description={warm ? 'Serie de calentamiento' : undefined}
      footer={
        <div className="flex flex-col gap-2 pb-1">
          <Button
            block
            size="lg"
            disabled={invalid || r == null}
            onClick={() =>
              set && void onSave({ ...set, weight: w, reps: r, rir: warm ? null : ri })
            }
          >
            Guardar
          </Button>
          <Button
            variant="ghost"
            block
            leading={<Trash2 className="size-4" />}
            onClick={() => set && void onDelete(set)}
          >
            Borrar serie
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-3 gap-3 pb-2">
        <Field label="Kg">
          {(id) => (
            <Input
              id={id}
              inputMode="decimal"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
            />
          )}
        </Field>
        <Field label="Reps">
          {(id) => (
            <Input
              id={id}
              inputMode="numeric"
              value={reps}
              onChange={(e) => setReps(e.target.value)}
            />
          )}
        </Field>
        <Field label="RIR">
          {(id) => (
            <Input
              id={id}
              inputMode="decimal"
              value={rir}
              disabled={warm}
              onChange={(e) => setRir(e.target.value)}
            />
          )}
        </Field>
      </div>
      {invalid && (
        <p className="pb-2 text-[12.5px] text-danger">
          Revisa los valores: reps enteras y RIR entre 0 y 10.
        </p>
      )}
    </Sheet>
  )
}
