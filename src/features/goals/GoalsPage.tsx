import { Archive, Plus } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { shortDate } from '@/components/charts/LineChart'
import { Meter } from '@/components/kpi/Meter'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Field'
import { Sheet } from '@/components/ui/Sheet'
import { useToast } from '@/components/ui/Toast'
import { EmptyState, SectionTitle, Skeleton } from '@/components/ui/primitives'
import { useGoalActions, useGoals, useMe, useScans, useSets, useWorkouts } from '@/data/hooks'
import { formatNumber, localDateKey } from '@/domain/training'
import type { Exercise, GoalKind, UserGoal } from '@/domain/types'
import { ExercisePicker } from '@/features/exercise/ExercisePicker'
import { useExerciseLookup } from '@/features/exercise/lookup'
import { mainLifts } from '@/features/exercise/stats'
import { newId } from '@/features/session/model'
import {
  GOAL_KIND_LABEL,
  formatGoalValue,
  goalCurrent,
  goalStatus,
  goalSuggestions,
  goalTitle,
  goalUnit,
  needsExercise,
  type GoalData,
  type GoalStatus,
} from './goalValues'

const KINDS: GoalKind[] = ['e1rm', 'lift', 'bodyweight', 'bodyfat', 'muscle', 'frequency']
const isKind = (v: string | null): v is GoalKind => KINDS.includes(v as GoalKind)

function useGoalData(): { data: GoalData; ready: boolean } {
  const sets = useSets()
  const workouts = useWorkouts()
  const scans = useScans()
  const data = useMemo(
    () => ({ sets: sets.data ?? [], workouts: workouts.data ?? [], scans: scans.data ?? [] }),
    [sets.data, workouts.data, scans.data],
  )
  return { data, ready: !sets.isPending && !workouts.isPending && !scans.isPending }
}

