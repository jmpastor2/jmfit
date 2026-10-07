/**
 * Goal values: where each goal stands today, its history (for the ETA), whether it is reached,
 * how the projected date compares with the deadline, and one-tap suggestions from the data.
 * Pure functions: the clock comes in as `now`.
 */
import {
  addLocalDays,
  bestsByExercise,
  formatNumber,
  goalProgress,
  localDateKey,
  projectDate,
  roundToIncrement,
  startOfLocalWeek,
} from '@/domain/training'
import type { GoalKind, LoggedSet, Scan, UserGoal, Workout } from '@/domain/types'
import {
  currentE1rm,
  e1rmSeries,
  exerciseSessions,
  latestBodyweight,
} from '@/features/exercise/stats'

const DAY_MS = 86_400_000

export interface GoalData {
  sets: readonly LoggedSet[]
  workouts: readonly Pick<Workout, 'id' | 'name' | 'startedAt' | 'bodyweight'>[]
  scans: readonly Scan[]
}

export const GOAL_KIND_LABEL: Record<GoalKind, string> = {
  e1rm: '1RM de un ejercicio',
  lift: 'Levantar X kg × N reps',
  bodyweight: 'Peso corporal',
  bodyfat: '% de grasa',
  muscle: 'Masa muscular',
  frequency: 'Sesiones por semana',
}

export const needsExercise = (k: GoalKind) => k === 'e1rm' || k === 'lift'

export function goalUnit(kind: GoalKind): string {
  return kind === 'bodyfat' ? '%' : kind === 'frequency' ? 'ses/sem' : 'kg'
}

/** "82,5 kg", "13 %", "4,5 ses/sem". */
export function formatGoalValue(kind: GoalKind, v: number): string {
  const unit = goalUnit(kind)
  return `${formatNumber(v, 1)} ${unit}`
}

/** Title of a goal, e.g. "Press banca · 1RM 110 kg", "Grasa 13 %". */
export function goalTitle(goal: UserGoal, exerciseName: string | null): string {
  const t = formatGoalValue(goal.kind, goal.target)
  switch (goal.kind) {
    case 'e1rm':
      return `${exerciseName ?? 'Ejercicio'} · 1RM ${t}`
    case 'lift':
      return `${exerciseName ?? 'Ejercicio'} · ${formatNumber(goal.target)} kg × ${goal.reps ?? 1}`
    case 'bodyweight':
      return `Peso corporal ${t}`
    case 'bodyfat':
      return `Grasa ${t}`
    case 'muscle':
      return `Masa muscular ${t}`
    case 'frequency':
      return `${formatNumber(goal.target, 1)} sesiones por semana`
  }
}

/** Sessions per week, averaged over the last `weeks` × 7 days ending at `now`. */
export function sessionsPerWeek(
  workouts: readonly Pick<Workout, 'startedAt'>[],
  now: Date,
  weeks = 4,
): number {
  const from = now.getTime() - weeks * 7 * DAY_MS
  const n = workouts.filter((w) => {
    const t = Date.parse(w.startedAt)
    return t > from && t <= now.getTime()
  }).length
  return Math.round((n / weeks) * 10) / 10
}

/** Heaviest weight lifted for at least `reps` reps (all time), or null. */
export function bestForReps(
  exerciseId: string,
  sets: readonly LoggedSet[],
  reps: number,
): number | null {
  const mine = sets.filter((s) => s.exerciseId === exerciseId)
  return bestsByExercise([...mine])[exerciseId]?.repPRs[Math.max(1, Math.round(reps))] ?? null
}

const lastScanValue = (scans: readonly Scan[], key: 'peso' | 'grasa' | 'musculo') => {
  for (let i = scans.length - 1; i >= 0; i--) {
    const v = scans[i]?.[key]
    if (v != null) return v
  }
  return null
}

/** Where the goal stands now, from the data. Null when there is nothing to measure yet. */
export function goalCurrent(
  goal: Pick<UserGoal, 'kind' | 'exerciseId' | 'reps'>,
  d: GoalData,
  now: Date,
): number | null {
  switch (goal.kind) {
    case 'e1rm':
      return goal.exerciseId ? (currentE1rm(goal.exerciseId, d.sets, now)?.value ?? null) : null
    case 'lift':
      return goal.exerciseId ? bestForReps(goal.exerciseId, d.sets, goal.reps ?? 1) : null
    case 'bodyweight':
      return latestBodyweight(d.scans, d.workouts)?.value ?? null
    case 'bodyfat':
      return lastScanValue(d.scans, 'grasa')
    case 'muscle':
      return lastScanValue(d.scans, 'musculo')
    case 'frequency':
      return d.workouts.length ? sessionsPerWeek(d.workouts, now) : null
  }
}

