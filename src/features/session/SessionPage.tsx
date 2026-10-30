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
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Sheet'
import { useToast } from '@/components/ui/Toast'
import { MUSCLE_LABEL } from '@/content/exercises'
import {
  queued,
  useActiveProgram,
  useActiveWorkout,
  useMe,
  useProgramActions,
  useSets,
  useTrainingActions,
  useWorkouts,
} from '@/data/hooks'
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
import { QuickCheckin } from './QuickCheckin'
import {
  buildBlock,
  historyFor,
  newId,
  nextSetIndex,
  slotFor,
  type ExerciseBlock,
  type RowState,
  quickFill,
  type QuickFill,
} from './model'
import { RestPanel } from './RestPanel'
import { fmtClock, restTimer } from './restTimer'
import { saveDraft, saveFocus, savedDraft, savedFocus } from './sessionUi'

/**
 * Keep the set to do in view, between the sticky header and the rest panel docked at the
 * bottom. Only scrolls when it is (partly) hidden, and only as far as needed: scrolling a set
 * that was already visible made the screen jump back up after every set.
 */
function revealActiveSet(behavior: ScrollBehavior) {
  // Next frame: the rest panel that starts with the set has been laid out by then.
  requestAnimationFrame(() => {
    const el = document.querySelector<HTMLElement>('[data-active-set]')
    if (!el) return
    const r = el.getBoundingClientRect()
    const header = document.querySelector('[data-session-header]')?.getBoundingClientRect()
    const panel = document.querySelector('[data-rest-panel]')?.getBoundingClientRect()
    const top = (header?.bottom ?? 0) + 8
    const bottom = window.innerHeight - (panel?.height ?? 0) - 8
    let delta = 0
    if (r.top < top || r.height > bottom - top) delta = r.top - top
    else if (r.bottom > bottom) delta = r.bottom - bottom
    if (Math.abs(delta) < 2) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollBy({ top: delta, behavior: reduce ? 'instant' : behavior })
  })
}

/** Stable empties: a fresh `[]` each render would recompute every block. */
const NO_SETS: LoggedSet[] = []
const NO_WORKOUTS: WorkoutFull[] = []

/** Event-time clock (sets are stamped when logged, never during render). */
const nowIso = () => new Date().toISOString()
const nowDate = () => new Date()

const kg = (n: number | null | undefined) => (n == null ? '—' : formatNumber(n))

export function SessionPage() {
  const workout = useActiveWorkout()
  const workouts = useWorkouts()
  if (workouts.isPending) return null
  if (!workout) return <NoActiveSession />
  return <Session key={workout.id} workout={workout} />
}

/**
 * No session open: back to Hoy. Not at once: closing a session empties this screen in the same
 * moment it navigates to the summary, and an immediate redirect used to win that race and send
 * the person home instead of to the summary.
 */
