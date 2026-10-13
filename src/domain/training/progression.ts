/**
 * Progression engine: double progression (reps first, then load) autoregulated by RIR.
 *
 * Pure: everything it needs comes in through parameters (the exercise catalog is not imported).
 *
 * Decision order for {@link recommend}:
 *  1. No usable history                         → `first_time` (weights null, how to pick a load).
 *  2. `deload`                                  → `deload` (≈90 % load, half the sets, RIR + 2).
 *  3. Best-set e1RM fell > 3 % two sessions in a row → `reduce` (−5…10 %, check sleep/rest).
 *  4. Best-set e1RM fell > 3 % vs the session before → `hold` (repeat the same load and reps).
 *  5. Every prescribed set reached `repMax` at ≥ target RIR → `add_weight`
 *     (on an `easy` readiness day this becomes `hold`: no load jumps when under-recovered).
 *  6. Otherwise                                 → `add_reps` (same load, +1 rep per set).
 *
 * Readiness `easy` also adds 1 to the target RIR of every work set.
 */
import type {
  Exercise,
  LoggedSet,
  ReadinessLevel,
  Recommendation,
  SetKind,
  SetTarget,
  Slot,
} from '../types'
import { estimate1RM, roundToIncrement } from './e1rm'
import { formatKg, formatNumber } from './format'

/** The slice of {@link Exercise} the engine needs. */
export type ProgressionExercise = Pick<
  Exercise,
  'increment' | 'compound' | 'pattern' | 'equipment' | 'bodyweight'
>

export interface HistorySession {
  /** ISO date/timestamp of the session. */
  date: string
  /** Sets of this exercise in that session. Warm-ups and drop sets are ignored. */
  sets: LoggedSet[]
}

export interface RecommendInput {
  slot: Slot
  exercise: ProgressionExercise
  /** Previous sessions of this exercise, most recent first. */
  history: HistorySession[]
  deload?: boolean
  readiness?: ReadinessLevel
  /** User bodyweight (kg). Only used to compare e1RM on bodyweight exercises. */
  bodyweight?: number
}

/** A bar is assumed to weigh this much for warm-ups on `barbell` exercises. */
export const BARBELL_KG = 20
/** Compounds below this work weight get no warm-up ramp (the first work set is warm-up enough). */
export const WARMUP_MIN_WORK_KG = 30
/** Relative drop of best-set e1RM that counts as a performance dip. */
export const E1RM_DROP_THRESHOLD = 0.03
/** RIR assigned to warm-up targets: they must stay far from failure. */
export const WARMUP_RIR = 5

const WARMUP_RAMP: readonly { pct: number; reps: number }[] = [
  { pct: 0.4, reps: 8 },
  { pct: 0.6, reps: 5 },
  { pct: 0.8, reps: 3 },
]

const PROGRESSION_KINDS: ReadonlySet<SetKind> = new Set<SetKind>(['work', 'failure'])

interface DoneSet {
  weight: number
  reps: number
  rir: number | null
}

interface Session {
  date: string
  sets: DoneSet[]
}

/* ───────────── helpers ───────────── */

function usableSets(sets: LoggedSet[], isBodyweight: boolean): DoneSet[] {
  return [...sets]
    .filter((s) => PROGRESSION_KINDS.has(s.kind))
    .toSorted((a, b) => a.setIndex - b.setIndex)
    .flatMap((s): DoneSet[] => {
      if (s.reps == null || !Number.isFinite(s.reps) || s.reps < 1) return []
      // Bodyweight exercises log the extra load (lastre); null means "no extra load".
      const weight = s.weight ?? (isBodyweight ? 0 : null)
      if (weight == null || !Number.isFinite(weight) || weight < 0) return []
      const rir = s.rir != null && Number.isFinite(s.rir) && s.rir >= 0 ? s.rir : null
      return [{ weight, reps: s.reps, rir }]
    })
}

function topWeight(s: Session): number {
  return Math.max(...s.sets.map((x) => x.weight))
}

function bestE1rm(s: Session, extraLoad: number): number | null {
  let best: number | null = null
  for (const x of s.sets) {
    const e = estimate1RM(x.weight + extraLoad, x.reps, x.rir)
    if (e != null && (best == null || e > best)) best = e
  }
  return best
}

/**
 * Relative e1RM drop from `older` to `newer` (0.05 = 5 %), or null when there is no meaningful
 * drop. A session done with a *lighter* top load is never counted as a dip: lower loads are
 * usually intentional (deload, a previous `reduce`) and Epley under-rates high-rep sets.
 */
function dropBetween(newer: Session, older: Session, extraLoad: number): number | null {
  const a = bestE1rm(newer, extraLoad)
  const b = bestE1rm(older, extraLoad)
  if (a == null || b == null || b <= 0) return null
  if (topWeight(newer) + 1e-9 < topWeight(older)) return null
  const drop = (b - a) / b
  return drop > E1RM_DROP_THRESHOLD ? drop : null
}

