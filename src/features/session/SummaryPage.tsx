import { Trophy } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Delta, Kpi } from '@/components/kpi/Kpi'
import { Meter } from '@/components/kpi/Meter'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { EmptyState, Skeleton } from '@/components/ui/primitives'
import { MUSCLE_LABEL } from '@/content/exercises'
import { useScans, useSets, useWorkouts } from '@/data/hooks'
import type { WorkoutFull } from '@/data/rows'
import { formatNumber } from '@/domain/training'
import type { Exercise } from '@/domain/types'
import { useExerciseLookup } from '@/features/exercise/lookup'
import {
  PR_LABEL,
  formatInt,
  formatLongDate,
  formatShortDate,
  prValue,
  signed,
} from '@/features/train/history'
import { useNow } from '@/lib/useNow'
import { ProgramSwapsSection } from './ProgramSwaps'
import {
  changeOf,
  previousSameDay,
  sessionMuscleSets,
  sessionRecords,
  sessionTotals,
  type SessionTotals,
} from './summary'

export function SummaryPage() {
  const { workoutId } = useParams()
  const workoutsQ = useWorkouts()
  const workout = workoutsQ.data?.find((w) => w.id === workoutId) ?? null
  if (workoutsQ.isPending) return <Skeleton className="mt-16 h-80 w-full" />
  if (!workout) {
    return (
      <>
        <PageHeader title="Resumen" back="/" />
        <EmptyState
          title="No encuentro esta sesión"
          description="Puede que se descartara o se borrara."
          action={
            <Link to="/" className="spec tap-link text-gold">
              Volver a hoy
            </Link>
          }
        />
      </>
    )
  }
  return <Summary workout={workout} workouts={workoutsQ.data ?? []} />
}

