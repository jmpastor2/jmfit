import { clsx } from 'clsx'
import {
  Check,
  ChevronDown,
  ChevronLeft,
  Minus,
  MoreHorizontal,
  PlayCircle,
  Plus,
  Pencil,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Sheet'
import { useToast } from '@/components/ui/Toast'
import { MUSCLE_LABEL } from '@/content/exercises'
import { useActiveWorkout, useMe, useSets, useTrainingActions, useWorkouts } from '@/data/hooks'
import type { WorkoutFull } from '@/data/rows'
import { detectPRs, estimate1RM, formatNumber, platesPerSide } from '@/domain/training'
import type { Exercise, LoggedSet, PersonalRecord, SetKind, SetTarget } from '@/domain/types'
import { ExercisePicker } from '@/features/exercise/ExercisePicker'
import { useExerciseLookup } from '@/features/exercise/lookup'
import { TechniqueSheet } from '@/features/exercise/TechniqueSheet'
import { useReadiness } from '@/features/today/useReadiness'
import { useNow } from '@/lib/useNow'
import { EditSetSheet } from './EditSetSheet'
import { FinishSheet } from './FinishSheet'
import {
  buildBlock,
  historyFor,
  newId,
  nextSetIndex,
  slotFor,
  type ExerciseBlock,
  type RowState,
} from './model'
import { RestPanel } from './RestPanel'
import { fmtClock, restTimer, useRestAlarm } from './restTimer'

/**
 * After a set, bring the next one into the middle of the screen, clear of the rest panel
 * docked at the bottom (it used to sit under the panel and needed a scroll).
 */
function revealActiveSet() {
  window.setTimeout(() => {
    const el = document.querySelector<HTMLElement>('[data-active-set]')
    if (!el) return
    const r = el.getBoundingClientRect()
    // Bottom of the set just above the rest panel (≈170 px); a set taller than the room left
    // starts under the sticky header instead.
    const room = window.innerHeight - 170
    const delta = r.height > room - 90 ? r.top - 90 : r.bottom - room
    // Instant: a smooth scroll was cancelled by the re-render that follows the saved set.
    window.scrollTo({ top: window.scrollY + delta })
    // Long enough for the next card to open and the saved set to render.
  }, 250)
}

/** Stable empties: a fresh `[]` each render would recompute every block. */
const NO_SETS: LoggedSet[] = []
const NO_WORKOUTS: WorkoutFull[] = []

/** Event-time clock (sets are stamped when logged, never during render). */
const nowIso = () => new Date().toISOString()

const kg = (n: number | null | undefined) => (n == null ? '—' : formatNumber(n))

export function SessionPage() {
  const workout = useActiveWorkout()
  const workouts = useWorkouts()
  if (workouts.isPending) return null
  if (!workout) return <Navigate to="/" replace />
  return <Session key={workout.id} workout={workout} />
}

function Session({ workout }: { workout: WorkoutFull }) {
  const nav = useNavigate()
  const me = useMe()
  const { toast } = useToast()
  const sets = useSets().data ?? NO_SETS
  const workouts = useWorkouts().data ?? NO_WORKOUTS
  const lookup = useExerciseLookup()
  const readiness = useReadiness()
  const { saveSets, saveWorkout, deleteSets } = useTrainingActions()
  useRestAlarm(me.restSound)

  const logged = useMemo(() => sets.filter((s) => s.workoutId === workout.id), [sets, workout.id])

  const blocks = useMemo(
    () =>
      workout.plan.map((slot, index) => {
        const exercise = lookup(slot.exerciseId)
        return buildBlock({
          index,
          slot,
          exercise,
          history: historyFor(exercise.id, sets, workouts, workout.id),
          logged,
          deload: workout.deload,
          readiness: readiness.level,
          bodyweight: workout.bodyweight,
        })
      }),
    [workout, lookup, sets, workouts, logged, readiness.level],
  )

  const inSession = useMemo(() => new Set(workout.plan.map((s) => s.exerciseId)), [workout.plan])
  const firstOpen = blocks.findIndex((b) => b.doneWork < b.plannedWork)
  const [focus, setFocus] = useState<number | null>(firstOpen === -1 ? null : firstOpen)
  const [picker, setPicker] = useState<{ mode: 'add' } | { mode: 'swap'; index: number } | null>(
    null,
  )
  const [finishing, setFinishing] = useState(false)

  const prior = (exerciseId: string, excludeId: string) =>
    sets.filter((s) => s.exerciseId === exerciseId && s.id !== excludeId)

  const logSet = async (block: ExerciseBlock, row: RowState, values: SetValues) => {
    const set: LoggedSet = {
      id: newId(),
      workoutId: workout.id,
      exerciseId: block.exercise.id,
      exerciseIndex: block.index,
      setIndex: nextSetIndex(logged, block.index),
      kind: values.ramp ? 'warmup' : row.target.kind,
      weight: values.weight,
      reps: values.reps,
      rir: row.target.kind === 'warmup' || values.ramp ? null : values.rir,
      doneAt: nowIso(),
    }
    const prs = set.kind === 'warmup' ? [] : detectPRs(set, prior(set.exerciseId, set.id))
    const isLastWork = set.kind !== 'warmup' && block.doneWork + 1 >= block.plannedWork
    // Ramp-up sets before a heavy top set get a little more than a plain warm-up.
    const rest =
      set.kind === 'warmup'
        ? Math.min(values.ramp ? 90 : 60, block.slot.restSec)
        : block.slot.restSec
    // Superset: go straight to the partner exercise; the rest comes after the partner's set.
    const partner =
      set.kind !== 'warmup' && block.slot.superset
        ? blocks.find(
            (b) =>
              b.index !== block.index &&
              b.slot.superset === block.slot.superset &&
              b.doneWork < b.plannedWork &&
              b.doneWork <= block.doneWork,
          )
        : undefined
    if (partner) {
      restTimer.stop()
      setFocus(partner.index)
      if (prs.length) toast(prMessage(prs[0]!), 'success')
      revealActiveSet()
      await saveSets([set])
      return
    }
    if (!(isLastWork && block.index === blocks.length - 1)) {
      restTimer.start(
        rest,
        isLastWork ? siguienteLabel(blocks, block.index, lookup) : block.exercise.name,
      )
    }
    if (isLastWork) {
      const next = blocks.findIndex((b, i) => i > block.index && b.doneWork < b.plannedWork)
      setFocus(next === -1 ? null : next)
    }
    if (prs.length) toast(prMessage(prs[0]!), 'success')
    revealActiveSet()
    await saveSets([set])
  }

  const addExercise = async (e: Exercise) => {
    const plan = [...workout.plan, slotFor(e)]
    setFocus(plan.length - 1)
    await saveWorkout({ ...workout, plan })
  }

  const swapExercise = async (index: number, e: Exercise) => {
    const slot = workout.plan[index]
    if (!slot) return
    const mine = logged.filter((s) => s.exerciseIndex === index)
    const doneWork = mine.filter((s) => s.kind !== 'warmup').length
    if (doneWork === 0) {
      // Nothing but warm-ups (or nothing): swap in place; those warm-ups were for the old one.
      const plan = workout.plan.map((s, i) =>
        i === index ? { ...s, exerciseId: e.id, restSec: e.restSec } : s,
      )
      await saveWorkout({ ...workout, plan })
      await deleteSets(mine.map((s) => s.id))
      return
    }
    // Work sets already done stay with the exercise they were done on; the replacement comes
    // right after it with the sets that were left, and later exercises move down one place.
    const kept = { ...slot, sets: doneWork }
    const replacement = {
      ...slot,
      id: newId(),
      exerciseId: e.id,
      restSec: e.restSec,
      sets: Math.max(1, slot.sets - doneWork),
    }
    const plan = [
      ...workout.plan.slice(0, index),
      kept,
      replacement,
      ...workout.plan.slice(index + 1),
    ]
    const moved = logged
      .filter((s) => s.exerciseIndex > index)
      .map((s) => ({ ...s, exerciseIndex: s.exerciseIndex + 1 }))
    setFocus(index + 1)
    await saveWorkout({ ...workout, plan })
    await saveSets(moved)
  }

  const addSet = async (index: number) => {
    const plan = workout.plan.map((s, i) => (i === index ? { ...s, sets: s.sets + 1 } : s))
    await saveWorkout({ ...workout, plan })
  }

  const removeExercise = async (index: number) => {
    const ids = logged.filter((s) => s.exerciseIndex === index).map((s) => s.id)
    // Later exercises move up one position: their sets follow.
    const moved = logged
      .filter((s) => s.exerciseIndex > index)
      .map((s) => ({ ...s, exerciseIndex: s.exerciseIndex - 1 }))
    const plan = workout.plan.filter((_, i) => i !== index)
    setFocus(null)
    await saveWorkout({ ...workout, plan })
    await deleteSets(ids)
    await saveSets(moved)
  }

  const doneSets = logged.filter((s) => s.kind !== 'warmup').length
  const plannedSets = blocks.reduce((a, b) => a + b.plannedWork, 0)

  return (
    <div className="min-h-dvh pb-[60vh]">
      <SessionHeader
        workout={workout}
        done={doneSets}
        planned={plannedSets}
        onBack={() => nav('/')}
        onFinish={() => setFinishing(true)}
      />
      <div className="px-4">
        {workout.deload && (
          <p className="mb-3 border-l-2 border-gold pl-3 text-[13.5px] text-ink-2">
            Semana de descarga: menos series y más margen. Tu cuerpo consolida lo ganado.
          </p>
        )}
        {readiness.level === 'easy' && (
          <p className="mb-3 border-l-2 border-warn pl-3 text-[13.5px] text-ink-2">
            Hoy vas justo de recuperación: el plan no sube pesos y deja una repetición más en
            recámara.
          </p>
        )}
        <ol className="flex flex-col gap-3">
          {blocks.map((b) => (
            <ExerciseCard
              key={`${b.index}-${b.exercise.id}`}
              block={b}
              total={blocks.length}
              open={focus === b.index}
              onToggle={() => setFocus(focus === b.index ? null : b.index)}
              onLog={(row, v) => logSet(b, row, v)}
              onSwap={() => setPicker({ mode: 'swap', index: b.index })}
              onAddSet={() => addSet(b.index)}
              onRemove={() => removeExercise(b.index)}
              onEditSet={(set) => saveSets([set])}
              onDeleteSet={(set) => deleteSets([set.id])}
              barKg={me.barKg}
              plates={me.platesKg}
              allSets={sets}
            />
          ))}
        </ol>
        {!blocks.length && (
          <p className="py-10 text-center text-[14px] text-muted">
            Sesión libre: añade el primer ejercicio.
          </p>
        )}
        <Button
          variant="secondary"
          block
          className="mt-4"
          leading={<Plus className="size-4" />}
          onClick={() => setPicker({ mode: 'add' })}
        >
          Añadir ejercicio
        </Button>
        <Button block size="lg" className="mt-3" onClick={() => setFinishing(true)}>
          Terminar entreno
        </Button>
      </div>

      <RestPanel />

      <ExercisePicker
        open={picker !== null}
        onClose={() => setPicker(null)}
        title={picker?.mode === 'swap' ? 'Cambiar ejercicio' : 'Añadir ejercicio'}
        {...(picker?.mode === 'swap' ? { suggestFor: blocks[picker.index]?.exercise } : {})}
        exclude={inSession}
        onPick={(e) => {
          if (picker?.mode === 'swap') void swapExercise(picker.index, e)
          else void addExercise(e)
        }}
      />
      <FinishSheet
        open={finishing}
        onClose={() => setFinishing(false)}
        workout={workout}
        logged={logged}
      />
    </div>
  )
}

function siguienteLabel(
  blocks: ExerciseBlock[],
  index: number,
  lookup: (id: string) => Exercise,
): string {
  const next = blocks.find((b, i) => i > index && b.doneWork < b.plannedWork)
  return next ? `Siguiente: ${lookup(next.exercise.id).name}` : 'Descanso'
}

function prMessage(pr: PersonalRecord): string {
  const v = formatNumber(pr.value)
  if (pr.kind === 'e1rm') return `Récord: 1RM estimado ${v} kg`
  if (pr.kind === 'weight') return `Récord de peso: ${v} kg`
  if (pr.kind === 'reps') return `Récord: ${v} reps con ${formatNumber(pr.atWeight ?? 0)} kg`
  return `Récord de volumen: ${v} kg`
}

/* ───────────── Header ───────────── */

function SessionHeader({
  workout,
  done,
  planned,
  onBack,
  onFinish,
}: {
  workout: WorkoutFull
  done: number
  planned: number
  onBack: () => void
  onFinish: () => void
}) {
  const now = useNow(1000)
  const elapsed = Math.max(
    0,
    Math.floor((now.getTime() - new Date(workout.startedAt).getTime()) / 1000),
  )
  const h = Math.floor(elapsed / 3600)
  const clock = h ? `${h}:${fmtClock(elapsed % 3600).padStart(5, '0')}` : fmtClock(elapsed)
  return (
    <header className="safe-top sticky top-0 z-30 mb-4 border-b border-line bg-canvas/90 backdrop-blur-xl">
      <div className="flex items-center gap-2 px-4 pb-2">
        <button
          type="button"
          onClick={onBack}
          aria-label="Volver (la sesión sigue abierta)"
          className="-ml-2 grid size-11 place-items-center text-ink-2"
        >
          <ChevronLeft className="size-6" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="spec text-gold">En curso · {clock}</div>
          <h1 className="truncate font-display text-[22px] font-semibold uppercase tracking-[0.05em]">
            {workout.name}
          </h1>
        </div>
        <button type="button" onClick={onFinish} className="spec tap-link px-1 text-gold">
          Terminar
        </button>
      </div>
      <div className="h-[2px] w-full bg-panel-3">
        <div
          className="h-full bg-gold transition-[width] duration-500"
          style={{ width: `${planned ? Math.min(100, (done / planned) * 100) : 0}%` }}
        />
      </div>
    </header>
  )
}

/* ───────────── Exercise card ───────────── */

interface SetValues {
  weight: number | null
  reps: number | null
  rir: number | null
  /** Marked as a ramp-up set: logged as a warm-up, does not use up a work set. */
  ramp?: boolean
}

function ExerciseCard({
  block,
  total,
  open,
  onToggle,
  onLog,
  onSwap,
  onAddSet,
  onRemove,
  onEditSet,
  onDeleteSet,
  barKg,
  plates,
  allSets,
}: {
  block: ExerciseBlock
  total: number
  open: boolean
  onToggle: () => void
  onLog: (row: RowState, v: SetValues) => Promise<void>
  onSwap: () => void
  onAddSet: () => void
  onRemove: () => void
  onEditSet: (set: LoggedSet) => Promise<void>
  onDeleteSet: (set: LoggedSet) => Promise<void>
  barKg: number
  plates: number[]
  allSets: LoggedSet[]
}) {
  const { exercise, recommendation, rows, doneWork, plannedWork } = block
  const [technique, setTechnique] = useState(false)
  const [menu, setMenu] = useState(false)
  const [editing, setEditing] = useState<{ set: LoggedSet; label: string } | null>(null)
  const complete = plannedWork > 0 && doneWork >= plannedWork
  const activeRow = rows.findIndex((r) => !r.done)
  const best = useMemo(() => {
    let top: { e: number; w: number; r: number } | null = null
    for (const s of allSets) {
      if (s.exerciseId !== exercise.id || s.kind === 'warmup' || s.weight == null || !s.reps)
        continue
      const e = estimate1RM(s.weight, s.reps, s.rir ?? 0)
      if (e != null && (!top || e > top.e)) top = { e, w: s.weight, r: s.reps }
    }
    return top
  }, [allSets, exercise.id])

  return (
    <li className={clsx('card overflow-hidden', open && 'border-line-strong')}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <span
          className={clsx(
            'readout w-7 shrink-0 text-[20px] font-semibold',
            complete ? 'text-gold' : 'text-muted',
          )}
        >
          {complete ? (
            <Check className="size-5" strokeWidth={2.5} />
          ) : (
            String(block.index + 1).padStart(2, '0')
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-[19px] font-semibold uppercase leading-tight tracking-[0.04em]">
            {exercise.name}
          </span>
          <span className="block text-[12.5px] text-muted">
            {doneWork}/{plannedWork} series ·{' '}
            {block.slot.repMin === block.slot.repMax
              ? block.slot.repMin
              : `${block.slot.repMin}–${block.slot.repMax}`}{' '}
            {exercise.timed ? 's' : 'reps'}
            {exercise.primary[0] ? ` · ${MUSCLE_LABEL[exercise.primary[0]]}` : ''}
          </span>
        </span>
        <ChevronDown
          className={clsx('size-5 shrink-0 text-muted transition', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className="border-t border-line px-4 pb-4 pt-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="spec">
              {block.index + 1} de {total}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setTechnique(true)}
                className="flex h-11 items-center gap-1.5 px-2 text-[13px] font-semibold text-gold"
              >
                <PlayCircle className="size-[18px]" /> Técnica
              </button>
              <button
                type="button"
                onClick={() => setMenu(true)}
                aria-label="Opciones del ejercicio"
                className="grid size-11 place-items-center text-ink-2"
              >
                <MoreHorizontal className="size-5" />
              </button>
            </div>
          </div>

          <p className="border-l-2 border-gold pl-3 text-[14px] leading-snug text-ink">
            {exercise.timed
              ? `Aguanta ${block.slot.repMin === block.slot.repMax ? block.slot.repMin : `${block.slot.repMin}–${block.slot.repMax}`} s con buena técnica. Cuando llegues con margen en todas las series, súbelo 5–10 s.`
              : recommendation.message}
          </p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-muted">
            {recommendation.last && (
              <span>
                Última vez:{' '}
                <span className="text-ink-2">
                  {recommendation.last.sets
                    .map((s) => `${kg(s.weight)}×${s.reps ?? '—'}`)
                    .join(' · ')}
                </span>
              </span>
            )}
            {best && (
              <span>
                Mejor:{' '}
                <span className="text-ink-2">
                  {kg(best.w)} kg × {best.r}
                </span>{' '}
                · 1RM ≈{' '}
                <span className="text-gold">{formatNumber(Math.round(best.e * 2) / 2)} kg</span>
              </span>
            )}
          </div>

          <ul className="mt-4 flex flex-col">
            {rows.map((row, i) =>
              i === activeRow ? (
                <ActiveSet
                  // A new target (the engine adjusted it after the last set) remounts the fields.
                  key={`a-${i}-${row.target.weight}-${row.target.repMin}-${row.target.rir}`}
                  row={row}
                  label={rowLabel(rows, i)}
                  exercise={exercise}
                  onLog={(v) => onLog(row, v)}
                  barKg={barKg}
                  plates={plates}
                />
              ) : (
                <SetLine
                  key={`s-${i}`}
                  row={row}
                  label={rowLabel(rows, i)}
                  timed={Boolean(exercise.timed)}
                  onEdit={(set) => setEditing({ set, label: rowLabel(rows, i) })}
                />
              ),
            )}
          </ul>
          {activeRow === -1 && (
            <button type="button" onClick={onAddSet} className="spec tap-link mt-3 block text-gold">
              + Añadir serie
            </button>
          )}
        </div>
      )}

      <TechniqueSheet exercise={exercise} open={technique} onClose={() => setTechnique(false)} />
      <EditSetSheet
        set={editing?.set ?? null}
        label={editing?.label ?? ''}
        exercise={exercise}
        onClose={() => setEditing(null)}
        onSave={onEditSet}
        onDelete={onDeleteSet}
      />
      <Sheet open={menu} onClose={() => setMenu(false)} title={exercise.name}>
        <div className="flex flex-col gap-2 pb-2">
          <Button
            variant="secondary"
            block
            onClick={() => {
              setMenu(false)
              onSwap()
            }}
          >
            Cambiar ejercicio
          </Button>
          <Button
            variant="secondary"
            block
            onClick={() => {
              setMenu(false)
              onAddSet()
            }}
          >
            Añadir una serie
          </Button>
          <Button
            variant="danger"
            block
            onClick={() => {
              setMenu(false)
              onRemove()
            }}
          >
            Quitar de la sesión
          </Button>
        </div>
      </Sheet>
    </li>
  )
}

function rowLabel(rows: RowState[], i: number): string {
  const row = rows[i]!
  if (row.target.kind === 'warmup') {
    const n = rows.slice(0, i + 1).filter((r) => r.target.kind === 'warmup').length
    return `C${n}`
  }
  return String(rows.slice(0, i + 1).filter((r) => r.target.kind !== 'warmup').length)
}

function targetText(t: SetTarget, timed = false): string {
  const reps = t.repMin === t.repMax ? `${t.repMin}` : `${t.repMin}–${t.repMax}`
  if (timed) return `${reps} s`
  const w = t.weight == null ? '' : `${kg(t.weight)} kg × `
  return t.kind === 'warmup' ? `${w}${reps}` : `${w}${reps} · RIR ${t.rir}`
}

/** A set already done, or one still waiting behind the active one. */
function SetLine({
  row,
  label,
  timed,
  onEdit,
}: {
  row: RowState
  label: string
  timed: boolean
  onEdit: (set: LoggedSet) => void
}) {
  const done = row.done
  const warm = row.target.kind === 'warmup'
  const number = (
    <span
      className={clsx(
        'readout w-7 shrink-0 text-[16px]',
        warm ? 'text-muted' : done ? 'text-gold' : 'text-ink-2',
      )}
    >
      {label}
    </span>
  )
  if (!done) {
    return (
      <li className="flex min-h-12 items-center gap-3 border-b border-line last:border-0">
        {number}
        <span className="flex-1 text-[13.5px] text-muted">{targetText(row.target, timed)}</span>
      </li>
    )
  }
  // A logged set is a button: tap it to fix the weight, the reps or the RIR, or remove it.
  return (
    <li className="border-b border-line last:border-0">
      <button
        type="button"
        onClick={() => onEdit(done)}
        aria-label={`Editar serie ${label}`}
        className="flex min-h-12 w-full items-center gap-3 text-left active:bg-panel-2"
      >
        {number}
        {timed ? (
          <span className="readout flex-1 text-[19px] font-semibold">
            {done.reps ?? '—'}
            <span className="ml-1 font-sans text-[12px] font-medium text-muted">s</span>
          </span>
        ) : (
          <span className="readout flex-1 text-[19px] font-semibold">
            {kg(done.weight)}
            <span className="ml-1 font-sans text-[12px] font-medium text-muted">kg</span>
            <span className="mx-2 text-muted">×</span>
            {done.reps ?? '—'}
          </span>
        )}
        {done.rir != null && (
          <span className="text-[12.5px] text-muted">RIR {formatNumber(done.rir)}</span>
        )}
        <Pencil className="size-3.5 text-muted" aria-hidden />
        <Check className="size-4 text-gold" strokeWidth={2.5} />
      </button>
    </li>
  )
}

const parseNum = (s: string): number | null => {
  const n = Number(s.replace(',', '.'))
  return s.trim() !== '' && Number.isFinite(n) ? n : null
}

/** The set to do now: big steppers, RIR, plate math and one gold button. */
function ActiveSet({
  row,
  label,
  exercise,
  onLog,
  barKg,
  plates,
}: {
  row: RowState
  label: string
  exercise: Exercise
  onLog: (v: SetValues) => Promise<void>
  barKg: number
  plates: number[]
}) {
  const t = row.target
  const [weight, setWeight] = useState(t.weight == null ? '' : formatNumber(t.weight))
  const [reps, setReps] = useState(String(t.repMax === t.repMin ? t.repMin : t.repMin))
  const [rir, setRir] = useState<number | null>(t.kind === 'warmup' ? null : t.rir)
  // Ramp-up set toggle: only offered on work sets of loaded, untimed exercises.
  const [ramp, setRamp] = useState(false)
  const canRamp = t.kind !== 'warmup' && !exercise.timed
  const [busy, setBusy] = useState(false)

  const w = parseNum(weight)
  const r = parseNum(reps)
  const step = exercise.increment || 2.5
  const bump = (d: number) =>
    setWeight(formatNumber(Math.max(0, Math.round(((w ?? 0) + d) * 100) / 100)))
  const load =
    exercise.equipment === 'barbell' && w != null && w > barKg
      ? platesPerSide(w, barKg, plates)
      : null
  const kindLabel: Record<SetKind, string> = {
    warmup: 'Calentamiento',
    work: 'Serie',
    drop: 'Drop',
    failure: 'Al fallo',
  }

  return (
    <li data-active-set className="my-2 rounded-[8px] border border-gold/40 bg-signal-soft p-3">
      <div className="mb-3 flex items-baseline justify-between">
        <span className="spec text-gold">
          {kindLabel[t.kind]} {label.replace('C', '')}
        </span>
        <span className="text-[12.5px] text-ink-2">Objetivo {targetText(t, exercise.timed)}</span>
      </div>
      {exercise.timed ? (
        <HoldTimer seconds={reps} onSeconds={setReps} target={t.repMin} />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Stepper
            label={exercise.bodyweight ? 'Lastre kg' : 'Kg'}
            value={weight}
            onChange={setWeight}
            onMinus={() => bump(-step)}
            onPlus={() => bump(step)}
            decimal
          />
          <Stepper
            label="Reps"
            value={reps}
            onChange={setReps}
            onMinus={() => setReps(String(Math.max(0, (r ?? 0) - 1)))}
            onPlus={() => setReps(String((r ?? 0) + 1))}
          />
        </div>
      )}
      {canRamp && (
        <button
          type="button"
          role="switch"
          aria-checked={ramp}
          onClick={() => setRamp(!ramp)}
          className="mt-3 flex min-h-11 w-full items-center justify-between gap-3 text-left"
        >
          <span>
            <span className="spec block">Aproximación</span>
            <span className="block text-[12px] text-muted">
              Serie de subida de peso: no cuenta como serie de trabajo
            </span>
          </span>
          <span
            className={clsx(
              'relative h-7 w-12 shrink-0 rounded-full border transition',
              ramp ? 'border-gold bg-gold' : 'border-line bg-panel-2',
            )}
          >
            <span
              className={clsx(
                'absolute top-0.5 size-[22px] rounded-full transition-[left]',
                ramp ? 'left-[22px] bg-signal-ink' : 'left-0.5 bg-ink-2',
              )}
            />
          </span>
        </button>
      )}
      {t.kind !== 'warmup' && !exercise.timed && !ramp && (
        <div className="mt-3">
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="spec">Reps en recámara</span>
            <span className="text-[12px] text-muted">¿Cuántas más podías hacer?</span>
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {[0, 1, 2, 3, 4].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRir(rir === n ? null : n)}
                className={clsx(
                  'readout h-11 rounded-[6px] border text-[18px] font-semibold transition',
                  rir === n
                    ? 'border-gold bg-gold text-signal-ink'
                    : 'border-line bg-panel-2 text-ink-2',
                )}
              >
                {n === 4 ? '4+' : n}
              </button>
            ))}
          </div>
        </div>
      )}
      {load && (load.perSide.length > 0 || load.remainder > 0) && (
        <p className="mt-3 text-[12.5px] text-muted">
          Por lado:{' '}
          <span className="text-ink-2">{load.perSide.map((p) => formatNumber(p)).join(' + ')}</span>
          {load.remainder > 0 && ` (faltan ${formatNumber(load.remainder)} kg)`}
        </p>
      )}
      <Button
        block
        size="lg"
        className="mt-3"
        loading={busy}
        // A loaded exercise needs its weight; bodyweight (lastre 0) and held sets do not.
        disabled={r == null || (w == null && !exercise.bodyweight && !exercise.timed)}
        leading={<Check className="size-5" strokeWidth={2.6} />}
        onClick={async () => {
          setBusy(true)
          try {
            await onLog(
              exercise.timed
                ? { weight: null, reps: r, rir: null }
                : { weight: w, reps: r, rir: ramp ? null : rir, ramp },
            )
            // One ramp set at a time: the next set starts as a work set again.
            setRamp(false)
          } finally {
            setBusy(false)
          }
        }}
      >
        Serie hecha
      </Button>
    </li>
  )
}