function isLowerBodyBarbell(ex: ProgressionExercise): boolean {
  return (
    ex.compound &&
    ex.equipment === 'barbell' &&
    (ex.pattern === 'squat' || ex.pattern === 'hinge' || ex.pattern === 'lunge')
  )
}

function loadText(w: number, isBodyweight: boolean): string {
  if (!isBodyweight) return formatKg(w)
  return w === 0 ? 'peso corporal' : `${formatKg(w)} de lastre`
}

/** [10,10,10,10] → "4×10"; [9,9,8,8] → "9-9-8-8". */
export function formatRepScheme(reps: number[]): string {
  if (reps.length === 0) return ''
  const first = reps[0]
  if (reps.every((r) => r === first)) return `${reps.length}×${first}`
  return reps.join('-')
}

/** " a RIR 2" / " a RIR 1-2" / "" when any set lacks RIR. */
function rirText(sets: DoneSet[]): string {
  const rirs = sets.map((s) => s.rir)
  if (rirs.length === 0 || rirs.some((r) => r == null)) return ''
  const nums = rirs as number[]
  const lo = Math.min(...nums)
  const hi = Math.max(...nums)
  return lo === hi ? ` a RIR ${formatNumber(lo)}` : ` a RIR ${formatNumber(lo)}-${formatNumber(hi)}`
}

function rirPhrase(rir: number): string {
  if (rir <= 0) return 'llegando al fallo técnico (RIR 0)'
  if (rir === 1) return 'dejando 1 rep en recámara (RIR 1)'
  return `dejando ${formatNumber(rir)} reps en recámara (RIR ${formatNumber(rir)})`
}

function workTargets(
  count: number,
  firstIndex: number,
  weightAt: (i: number) => number | null,
  repMinAt: (i: number) => number,
  repMax: number,
  rir: number,
): SetTarget[] {
  return Array.from({ length: count }, (_, i) => ({
    setIndex: firstIndex + i,
    kind: 'work' as const,
    weight: weightAt(i),
    repMin: repMinAt(i),
    repMax,
    rir,
  }))
}

/**
 * Warm-up ramp for a compound lift: ~40 %×8, 60 %×5, 80 %×3 of the work weight, rounded to the
 * exercise increment. Barbell lifts start with the empty bar (20 kg ×10) and skip any step that
 * would be at or below the bar. Steps that round to the same load (or reach the work weight) are
 * dropped. Returns `[]` for isolation or bodyweight exercises and for work weights < 30 kg.
 *
 * `setIndex` starts at 0: warm-ups come first in the exercise's set order.
 */
export function buildWarmups(
  workWeight: number | null,
  exercise: Pick<Exercise, 'compound' | 'equipment' | 'increment' | 'bodyweight'>,
): SetTarget[] {
  if (workWeight == null || !exercise.compound || exercise.bodyweight) return []
  if (workWeight < WARMUP_MIN_WORK_KG) return []
  const isBarbell = exercise.equipment === 'barbell'
  const steps: { weight: number; reps: number }[] = []
  if (isBarbell && workWeight > BARBELL_KG) steps.push({ weight: BARBELL_KG, reps: 10 })
  for (const { pct, reps } of WARMUP_RAMP) {
    const w = roundToIncrement(workWeight * pct, exercise.increment, 'nearest')
    const prev = steps[steps.length - 1]?.weight ?? 0
    if (w <= 0 || w <= prev || w >= workWeight) continue
    if (isBarbell && w <= BARBELL_KG) continue
    steps.push({ weight: w, reps })
  }
  return steps.map((s, i) => ({
    setIndex: i,
    kind: 'warmup' as const,
    weight: s.weight,
    repMin: s.reps,
    repMax: s.reps,
    rir: WARMUP_RIR,
  }))
}

/* ───────────── recommend ───────────── */

/**
 * Next-session prescription for one slot. See the module header for the decision order.
 *
 * Assumptions worth knowing:
 *  - Only `work` and `failure` sets drive progression; `warmup` and `drop` are ignored, as are
 *    sets with no reps. Sessions with no usable sets are skipped.
 *  - `add_weight` requires at least `slot.sets` usable sets in the last session: hitting the top
 *    of the range on 2 of 4 prescribed sets is not a completed prescription.
 *  - Lower-body barbell compounds (squat/hinge/lunge) jump 2 increments when every set was left
 *    ≥ 3 reps *above* the target RIR (clearly too light).
 *  - Bodyweight exercises: weights are extra load (lastre) and may be 0. For e1RM comparisons the
 *    user's `bodyweight` is added when known; with lastre 0 and no bodyweight, dips can't be
 *    measured and the dip rules are skipped.
 */