/** Past values of what the goal measures, oldest first (for the projection). */
export function goalHistory(
  goal: UserGoal,
  d: GoalData,
  now: Date,
): { date: string; value: number }[] {
  switch (goal.kind) {
    case 'e1rm':
      return goal.exerciseId ? e1rmSeries(exerciseSessions(goal.exerciseId, d.sets)) : []
    case 'lift': {
      if (!goal.exerciseId) return []
      const reps = Math.max(1, goal.reps ?? 1)
      // Running best weight for ≥ N reps, one point per session.
      const sessions = exerciseSessions(goal.exerciseId, d.sets).toReversed()
      const out: { date: string; value: number }[] = []
      let best = 0
      for (const s of sessions) {
        for (const x of s.sets) {
          if (x.kind !== 'warmup' && (x.reps ?? 0) >= reps && (x.weight ?? 0) > best)
            best = x.weight ?? 0
        }
        if (best > 0) out.push({ date: s.date, value: best })
      }
      return out
    }
    case 'bodyweight': {
      const pts = new Map<string, number>()
      for (const s of d.scans) if (s.peso != null) pts.set(s.date, s.peso)
      for (const w of d.workouts) {
        const day = w.startedAt.slice(0, 10)
        if (w.bodyweight != null && !pts.has(day)) pts.set(day, w.bodyweight)
      }
      return [...pts.entries()]
        .map(([date, value]) => ({ date, value }))
        .toSorted((a, b) => a.date.localeCompare(b.date))
    }
    case 'bodyfat':
    case 'muscle': {
      const key = goal.kind === 'bodyfat' ? 'grasa' : 'musculo'
      return d.scans.flatMap((s) => (s[key] != null ? [{ date: s.date, value: s[key] }] : []))
    }
    case 'frequency': {
      // Sessions per complete week since the goal started (at least the last 8 weeks).
      const thisWeek = startOfLocalWeek(now)
      const since = Math.min(Date.parse(goal.startDate), now.getTime() - 8 * 7 * DAY_MS)
      const out: { date: string; value: number }[] = []
      for (let i = 1; i <= 104; i++) {
        const from = addLocalDays(thisWeek, -7 * i)
        if (from.getTime() < since - 7 * DAY_MS) break
        const to = addLocalDays(from, 7)
        const n = d.workouts.filter((w) => {
          const t = Date.parse(w.startedAt)
          return t >= from.getTime() && t < to.getTime()
        }).length
        out.push({ date: localDateKey(from), value: n })
      }
      return out.toReversed()
    }
  }
}

/** Direction of the goal: +1 going up, −1 going down, 0 unknown. */
export function goalDirection(goal: Pick<UserGoal, 'kind' | 'start' | 'target'>): number {
  if (goal.start != null && goal.start !== goal.target) return Math.sign(goal.target - goal.start)
  if (
    goal.kind === 'e1rm' ||
    goal.kind === 'lift' ||
    goal.kind === 'frequency' ||
    goal.kind === 'muscle'
  )
    return 1
  if (goal.kind === 'bodyfat') return -1
  return 0
}

export function isReached(goal: UserGoal, current: number | null): boolean {
  if (current == null) return false
  const dir = goalDirection(goal)
  if (dir > 0) return current >= goal.target - 1e-9
  if (dir < 0) return current <= goal.target + 1e-9
  return Math.abs(current - goal.target) < 0.05
}

export type Pace = 'reached' | 'ahead' | 'behind' | 'no_deadline' | 'unknown'

export interface GoalStatus {
  current: number | null
  progress: number | null
  reached: boolean
  eta: Date | null
  pace: Pace
  /** Days to the deadline (negative when past), null without one. */
  daysLeft: number | null
}