function Stepper({
  label,
  value,
  onChange,
  onMinus,
  onPlus,
  decimal,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  onMinus: () => void
  onPlus: () => void
  decimal?: boolean
}) {
  return (
    <div>
      <span className="spec mb-1 block">{label}</span>
      <div className="flex h-14 items-stretch overflow-hidden rounded-[6px] border border-line bg-panel">
        <button
          type="button"
          onClick={onMinus}
          aria-label={`Menos ${label}`}
          className="grid w-11 place-items-center text-ink-2 active:bg-panel-3"
        >
          <Minus className="size-4" />
        </button>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          inputMode={decimal ? 'decimal' : 'numeric'}
          aria-label={label}
          data-big
          className="readout min-w-0 flex-1 bg-transparent text-center text-[28px] font-semibold outline-none"
        />
        <button
          type="button"
          onClick={onPlus}
          aria-label={`Más ${label}`}
          className="grid w-11 place-items-center text-ink-2 active:bg-panel-3"
        >
          <Plus className="size-4" />
        </button>
      </div>
    </div>
  )
}

/**
 * Held sets (planks): a stopwatch that fills the seconds when stopped, plus a stepper to fix
 * them by hand. The target is marked; passing it vibrates once.
 */
function HoldTimer({
  seconds,
  onSeconds,
  target,
}: {
  seconds: string
  onSeconds: (v: string) => void
  target: number
}) {
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const now = useNow(startedAt ? 250 : 60_000)
  const elapsed = startedAt ? Math.max(0, Math.floor((now.getTime() - startedAt) / 1000)) : null
  const [buzzed, setBuzzed] = useState(false)
  if (elapsed !== null && elapsed >= target && !buzzed) {
    setBuzzed(true)
    navigator.vibrate?.([120, 60, 120])
  }
  const n = parseNum(seconds) ?? 0
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between rounded-[6px] border border-line bg-panel px-4 py-3">
        <span
          className={clsx(
            'readout text-[44px] font-semibold leading-none',
            elapsed !== null && elapsed >= target ? 'text-gold' : 'text-ink',
          )}
        >
          {fmtClock(elapsed ?? n)}
        </span>
        <Button
          variant={startedAt ? 'primary' : 'secondary'}
          onClick={() => {
            if (startedAt) {
              onSeconds(String(elapsed ?? 0))
              setStartedAt(null)
            } else {
              setBuzzed(false)
              setStartedAt(Date.now())
            }
          }}
        >
          {startedAt ? 'Parar' : 'Cronómetro'}
        </Button>
      </div>
      <Stepper
        label="Segundos"
        value={seconds}
        onChange={onSeconds}
        onMinus={() => onSeconds(String(Math.max(0, n - 5)))}
        onPlus={() => onSeconds(String(n + 5))}
      />
    </div>
  )
}