export function recommend(input: RecommendInput): Recommendation {
  const { slot, exercise } = input
  const isBw = Boolean(exercise.bodyweight)
  const easy = input.readiness === 'easy'
  const inc = exercise.increment
  const targetRir = slot.rir + (easy ? 1 : 0)
  const easyNote = easy
    ? ` Hoy, con la recuperación baja, deja una rep más en recámara (RIR ${formatNumber(targetRir)}).`
    : ''

  const sessions: Session[] = input.history
    .map((h) => ({ date: h.date, sets: usableSets(h.sets, isBw) }))
    .filter((s) => s.sets.length > 0)

  const last = sessions[0]

  /* 1. First time */
  if (!last) {
    const count = input.deload ? Math.max(1, Math.round(slot.sets / 2)) : slot.sets
    const rir = targetRir + (input.deload ? 2 : 0)
    const range = `${slot.repMin}-${slot.repMax} reps`
    const message = isBw
      ? `Primera vez: empieza sin lastre y busca ${range} ${rirPhrase(rir)}. Si te sobran más de 3 reps, añade lastre la próxima vez.`
      : `Primera vez: haz un par de series ligeras y elige un peso con el que completes ${range} ${rirPhrase(rir)}. Si te sobran más, súbelo en la siguiente serie.`
    return {
      exerciseId: slot.exerciseId,
      reason: 'first_time',
      message,
      warmups: [],
      work: workTargets(
        count,
        0,
        () => (isBw ? 0 : null),
        () => slot.repMin,
        slot.repMax,
        rir,
      ),
      last: null,
    }
  }

  const lastOut: Recommendation['last'] = {
    date: last.date,
    sets: last.sets.map((s) => ({ weight: s.weight, reps: s.reps, rir: s.rir })),
  }
  const top = topWeight(last)
  const extraLoad = isBw ? (input.bodyweight ?? 0) : 0
  const lastReps = last.sets.map((s) => s.reps)
  const repsAt = (i: number): number => lastReps[i] ?? lastReps[lastReps.length - 1] ?? slot.repMin
  const weightAt = (i: number): number => last.sets[i]?.weight ?? top

  const finish = (
    reason: Recommendation['reason'],
    message: string,
    work: Omit<SetTarget, 'setIndex' | 'kind'>[],
  ): Recommendation => {
    const workWeight = work.reduce<number | null>(
      (m, w) => (w.weight == null ? m : Math.max(m ?? 0, w.weight)),
      null,
    )
    const warmups = buildWarmups(workWeight, exercise)
    return {
      exerciseId: slot.exerciseId,
      reason,
      message,
      warmups,
      work: work.map((w, i) => ({ ...w, setIndex: warmups.length + i, kind: 'work' })),
      last: lastOut,
    }
  }

  const uniform = (n: number, w: number | null, repMin: number, rir: number) =>
    Array.from({ length: n }, () => ({ weight: w, repMin, repMax: slot.repMax, rir }))

  /* 2. Deload */
  if (input.deload) {
    const w = roundToIncrement(top * 0.9, inc, 'nearest')
    const n = Math.max(1, Math.round(slot.sets / 2))
    const rir = targetRir + 2
    return finish(
      'deload',
      `Semana de descarga: ${loadText(w, isBw)}, ${n} ${n === 1 ? 'serie' : 'series'} de ${slot.repMin}-${slot.repMax} reps a RIR ${formatNumber(rir)}. Recupera para volver a apretar la semana que viene.`,
      uniform(n, w, slot.repMin, rir),
    )
  }

  /* 3–4. Performance dips */
  const prev = sessions[1]
  const prev2 = sessions[2]
  const drop1 = prev ? dropBetween(last, prev, extraLoad) : null
  const drop2 = prev && prev2 && drop1 != null ? dropBetween(prev, prev2, extraLoad) : null

  if (drop1 != null && drop2 != null) {
    // Two dips in a row: back off 5–10 %.
    // ≥ 5 % lighter, rounded down to the increment (≈ 5–10 % with usual increments; more when
    // the increment is coarse relative to the load, e.g. 20 kg on a 5 kg stack).
    let w = roundToIncrement(top * 0.95, inc, 'down')
    if (w >= top) w = top - inc
    w = Math.max(0, w)
    const pct = top > 0 ? Math.round(((top - w) / top) * 100) : 0
    const tail =
      'tu rendimiento ha caído dos sesiones seguidas. Revisa descanso, sueño y comida antes de volver a subir.'
    const message =
      w < top
        ? `Baja a ${loadText(w, isBw)} (−${pct} %) y busca ${slot.repMin}-${slot.repMax} reps: ${tail}`
        : `Quédate en ${loadText(w, isBw)} y deja más reps en recámara (RIR ${formatNumber(targetRir + 1)}): ${tail}`
    const rir = w < top ? targetRir : targetRir + 1
    return finish('reduce', message + easyNote, uniform(slot.sets, w, slot.repMin, rir))
  }

  if (drop1 != null) {
    const reps = Array.from({ length: slot.sets }, (_, i) => Math.min(repsAt(i), slot.repMax))
    const sameLoad = last.sets.every((s) => s.weight === top)
    const load = sameLoad ? loadText(top, isBw) : 'las mismas cargas'
    return finish(
      'hold',
      `Repite ${load} y busca ${formatRepScheme(reps)} reps: rendiste un ${Math.round(drop1 * 100)} % menos que la sesión anterior.${easyNote}`,
      reps.map((r, i) => ({ weight: weightAt(i), repMin: r, repMax: slot.repMax, rir: targetRir })),
    )
  }

  /* 5. Top of the range on every prescribed set → add load */
  const completed =
    last.sets.length >= slot.sets &&
    last.sets.every((s) => s.reps >= slot.repMax && (s.rir == null || s.rir >= slot.rir))

  if (completed) {
    const scheme = `${formatRepScheme(lastReps)}${rirText(last.sets)}`
    const veryEasy = last.sets.every((s) => s.rir != null && s.rir >= slot.rir + 3)
    const step = isLowerBodyBarbell(exercise) && veryEasy ? 2 * inc : inc
    // Not re-rounded: the current load may not be a multiple of the increment (22,5 kg + 2 kg).
    const next = Math.round((top + step) * 1000) / 1000

    if (easy) {
      return finish(
        'hold',
        `Hoy mantén ${loadText(top, isBw)}: tocaba subir a ${loadText(next, isBw)} (completaste ${scheme}), pero tu recuperación está baja. Busca ${slot.repMax} reps por serie a RIR ${formatNumber(targetRir)}.`,
        uniform(slot.sets, top, slot.repMax, targetRir),
      )
    }
    const head = isBw ? `Sube el lastre a ${formatKg(next)}` : `Sube a ${formatKg(next)}`
    return finish(
      'add_weight',
      `${head}: completaste ${scheme}. Busca al menos ${slot.repMin} reps por serie.`,
      uniform(slot.sets, next, slot.repMin, targetRir),
    )
  }

  /* 6. Chase reps at the same load */
  // Sets the last session did not reach (one top set after a pyramid) start at the bottom of the
  // range: +1 on reps never done would ask for more than was ever done at this load.
  const goal = Array.from({ length: slot.sets }, (_, i) =>
    i < lastReps.length ? Math.min(repsAt(i) + 1, slot.repMax) : slot.repMin,
  )
  const sameLoad = Array.from({ length: slot.sets }, (_, i) => weightAt(i)).every((w) => w === top)
  const load = sameLoad ? loadText(top, isBw) : 'las mismas cargas'
  return finish(
    'add_reps',
    `Mantén ${load} y busca ${formatRepScheme(goal)} reps (la última vez ${formatRepScheme(lastReps)}${rirText(last.sets)}).${easyNote}`,
    goal.map((r, i) => ({ weight: weightAt(i), repMin: r, repMax: slot.repMax, rir: targetRir })),
  )
}