export function goalStatus(goal: UserGoal, d: GoalData, now: Date): GoalStatus {
  const current = goalCurrent(goal, d, now)
  const reached = goal.achievedAt != null || isReached(goal, current)
  const progress = reached ? 1 : goalProgress(goal, current)
  const deadline = goal.deadline ? new Date(goal.deadline + 'T23:59:59') : null
  const daysLeft = deadline ? Math.ceil((deadline.getTime() - now.getTime()) / DAY_MS) : null
  if (reached) return { current, progress, reached, eta: null, pace: 'reached', daysLeft }
  const eta = projectDate(goalHistory(goal, d, now), goal.target, now)
  let pace: Pace
  if (!deadline) pace = eta ? 'no_deadline' : 'unknown'
  else if (daysLeft != null && daysLeft < 0) pace = 'behind'
  else if (!eta) pace = historyIsEnough(goal, d, now) ? 'behind' : 'unknown'
  else pace = eta.getTime() <= deadline.getTime() ? 'ahead' : 'behind'
  return { current, progress, reached, eta, pace, daysLeft }
}

/** With 3+ points the projection is meaningful: no ETA then means flat or going the wrong way. */
function historyIsEnough(goal: UserGoal, d: GoalData, now: Date): boolean {
  return goalHistory(goal, d, now).length >= 3
}

export interface GoalSuggestion {
  key: string
  label: string
  goal: Omit<UserGoal, 'id'>
}

export interface SuggestInput extends GoalData {
  now: Date
  /** Main lifts to suggest strength goals for, most trained first. */
  lifts: { id: string; name: string; increment: number }[]
  existing: readonly UserGoal[]
  /** Weekly sessions the person plans (profile). */
  weeklyTarget: number | null
}

const plusDays = (now: Date, days: number) => localDateKey(new Date(now.getTime() + days * DAY_MS))

/** One-tap goals from the person's own numbers. Never repeats an active goal. */
export function goalSuggestions(input: SuggestInput): GoalSuggestion[] {
  const { now, existing } = input
  const today = localDateKey(now)
  const has = (kind: GoalKind, exerciseId: string | null = null) =>
    existing.some((g) => !g.achievedAt && g.kind === kind && g.exerciseId === exerciseId)
  const out: GoalSuggestion[] = []

  for (const lift of input.lifts.slice(0, 2)) {
    if (has('e1rm', lift.id)) continue
    const cur = currentE1rm(lift.id, input.sets, now)
    if (!cur) continue
    const target = roundToIncrement(cur.value * 1.05, lift.increment || 2.5, 'nearest')
    if (target <= cur.value) continue
    out.push({
      key: `e1rm:${lift.id}`,
      label: `${lift.name} 1RM +5 % en 8 semanas`,
      goal: {
        kind: 'e1rm',
        exerciseId: lift.id,
        reps: null,
        target,
        start: cur.value,
        startDate: today,
        deadline: plusDays(now, 56),
        achievedAt: null,
      },
    })
  }

  const fat = lastScanValue(input.scans, 'grasa')
  if (fat != null && fat > 11 && !has('bodyfat')) {
    const target = Math.max(10, Math.floor(fat) - 2)
    out.push({
      key: 'bodyfat',
      label: `Bajar a ${formatNumber(target)} % de grasa`,
      goal: {
        kind: 'bodyfat',
        exerciseId: null,
        reps: null,
        target,
        start: fat,
        startDate: today,
        deadline: plusDays(now, 84),
        achievedAt: null,
      },
    })
  }

  const muscle = lastScanValue(input.scans, 'musculo')
  if (muscle != null && !has('muscle')) {
    const target = Math.round((muscle + 1) * 10) / 10
    out.push({
      key: 'muscle',
      label: `Ganar 1 kg de músculo en 12 semanas`,
      goal: {
        kind: 'muscle',
        exerciseId: null,
        reps: null,
        target,
        start: muscle,
        startDate: today,
        deadline: plusDays(now, 84),
        achievedAt: null,
      },
    })
  }

  if (input.weeklyTarget && input.weeklyTarget > 0 && !has('frequency')) {
    const cur = sessionsPerWeek(input.workouts, now)
    if (cur < input.weeklyTarget) {
      out.push({
        key: 'frequency',
        label: `Entrenar ${input.weeklyTarget} días por semana`,
        goal: {
          kind: 'frequency',
          exerciseId: null,
          reps: null,
          target: input.weeklyTarget,
          start: cur,
          startDate: today,
          deadline: plusDays(now, 28),
          achievedAt: null,
        },
      })
    }
  }
  return out
}