function NoActiveSession() {
  const nav = useNavigate()
  const { pathname } = useLocation()
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (pathname === '/session') nav('/', { replace: true })
    }, 150)
    return () => window.clearTimeout(t)
  }, [nav, pathname])
  return null
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
  const { program } = useActiveProgram()
  // Only shapes the quick-fill previews; the sets themselves are stamped when logged.
  const renderNow = useNow(60_000)
  const { save: saveProgram } = useProgramActions()

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
  const [focus, setFocusState] = useState<number | null>(() => {
    // Back in the app (or reopened after the phone closed it): the exercise that was open.
    const saved = savedFocus(workout.id)
    if (saved !== undefined && (saved === null || saved < blocks.length)) return saved
    const firstOpen = blocks.findIndex((b) => b.doneWork < b.plannedWork)
    return firstOpen === -1 ? null : firstOpen
  })

  // Opening one card closes another, often above it. iOS has no scroll anchoring, so the
  // whole list jumped by the height of the card that closed: keep the card being opened (or
  // tapped) where it was on screen.
  const anchor = useRef<{ index: number; top: number } | null>(null)
  const setFocus = useCallback(
    (next: number | null, keep: number | null = next) => {
      const el = keep == null ? null : document.querySelector(`[data-card="${keep}"]`)
      anchor.current =
        el && keep != null ? { index: keep, top: el.getBoundingClientRect().top } : null
      setFocusState(next)
      saveFocus(workout.id, next)
    },
    [workout.id],
  )
  // Every commit, before paint: a no-op unless a focus change left an anchor.
  useLayoutEffect(() => {
    const a = anchor.current
    if (!a) return
    anchor.current = null
    const el = document.querySelector(`[data-card="${a.index}"]`)
    if (el) window.scrollBy(0, el.getBoundingClientRect().top - a.top)
  })

  // The set to do changed (logged, next exercise, card opened): bring it into view. Without
  // animation the first time, so coming back to the app lands straight on it.
  const activeRow = focus == null ? -1 : (blocks[focus]?.rows.findIndex((r) => !r.done) ?? -1)
  const activeKey = activeRow === -1 ? null : `${focus}:${activeRow}`
  const revealed = useRef(false)
  useEffect(() => {
    if (activeKey == null) return
    revealActiveSet(revealed.current ? 'smooth' : 'instant')
    revealed.current = true
  }, [activeKey])
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
    saveDraft(workout.id, null)
    if (partner) {
      restTimer.stop()
      setFocus(partner.index)
      if (prs.length) toast(prMessage(prs[0]!), 'success')
      queued(saveSets([set]))
      return
    }
    if (!(isLastWork && block.index === blocks.length - 1)) {
      restTimer.start(
        rest,
        isLastWork ? siguienteLabel(blocks, block.index, lookup) : block.exercise.name,
      )
    }
    // On to the next exercise. With none left (the last one, a free session) this card stays
    // open with «Añadir serie» at hand, instead of folding the screen away under the thumb.
    if (isLastWork) {
      const next = blocks.findIndex((b, i) => i > block.index && b.doneWork < b.plannedWork)
      if (next !== -1) setFocus(next)
    }
    if (prs.length) toast(prMessage(prs[0]!), 'success')
    queued(saveSets([set]))
  }

  const addExercise = async (e: Exercise) => {
    const plan = [...workout.plan, slotFor(e)]
    setFocus(plan.length - 1)
    queued(saveWorkout({ ...workout, plan }))
  }

  /**
   * The same swap keeps happening (the machine of the plan is always taken, or another one
   * suits better): offer to make it part of the program, so the next session starts right.
   */
  const offerProgramSwap = (slotId: string, from: Exercise, to: Exercise) => {
    if (!program || workout.programId !== program.id) return
    const day = program.days.find((d) => d.slots.some((s) => s.id === slotId))
    if (!day) return
    toast(`¿Usar ${to.name} siempre en ${day.name}?`, 'info', {
      action: {
        label: 'Guardar',
        onAction: () => {
          queued(
            saveProgram({
              ...program,
              days: program.days.map((d) =>
                d.id !== day.id
                  ? d
                  : {
                      ...d,
                      slots: d.slots.map((s) =>
                        s.id === slotId ? { ...s, exerciseId: to.id, restSec: to.restSec } : s,
                      ),
                    },
              ),
            }),
          )
          toast(`${day.name}: ${from.name} → ${to.name}`, 'success')
        },
      },
    })
  }

  const swapExercise = async (index: number, e: Exercise) => {
    const slot = workout.plan[index]
    if (!slot) return
    offerProgramSwap(slot.id, lookup(slot.exerciseId), e)
    const mine = logged.filter((s) => s.exerciseIndex === index)
    const doneWork = mine.filter((s) => s.kind !== 'warmup').length
    if (doneWork === 0) {
      // Nothing but warm-ups (or nothing): swap in place; those warm-ups were for the old one.
      const plan = workout.plan.map((s, i) =>
        i === index ? { ...s, exerciseId: e.id, restSec: e.restSec } : s,
      )
      // Queued together, sent in this order; the screen does not wait for the network.
      queued(saveWorkout({ ...workout, plan }))
      queued(deleteSets(mine.map((s) => s.id)))
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
    queued(saveWorkout({ ...workout, plan }))
    queued(saveSets(moved))
  }

  /** Log every pending work set of an exercise at once (done while resting, or written later). */
  const fillRemaining = async (block: ExerciseBlock) => {
    const q = quickFill(block, workout.id, logged, nowDate())
    if (!q) return
    const next = blocks.findIndex((b, i) => i > block.index && b.doneWork < b.plannedWork)
    if (next !== -1) setFocus(next)
    const prs = q.sets.flatMap((s) => detectPRs(s, prior(s.exerciseId, s.id)))
    if (prs.length) toast(prMessage(prs[0]!), 'success')
    queued(saveSets(q.sets))
  }

  const addSet = async (index: number) => {
    const plan = workout.plan.map((s, i) => (i === index ? { ...s, sets: s.sets + 1 } : s))
    queued(saveWorkout({ ...workout, plan }))
  }

  const removeExercise = async (index: number) => {
    const ids = logged.filter((s) => s.exerciseIndex === index).map((s) => s.id)
    // Later exercises move up one position: their sets follow.
    const moved = logged
      .filter((s) => s.exerciseIndex > index)
      .map((s) => ({ ...s, exerciseIndex: s.exerciseIndex - 1 }))
    const plan = workout.plan.filter((_, i) => i !== index)
    setFocus(null)
    queued(saveWorkout({ ...workout, plan }))
    queued(deleteSets(ids))
    queued(saveSets(moved))
  }

  const doneSets = logged.filter((s) => s.kind !== 'warmup').length
  const plannedSets = blocks.reduce((a, b) => a + b.plannedWork, 0)

  return (
    // Scroll anchoring off: the focus change above keeps the place by hand, on every browser.
    <div className="min-h-dvh pb-[60vh] [overflow-anchor:none]">
      <SessionHeader
        workout={workout}
        done={doneSets}
        planned={plannedSets}
        onBack={() => nav('/')}
        onFinish={() => setFinishing(true)}
      />
      <div className="px-4">
        <QuickCheckin />
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
              workoutId={workout.id}
              total={blocks.length}
              open={focus === b.index}
              onToggle={() => setFocus(focus === b.index ? null : b.index, b.index)}
              onLog={(row, v) => logSet(b, row, v)}
              onSwap={() => setPicker({ mode: 'swap', index: b.index })}
              onAddSet={() => addSet(b.index)}
              onRemove={() => removeExercise(b.index)}
              onEditSet={async (set) => queued(saveSets([set]))}
              quick={quickFill(b, workout.id, logged, renderNow)}
              onQuick={() => fillRemaining(b)}
              onDeleteSet={async (set) => queued(deleteSets([set.id]))}
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

      <RestPanel sound={me.restSound} />

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
        pending={blocks
          .filter((b) => b.plannedWork > 0 && b.doneWork === 0)
          .map((b) => ({
            key: `${b.index}-${b.exercise.id}`,
            name: b.exercise.name,
            summary: quickFill(b, workout.id, logged, renderNow)?.summary ?? null,
            onLog: () => fillRemaining(b),
          }))}
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
    <header
      data-session-header
      className="safe-top sticky top-0 z-30 mb-4 border-b border-line bg-canvas/90 backdrop-blur-xl"
    >
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
  workoutId,
  total,
  open,
  onToggle,
  onLog,
  onSwap,
  onAddSet,
  onRemove,
  onEditSet,
  onDeleteSet,
  quick,
  onQuick,
  barKg,
  plates,
  allSets,
}: {
  block: ExerciseBlock
  workoutId: string
  total: number
  open: boolean
  onToggle: () => void
  onLog: (row: RowState, v: SetValues) => Promise<void>
  onSwap: () => void
  onAddSet: () => void
  onRemove: () => void
  onEditSet: (set: LoggedSet) => Promise<void>
  onDeleteSet: (set: LoggedSet) => Promise<void>
  quick: QuickFill | null
  onQuick: () => Promise<void>
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
    <li
      data-card={block.index}
      className={clsx('card overflow-hidden', open && 'border-line-strong')}
    >
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
                  workoutId={workoutId}
                  draftAt={`${block.index}:${exercise.id}:${i}`}
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
          {activeRow === -1 ? (
            <button type="button" onClick={onAddSet} className="spec tap-link mt-3 block text-gold">
              + Añadir serie
            </button>
          ) : (
            quick && (
              <button
                type="button"
                onClick={() => void onQuick()}
                className="mt-2 flex min-h-11 w-full items-center justify-between gap-3 text-left"
              >
                <span className="text-[13px] text-ink-2">
                  {quick.source === 'last'
                    ? 'Registrar las que quedan igual que la última'
                    : 'Registrar todas según el objetivo'}
                </span>
                <span className="readout shrink-0 text-[16px] font-semibold text-gold">
                  {quick.summary}
                </span>
              </button>
            )
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
  workoutId,
  draftAt,
  onLog,
  barKg,
  plates,
}: {
  row: RowState
  label: string
  exercise: Exercise
  workoutId: string
  /** Identifies this set for the values typed into it (kept if the app is left). */
  draftAt: string
  onLog: (v: SetValues) => Promise<void>
  barKg: number
  plates: number[]
}) {
  const t = row.target
  const [draft] = useState(() => savedDraft(workoutId, draftAt))
  const [weight, setWeight] = useState(
    draft?.weight ?? (t.weight == null ? '' : formatNumber(t.weight)),
  )
  const [reps, setReps] = useState(draft?.reps ?? String(t.repMin))
  const [rir, setRir] = useState<number | null>(
    draft ? draft.rir : t.kind === 'warmup' ? null : t.rir,
  )
  // Ramp-up set toggle: only offered on work sets of loaded, untimed exercises.
  const [ramp, setRamp] = useState(draft?.ramp ?? false)
  const canRamp = t.kind !== 'warmup' && !exercise.timed
  const { toast } = useToast()

  // What is typed survives leaving the app; logging the set clears it.
  const touched = useRef(Boolean(draft))
  useEffect(() => {
    if (touched.current) saveDraft(workoutId, { at: draftAt, weight, reps, rir, ramp })
  }, [workoutId, draftAt, weight, reps, rir, ramp])
  const edit =
    <V,>(set: (v: V) => void) =>
    (v: V) => {
      touched.current = true
      set(v)
    }

  // This set takes the place of the one just logged, under the same thumb: a double tap on
  // «Serie hecha» logged both. The button listens only once it has been on screen a moment.
  const armed = useRef(false)
  useEffect(() => {
    const timer = window.setTimeout(() => (armed.current = true), 450)
    return () => window.clearTimeout(timer)
  }, [])

  const w = parseNum(weight)
  const r = parseNum(reps)
  const step = exercise.increment || 2.5
  const changeWeight = edit(setWeight)
  const changeReps = edit(setReps)
  const changeRir = edit(setRir)
  const bump = (d: number) =>
    changeWeight(formatNumber(Math.max(0, Math.round(((w ?? 0) + d) * 100) / 100)))
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
        <HoldTimer seconds={reps} onSeconds={changeReps} target={t.repMin} />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Stepper
            label={exercise.bodyweight ? 'Lastre kg' : 'Kg'}
            value={weight}
            onChange={changeWeight}
            onMinus={() => bump(-step)}
            onPlus={() => bump(step)}
            decimal
          />
          <Stepper
            label="Reps"
            value={reps}
            onChange={changeReps}
            onMinus={() => changeReps(String(Math.max(0, (r ?? 0) - 1)))}
            onPlus={() => changeReps(String((r ?? 0) + 1))}
          />
        </div>
      )}
      {canRamp && (
        <button
          type="button"
          role="switch"
          aria-checked={ramp}
          onClick={() => edit(setRamp)(!ramp)}
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
                onClick={() => changeRir(rir === n ? null : n)}
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
        // A loaded exercise needs its weight; bodyweight (lastre 0) and held sets do not.
        disabled={r == null || (w == null && !exercise.bodyweight && !exercise.timed)}
        leading={<Check className="size-5" strokeWidth={2.6} />}
        onClick={() => {
          if (!armed.current) return
          armed.current = false
          window.setTimeout(() => (armed.current = true), 450)
          // The write is queued, not awaited: the next set shows at once.
          onLog(
            exercise.timed
              ? { weight: null, reps: r, rir: null }
              : { weight: w, reps: r, rir: ramp ? null : rir, ramp },
          ).catch(() => toast('No se pudo registrar la serie', 'error'))
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