export function GoalsPage() {
  const goalsQ = useGoals()
  const { data, ready } = useGoalData()
  const { save, archive } = useGoalActions()
  const lookup = useExerciseLookup()
  const me = useMe()
  const { toast } = useToast()
  const [params, setParams] = useSearchParams()
  const [now] = useState(() => new Date())

  const goals = goalsQ.data
  const rows = useMemo(
    () => (goals ?? []).map((g) => ({ goal: g, status: goalStatus(g, data, now) })),
    [goals, data, now],
  )

  // Mark goals as achieved the first time the data reaches them.
  const marked = useRef(new Set<string>())
  useEffect(() => {
    if (!ready) return
    for (const { goal, status } of rows) {
      if (goal.achievedAt || !status.reached || marked.current.has(goal.id)) continue
      marked.current.add(goal.id)
      void save({ ...goal, achievedAt: localDateKey(now) })
      toast(
        `Objetivo logrado: ${goalTitle(goal, goal.exerciseId ? lookup(goal.exerciseId).name : null)}`,
        'success',
      )
    }
  }, [ready, rows, save, now, toast, lookup])

  const suggestions = useMemo(() => {
    if (!ready) return []
    const lifts = mainLifts(data.sets, lookup).map((l) => ({
      id: l.exercise.id,
      name: l.exercise.name,
      increment: l.exercise.increment,
    }))
    return goalSuggestions({
      ...data,
      now,
      lifts,
      existing: goals ?? [],
      weeklyTarget: me.weeklyTarget,
    })
  }, [ready, data, lookup, now, goals, me.weeklyTarget])

  const active = rows.filter((r) => !r.goal.achievedAt)
  const done = rows.filter((r) => r.goal.achievedAt)

  const newKind = params.get('new')
  const sheetOpen = newKind !== null
  const openSheet = () => setParams({ new: 'e1rm' })
  const closeSheet = () => setParams({}, { replace: true })

  const doArchive = async (g: UserGoal) => {
    try {
      await archive(g.id)
      toast('Objetivo archivado')
    } catch {
      toast('No se pudo archivar. Prueba con conexión.', 'error')
    }
  }

  return (
    <>
      <PageHeader
        back
        title="Objetivos"
        action={
          <Button
            size="sm"
            variant="secondary"
            leading={<Plus className="size-4" />}
            onClick={openSheet}
          >
            Nuevo
          </Button>
        }
      />

      {goalsQ.isPending || !ready ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <>
          {active.length === 0 ? (
            <EmptyState
              title="Sin objetivos activos"
              description="Ponte una meta con fecha: un 1RM, un peso, tu % de grasa o cuántos días entrenas. Forja calcula si llegas a tiempo."
              action={<Button onClick={openSheet}>Crear objetivo</Button>}
            />
          ) : (
            <ul className="divide-y divide-line">
              {active.map(({ goal, status }) => (
                <GoalRow
                  key={goal.id}
                  goal={goal}
                  status={status}
                  exerciseName={goal.exerciseId ? lookup(goal.exerciseId).name : null}
                  now={now}
                  onArchive={() => void doArchive(goal)}
                />
              ))}
            </ul>
          )}

          {suggestions.length > 0 && (
            <section className="mt-6">
              <SectionTitle>Sugerencias con tus datos</SectionTitle>
              <ul className="divide-y divide-line">
                {suggestions.map((s) => (
                  <li key={s.key}>
                    <button
                      type="button"
                      onClick={() => {
                        void save({ ...s.goal, id: newId() })
                        toast(`Objetivo creado: ${s.label}`, 'success')
                      }}
                      className="flex min-h-[52px] w-full items-center justify-between gap-3 py-2.5 text-left active:bg-panel-2"
                    >
                      <span className="min-w-0">
                        <span className="block text-[15px] font-medium">{s.label}</span>
                        <span className="block text-[12.5px] text-muted">
                          De {formatGoalValue(s.goal.kind, s.goal.start ?? 0)} a{' '}
                          {formatGoalValue(s.goal.kind, s.goal.target)}
                          {s.goal.deadline && ` · plazo ${shortDate(s.goal.deadline)}`}
                        </span>
                      </span>
                      <Plus className="size-5 shrink-0 text-gold" aria-label="Crear" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {done.length > 0 && (
            <section className="mt-6">
              <SectionTitle>Logrados</SectionTitle>
              <ul className="divide-y divide-line">
                {done.map(({ goal }) => (
                  <li
                    key={goal.id}
                    className="flex min-h-[52px] items-center justify-between gap-3 py-2"
                  >
                    <span className="min-w-0">
                      <span className="block text-[15px] font-medium">
                        {goalTitle(goal, goal.exerciseId ? lookup(goal.exerciseId).name : null)}
                      </span>
                      <span className="block text-[12.5px] text-gold">
                        Logrado el {shortDate(goal.achievedAt!)}
                      </span>
                    </span>
                    <ArchiveButton onClick={() => void doArchive(goal)} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {/* Mounted while open, so every opening starts from a fresh (or linked, prefilled) form. */}
      {sheetOpen && (
        <GoalSheet
          open
          onClose={closeSheet}
          initialKind={isKind(newKind) ? newKind : 'e1rm'}
          initialExercise={params.get('exercise')}
          initialTarget={params.get('target')}
          initialDeadline={params.get('deadline')}
          data={data}
          now={now}
          onCreate={async (g) => {
            closeSheet()
            await save(g)
          }}
        />
      )}
    </>
  )
}

function ArchiveButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Archivar objetivo"
      className="grid size-11 shrink-0 place-items-center rounded-full text-muted active:bg-panel-2"
    >
      <Archive className="size-[18px]" />
    </button>
  )
}

function GoalRow({
  goal,
  status,
  exerciseName,
  now,
  onArchive,
}: {
  goal: UserGoal
  status: GoalStatus
  exerciseName: string | null
  now: Date
  onArchive: () => void
}) {
  const unit = goalUnit(goal.kind)
  // Where the goal should be today to arrive on the deadline (time elapsed / total time).
  const pace = useMemo(() => {
    if (!goal.deadline) return undefined
    const s = new Date(goal.startDate + 'T00:00:00').getTime()
    const e = new Date(goal.deadline + 'T23:59:59').getTime()
    if (!(e > s)) return undefined
    return Math.min(1, Math.max(0, (now.getTime() - s) / (e - s)))
  }, [goal.deadline, goal.startDate, now])

  return (
    <li className="py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold leading-snug">
            {goalTitle(goal, exerciseName)}
          </h3>
          <p className="text-[12.5px] text-muted">
            Desde {shortDate(goal.startDate)}
            {goal.deadline && ` · plazo ${shortDate(goal.deadline)}`}
          </p>
        </div>
        <ArchiveButton onClick={onArchive} />
      </div>

      <div className="mt-2 flex items-baseline justify-between gap-3">
        <span className="readout text-[30px] font-semibold leading-none">
          {status.current != null ? formatNumber(status.current, 1) : '—'}
          <span className="ml-1 font-sans text-[12px] font-medium text-muted">{unit}</span>
        </span>
        <span className="text-[12.5px] text-muted">
          {goal.start != null && `de ${formatNumber(goal.start, 1)} `}a{' '}
          <span className="text-ink-2">
            {formatNumber(goal.target, 1)} {unit}
          </span>
        </span>
      </div>

      {status.progress != null && (
        <div className="mt-3">
          <Meter
            value={status.progress}
            max={1}
            target={pace}
            label={`${Math.round(status.progress * 100)} % del objetivo`}
          />
          <div className="mt-1.5 flex justify-between text-[12px] text-muted">
            <span>{Math.round(status.progress * 100)} % del camino</span>
            {pace !== undefined && <span>Marca: dónde deberías ir hoy</span>}
          </div>
        </div>
      )}

      <p className={paceClass(status)}>{paceText(goal, status)}</p>
    </li>
  )
}

function paceClass(s: GoalStatus): string {
  const base = 'mt-2 text-[13px] leading-snug'
  if (s.pace === 'ahead') return `${base} text-gold`
  if (s.pace === 'behind') return `${base} text-warn`
  return `${base} text-muted`
}

function paceText(goal: UserGoal, s: GoalStatus): string {
  if (s.current == null) return missingHint(goal.kind)
  if (s.daysLeft != null && s.daysLeft < 0)
    return `El plazo acabó el ${shortDate(goal.deadline!)}. Ajusta la fecha o archívalo.`
  switch (s.pace) {
    case 'ahead':
      return `A este ritmo, ${shortDate(localDateKey(s.eta!))} · antes del plazo`
    case 'behind':
      return s.eta
        ? `A este ritmo, ${shortDate(localDateKey(s.eta))} · vas por detrás`
        : 'Vas por detrás: la tendencia no avanza hacia el objetivo'
    case 'no_deadline':
      return `A este ritmo, ${shortDate(localDateKey(s.eta!))}`
    default:
      return 'Aún no hay datos suficientes para estimar la fecha (hacen falta 3 mediciones).'
  }
}

function missingHint(kind: GoalKind): string {
  if (kind === 'e1rm' || kind === 'lift')
    return 'Sin series de este ejercicio todavía: entrénalo para medir el progreso.'
  if (kind === 'frequency') return 'Sin sesiones registradas todavía.'
  return 'Sin escáner todavía: registra uno en Cuerpo para medir el progreso.'
}

const parseNum = (s: string): number | null => {
  const n = Number(s.replace(',', '.').trim())
  return s.trim() !== '' && Number.isFinite(n) ? n : null
}

function GoalSheet({
  open,
  onClose,
  initialKind,
  initialExercise,
  initialTarget = null,
  initialDeadline = null,
  data,
  now,
  onCreate,
}: {
  open: boolean
  onClose: () => void
  initialKind: GoalKind
  initialExercise: string | null
  /** Prefilled from a suggestion link (`?target=…&deadline=YYYY-MM-DD`). */
  initialTarget?: string | null
  initialDeadline?: string | null
  data: GoalData
  now: Date
  onCreate: (g: UserGoal) => Promise<void>
}) {
  const lookup = useExerciseLookup()
  const [kind, setKind] = useState<GoalKind>(initialKind)
  const [exercise, setExercise] = useState<Exercise | null>(() =>
    initialExercise ? lookup(initialExercise) : null,
  )
  const [reps, setReps] = useState('5')
  const [target, setTarget] = useState(() => {
    const n = Number(initialTarget)
    return initialTarget && Number.isFinite(n)
      ? String(Math.round(n * 10) / 10).replace('.', ',')
      : ''
  })
  const [deadline, setDeadline] = useState(() =>
    initialDeadline && /^\d{4}-\d{2}-\d{2}$/.test(initialDeadline) ? initialDeadline : '',
  )
  const [picking, setPicking] = useState(false)
  const [busy, setBusy] = useState(false)

  const repsN = Math.max(1, Math.round(parseNum(reps) ?? 1))
  const exerciseId = needsExercise(kind) ? (exercise?.id ?? null) : null
  const current = useMemo(
    () =>
      needsExercise(kind) && !exerciseId
        ? null
        : goalCurrent({ kind, exerciseId, reps: repsN }, data, now),
    [kind, exerciseId, repsN, data, now],
  )
  const targetN = parseNum(target)
  const valid = targetN != null && targetN > 0 && (!needsExercise(kind) || exercise != null)
  const unit = goalUnit(kind)

  const create = async () => {
    if (!valid || busy) return
    setBusy(true)
    try {
      await onCreate({
        id: newId(),
        kind,
        exerciseId,
        reps: kind === 'lift' ? repsN : null,
        target: targetN,
        start: current,
        startDate: localDateKey(now),
        deadline: deadline || null,
        achievedAt: null,
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Sheet
        open={open && !picking}
        onClose={onClose}
        title="Nuevo objetivo"
        description="El punto de partida es tu valor de hoy."
        footer={
          <Button block disabled={!valid} loading={busy} onClick={() => void create()}>
            Crear objetivo
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Tipo">
            {(id) => (
              <Select id={id} value={kind} onChange={(e) => setKind(e.target.value as GoalKind)}>
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {GOAL_KIND_LABEL[k]}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          {needsExercise(kind) && (
            <Field label="Ejercicio">
              {(id) => (
                <button
                  id={id}
                  type="button"
                  onClick={() => setPicking(true)}
                  className="flex h-12 w-full items-center rounded-control border border-line bg-panel-2 px-4 text-left text-[15px]"
                >
                  {exercise ? exercise.name : <span className="text-muted">Elegir ejercicio</span>}
                </button>
              )}
            </Field>
          )}

          {kind === 'lift' && (
            <Field label="Repeticiones">
              {(id, d) => (
                <Input
                  id={id}
                  aria-describedby={d}
                  inputMode="numeric"
                  value={reps}
                  onChange={(e) => setReps(e.target.value)}
                  suffix="reps"
                />
              )}
            </Field>
          )}

          <Field
            label={kind === 'lift' ? 'Peso objetivo' : 'Objetivo'}
            hint={
              current != null
                ? `Hoy: ${formatGoalValue(kind, current)}${kind === 'e1rm' ? ' (mejor de las últimas 4 semanas)' : ''}`
                : needsExercise(kind) && !exercise
                  ? undefined
                  : 'Sin dato actual: el progreso se medirá desde la primera medición.'
            }
          >
            {(id, d) => (
              <Input
                id={id}
                aria-describedby={d}
                inputMode="decimal"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                suffix={unit}
                placeholder={current != null ? formatNumber(current, 1) : undefined}
              />
            )}
          </Field>

          <Field label="Fecha límite (opcional)">
            {(id) => (
              <Input
                id={id}
                type="date"
                min={localDateKey(now)}
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            )}
          </Field>
        </div>
      </Sheet>
      <ExercisePicker
        open={open && picking}
        onClose={() => setPicking(false)}
        onPick={setExercise}
      />
    </>
  )
}