function Summary({ workout, workouts }: { workout: WorkoutFull; workouts: WorkoutFull[] }) {
  const nav = useNavigate()
  const now = useNow()
  const allSets = useSets().data
  const scans = useScans().data
  const lookup = useExerciseLookup()

  const data = useMemo(() => {
    const all = allSets ?? []
    const mine = all.filter((s) => s.workoutId === workout.id)
    const exercisesById: Record<string, Exercise> = {}
    for (const s of mine) exercisesById[s.exerciseId] ??= lookup(s.exerciseId)
    const bodyweight = workout.bodyweight ?? scans?.at(-1)?.peso ?? null
    const prev = previousSameDay(workout, workouts)
    const prevSets = prev ? all.filter((s) => s.workoutId === prev.id) : []
    return {
      totals: sessionTotals(mine, { exercisesById, bodyweight }),
      prev,
      prevTotals: prev
        ? sessionTotals(prevSets, {
            exercisesById: Object.fromEntries(
              prevSets.map((s) => [s.exerciseId, lookup(s.exerciseId)]),
            ),
            bodyweight: prev.bodyweight ?? bodyweight,
          })
        : null,
      records: sessionRecords(mine, all),
      muscles: sessionMuscleSets(mine, lookup),
    }
  }, [allSets, scans, workout, workouts, lookup])

  // While the session is being closed the end time may not be in the cache yet.
  const end = workout.endedAt ? new Date(workout.endedAt) : now
  const minutes = Math.max(
    0,
    Math.round((end.getTime() - new Date(workout.startedAt).getTime()) / 60_000),
  )
  const maxMuscle = data.muscles[0]?.sets ?? 0

  return (
    <>
      <PageHeader
        eyebrow={<span className="text-gold">Sesión terminada</span>}
        title={workout.name}
        subtitle={formatLongDate(new Date(workout.startedAt))}
      />

      <section className="grid grid-cols-2 gap-x-4 gap-y-5 pb-6">
        <Kpi label="Duración" value={minutes} unit="min" size="lg" />
        <Kpi label="Series" value={data.totals.sets} size="lg" />
        <Kpi label="Repeticiones" value={data.totals.reps} size="lg" />
        <Kpi label="Tonelaje" value={formatInt(data.totals.tonnage)} unit="kg" size="lg" />
      </section>

      <section className="border-t border-line py-5">
        <h2 className="spec mb-3 text-ink-2">Frente a la última vez</h2>
        {data.prev && data.prevTotals ? (
          <>
            <p className="mb-3 text-[13px] text-muted">
              {data.prev.name} del {formatShortDate(data.prev.startedAt, now)}
            </p>
            <div className="grid grid-cols-3 gap-3">
              <Compare
                label="Series"
                cur={data.totals}
                prev={data.prevTotals}
                pick={(t) => t.sets}
                fmt={String}
              />
              <Compare
                label="Reps"
                cur={data.totals}
                prev={data.prevTotals}
                pick={(t) => t.reps}
                fmt={String}
              />
              <Compare
                label="Tonelaje"
                cur={data.totals}
                prev={data.prevTotals}
                pick={(t) => t.tonnage}
                fmt={formatInt}
                unit="kg"
              />
            </div>
          </>
        ) : (
          <p className="text-[13.5px] text-muted">
            Primera vez con esta sesión: hoy queda como tu referencia para la próxima.
          </p>
        )}
      </section>

      <section className="border-t border-line py-5">
        <h2 className="spec mb-3 text-ink-2">Récords batidos</h2>
        {data.records.length ? (
          <ul className="divide-y divide-line">
            {data.records.map((pr) => (
              <li
                key={`${pr.exerciseId}-${pr.kind}`}
                className="flex min-h-[52px] items-center gap-3 py-2"
              >
                <Trophy className="size-4 shrink-0 text-gold" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-[14.5px] font-medium">
                    {lookup(pr.exerciseId).name}
                  </span>
                  <span className="block text-[12.5px] text-muted">
                    {PR_LABEL[pr.kind]}
                    {pr.previous != null
                      ? ` · antes ${pr.kind === 'reps' ? `${pr.previous} reps` : `${formatNumber(pr.previous)} kg`}`
                      : ''}
                  </span>
                </span>
                <span className="readout shrink-0 text-[18px] font-semibold text-gold">
                  {prValue(pr, (n) => formatNumber(n))}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13.5px] text-muted">
            Hoy no ha caído ningún récord. Las sesiones sólidas son las que los preparan.
          </p>
        )}
      </section>

      {data.muscles.length > 0 && (
        <section className="border-t border-line py-5">
          <h2 className="spec mb-1 text-ink-2">Series efectivas por músculo</h2>
          <p className="mb-3 text-[12px] text-muted">
            Principal 1 serie, secundario media. Sin calentamientos ni series con RIR 5 o más.
          </p>
          <ul className="flex flex-col gap-3">
            {data.muscles.map((m) => (
              <li key={m.muscle}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[14px]">{MUSCLE_LABEL[m.muscle]}</span>
                  <span className="readout text-[17px] font-semibold">
                    {formatNumber(m.sets, 1)}
                  </span>
                </div>
                <Meter value={m.sets} max={maxMuscle} className="mt-1.5" height={4} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <ProgramSwapsSection workout={workout} lookup={lookup} />

      <div className="border-t border-line pt-5">
        <Button block size="lg" onClick={() => nav('/', { replace: true })}>
          Listo
        </Button>
        <Link
          to={`/workout/${workout.id}`}
          className="spec tap-link mx-auto mt-2 flex min-h-11 items-center justify-center text-muted"
        >
          Ver o corregir series
        </Link>
      </div>
    </>
  )
}

function Compare({
  label,
  cur,
  prev,
  pick,
  fmt,
  unit,
}: {
  label: string
  cur: SessionTotals
  prev: SessionTotals
  pick: (t: SessionTotals) => number
  fmt: (n: number) => string
  unit?: string
}) {
  const c = changeOf(pick(cur), pick(prev))
  return (
    <Kpi
      size="sm"
      label={label}
      value={fmt(pick(prev))}
      unit={unit}
      caption={
        <>
          Hoy <Delta text={signed(c.diff, fmt)} direction={c.direction} tone={c.tone} />
        </>
      }
    />
  )
}
