import { Play, Target } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { EQUIPMENT_LABEL, MUSCLE_LABEL } from '@/content/exercises'
import { LineChart, shortDate } from '@/components/charts/LineChart'
import { Kpi } from '@/components/kpi/Kpi'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { EmptyState, SectionTitle, Segmented, Skeleton } from '@/components/ui/primitives'
import {
  useActiveWorkout,
  useGoals,
  useScans,
  useSets,
  useTrainingActions,
  useWorkouts,
} from '@/data/hooks'
import type { WorkoutFull } from '@/data/rows'
import { bestsByExercise, formatNumber } from '@/domain/training'
import type { LoggedSet } from '@/domain/types'
import { newId, slotFor } from '@/features/session/model'
import { RepMaxTable } from '@/features/progress/RepMaxTable'
import { useExerciseLookup } from './lookup'
import { e1rmSeries, exerciseSessions } from './stats'
import { TechniqueBody } from './TechniqueSheet'

type View = 'technique' | 'history'

export function ExercisePage() {
  const { exerciseId = '' } = useParams()
  const lookup = useExerciseLookup()
  const exercise = lookup(exerciseId)
  const nav = useNavigate()
  const setsQ = useSets()
  const workoutsQ = useWorkouts()
  const scans = useScans().data
  const goals = useGoals().data
  const active = useActiveWorkout()
  const { saveWorkout } = useTrainingActions()
  const [busy, setBusy] = useState(false)

  const sets = setsQ.data
  const workouts = workoutsQ.data
  const mine = useMemo(
    () => (sets ?? []).filter((s) => s.exerciseId === exerciseId),
    [sets, exerciseId],
  )
  const sessions = useMemo(
    () => exerciseSessions(exerciseId, mine, workouts ?? []),
    [exerciseId, mine, workouts],
  )
  const series = useMemo(() => e1rmSeries(sessions), [sessions])
  const bests = useMemo(() => bestsByExercise(mine)[exerciseId] ?? null, [mine, exerciseId])
  const goal = goals?.find((g) => g.kind === 'e1rm' && g.exerciseId === exerciseId && !g.achievedAt)

  const [view, setView] = useState<View | null>(null)
  const shown: View = view ?? (sessions.length ? 'history' : 'technique')

  const muscles = [
    exercise.primary.map((m) => MUSCLE_LABEL[m]).join(' · '),
    exercise.secondary.length
      ? `también ${exercise.secondary.map((m) => MUSCLE_LABEL[m].toLowerCase()).join(', ')}`
      : '',
  ]
    .filter(Boolean)
    .join(' · ')

  const start = async () => {
    if (busy) return
    setBusy(true)
    try {
      if (active) {
        // A session in progress: the exercise joins it instead of opening a second one.
        if (!active.plan.some((s) => s.exerciseId === exercise.id)) {
          const p = saveWorkout({ ...active, plan: [...active.plan, slotFor(exercise)] })
          nav('/session')
          await p
        } else nav('/session')
        return
      }
      const w: WorkoutFull = {
        id: newId(),
        name: 'Entreno libre',
        programId: null,
        dayId: null,
        startedAt: new Date().toISOString(),
        endedAt: null,
        notes: null,
        sessionRpe: null,
        bodyweight: workouts?.find((x) => x.bodyweight)?.bodyweight ?? scans?.at(-1)?.peso ?? null,
        deload: false,
        plan: [slotFor(exercise)],
      }
      const p = saveWorkout(w)
      nav('/session')
      await p
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        back
        title={exercise.name}
        subtitle={`${muscles} · ${EQUIPMENT_LABEL[exercise.equipment]}`}
      />

      {exercise.trend && (
        <div className="-mt-1 mb-4 border-l border-gold-dark pl-3">
          <span className="spec block text-gold">Popularizado por {exercise.trend.by}</span>
          <p className="mt-0.5 text-[13px] leading-snug text-ink-2">{exercise.trend.why}</p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Button
          block
          leading={<Play className="size-4" />}
          onClick={() => void start()}
          loading={busy}
        >
          {active ? 'Añadir a la sesión' : 'Empezar con este ejercicio'}
        </Button>
        <Button
          block
          variant="secondary"
          leading={<Target className="size-4" />}
          onClick={() => nav(`/goals?new=e1rm&exercise=${encodeURIComponent(exercise.id)}`)}
        >
          Crear objetivo
        </Button>
      </div>

      <Segmented<View>
        className="mt-5"
        value={shown}
        onChange={setView}
        options={[
          { value: 'technique', label: 'Técnica' },
          { value: 'history', label: 'Historial' },
        ]}
      />

      <div className="mt-5">
        {shown === 'technique' ? (
          <TechniqueBody exercise={exercise} />
        ) : setsQ.isPending ? (
          <Skeleton className="h-48 w-full" />
        ) : !sessions.length ? (
          <EmptyState
            title="Aún no lo has hecho"
            description="Empieza una sesión con este ejercicio y aquí verás su evolución, tus récords y cada serie."
          />
        ) : (
          <div className="flex flex-col gap-6">
            <section>
              <SectionTitle>1RM estimado por sesión</SectionTitle>
              {series.length ? (
                <LineChart
                  points={series.map((p) => ({ x: p.date, y: p.value }))}
                  target={goal?.target}
                  unit="kg"
                  format={(n) => formatNumber(n, 1)}
                  label={`1RM estimado de ${exercise.name} en ${series.length} sesiones`}
                />
              ) : (
                <p className="text-[13.5px] text-muted">
                  Sin series válidas para estimar el 1RM (hace falta peso y entre 1 y 15
                  repeticiones).
                </p>
              )}
              <p className="mt-2 text-[12.5px] text-muted">
                Mejor serie de cada sesión (fórmula de Epley con las repeticiones en reserva).
                {goal && ` Línea discontinua: tu objetivo de ${formatNumber(goal.target)} kg.`}
              </p>
            </section>

            {bests && (
              <section>
                <SectionTitle>Récords</SectionTitle>
                <div className="grid grid-cols-2 gap-x-4 gap-y-5">
                  <Kpi
                    label="1RM estimado"
                    value={bests.e1rm ? formatNumber(bests.e1rm.value, 1) : '—'}
                    unit={bests.e1rm ? 'kg' : undefined}
                    caption={
                      bests.e1rm &&
                      `${formatNumber(bests.e1rm.weight)} × ${bests.e1rm.reps} · ${shortDate(bests.e1rm.date)}`
                    }
                    tone="signal"
                  />
                  <Kpi
                    label="Peso máximo"
                    value={bests.maxWeight ? formatNumber(bests.maxWeight.value) : '—'}
                    unit={bests.maxWeight ? 'kg' : undefined}
                    caption={
                      bests.maxWeight &&
                      `× ${bests.maxWeight.reps} · ${shortDate(bests.maxWeight.date)}`
                    }
                  />
                </div>
                <RepMaxTable repPRs={bests.repPRs} />
              </section>
            )}

            <section>
              <SectionTitle>Sesiones · {sessions.length}</SectionTitle>
              <ul className="divide-y divide-line">
                {sessions.map((s) => (
                  <li key={s.workoutId} className="py-3">
                    <Link
                      to={`/workout/${s.workoutId}`}
                      className="flex min-h-11 items-baseline justify-between gap-3"
                    >
                      <span className="min-w-0">
                        <span className="block text-[15px] font-medium">{shortDate(s.date)}</span>
                        {s.workoutName && (
                          <span className="block truncate text-[12.5px] text-muted">
                            {s.workoutName}
                          </span>
                        )}
                      </span>
                      {s.bestE1rm != null && (
                        <span className="readout shrink-0 text-[17px] font-semibold">
                          {formatNumber(s.bestE1rm, 1)}
                          <span className="ml-1 font-sans text-[11px] text-muted">kg 1RM</span>
                        </span>
                      )}
                    </Link>
                    <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                      {s.sets.map((x) => (
                        <li
                          key={x.id}
                          className={
                            x.kind === 'warmup'
                              ? 'readout text-[14px] text-muted'
                              : x.id === s.bestSet?.id
                                ? 'readout text-[14px] text-gold-light'
                                : 'readout text-[14px] text-ink-2'
                          }
                        >
                          {setText(x)}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[12px] text-muted">
                En gris, calentamiento. En dorado, la mejor serie de la sesión.
              </p>
            </section>
          </div>
        )}
      </div>
    </>
  )
}

function setText(s: LoggedSet): string {
  const w = s.weight != null ? `${formatNumber(s.weight)}` : '—'
  const r = s.reps != null ? `${s.reps}` : '—'
  const rir = s.rir != null && s.kind !== 'warmup' ? ` @${formatNumber(s.rir)}` : ''
  const tag = s.kind === 'drop' ? ' drop' : s.kind === 'failure' ? ' fallo' : ''
  return `${w}×${r}${rir}${tag}`
}