/* ───────────── intra-session adjustment ───────────── */

export interface AdjustNextSetInput {
  /** Planned target of the next set (its reps/RIR are also the reference for the set just done). */
  target: SetTarget
  done: { weight: number | null; reps: number | null; rir: number | null }
  increment: number
}

/**
 * Adjusts the load of the next set from how the last one went. Only the weight changes; the rest
 * of `target` is returned as is.
 *  - Too hard (RIR ≤ target − 2, or reps < repMin) → ≈ −5 %, rounded down to the increment
 *    (always at least one increment lighter, never below 0).
 *  - Too easy (RIR ≥ target + 3 and reps ≥ repMax) → + 1 increment.
 *  - Otherwise → keep the weight actually used.
 * A null RIR only allows the "reps < repMin" rule. With no weight to start from (`done.weight`
 * and `target.weight` null), the target is returned unchanged.
 */
export function adjustNextSet({ target, done, increment }: AdjustNextSetInput): SetTarget {
  const base = done.weight ?? target.weight
  if (base == null || done.reps == null) return target
  const tooHard = (done.rir != null && done.rir <= target.rir - 2) || done.reps < target.repMin
  if (tooHard) {
    let w = roundToIncrement(base * 0.95, increment, 'down')
    if (w >= base) w = base - increment
    return { ...target, weight: Math.max(0, w) }
  }
  const tooEasy = done.rir != null && done.rir >= target.rir + 3 && done.reps >= target.repMax
  if (tooEasy) return { ...target, weight: Math.round((base + increment) * 1000) / 1000 }
  return { ...target, weight: base }
}
