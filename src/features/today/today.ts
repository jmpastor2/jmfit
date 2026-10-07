/**
 * Pure logic behind the Hoy screen: this week's work, recent records, body scan status and the
 * current value of each goal.
 */
import type { WorkoutFull } from '@/data/rows'
import {
  addLocalDays,
  bestsByExercise,
  isEffectiveSet,
  localDateKey,
  startOfLocalWeek,
  tonnage,
  type TonnageOptions,
} from '@/domain/training'
import type { LoggedSet, PersonalRecord, Scan, UserGoal } from '@/domain/types'
import { PR_RANK, recordsBySet } from '@/features/train/history'

const DAY_MS = 86_400_000
const ms = (iso: string) => new Date(iso).getTime()
const inRange = (iso: string, a: Date, b: Date) => ms(iso) >= a.getTime() && ms(iso) < b.getTime()

/** «Buenos días» / «Buenas tardes» / «Buenas noches». */
export function greeting(now: Date): string {
  const h = now.getHours()
  if (h >= 6 && h < 14) return 'Buenos días'
  if (h >= 14 && h < 21) return 'Buenas tardes'
  return 'Buenas noches'
}

/** Program day ids done (finished or in progress) in the local week of `now`. */
export function doneDayIdsThisWeek(
  workouts: readonly WorkoutFull[],
  programId: string,
  now: Date,
): Set<string> {
  const from = startOfLocalWeek(now).getTime()
  const out = new Set<string>()
  for (const w of workouts) {
    if (w.programId !== programId || !w.dayId) continue
    if (new Date(w.startedAt).getTime() >= from) out.add(w.dayId)
  }
  return out
}

/** A finished workout started today (local), the most recent one. */
export function finishedToday(workouts: readonly WorkoutFull[], now: Date): WorkoutFull | null {
  const today = localDateKey(now)
  return (
    workouts
      .filter((w) => w.endedAt && localDateKey(new Date(w.startedAt)) === today)
      .toSorted((a, b) => b.startedAt.localeCompare(a.startedAt))[0] ?? null
  )
}

export interface WeekSummary {
  /** Monday → Sunday: whether a session was started that day. */
  days: boolean[]
  /** Index of today in `days`. */
  todayIndex: number
  sessions: number
  sets: number
  tonnage: number
  /** The previous week up to the same moment, for a fair comparison. */
  prevSets: number
  prevTonnage: number
}

/**
 * This week (Monday 00:00 → now) against the previous week up to the same weekday and hour,
 * so a Wednesday is not compared with a whole week.
 */
export function weekSummary(
  workouts: readonly WorkoutFull[],
  sets: readonly LoggedSet[],
  now: Date,
  opts: TonnageOptions = {},
): WeekSummary {
  const start = startOfLocalWeek(now)
  const prevStart = addLocalDays(start, -7)
  const prevNow = addLocalDays(now, -7)
  const end = new Date(now.getTime() + 1)
  const prevEnd = new Date(prevNow.getTime() + 1)

  const days = Array.from({ length: 7 }, () => false)
  let sessions = 0
  for (const w of workouts) {
    if (!inRange(w.startedAt, start, addLocalDays(start, 7))) continue
    const d = new Date(w.startedAt)
    days[(d.getDay() + 6) % 7] = true
    sessions++
  }
  const cur = sets.filter((s) => inRange(s.doneAt, start, end))
  const prev = sets.filter((s) => inRange(s.doneAt, prevStart, prevEnd))
  return {
    days,
    todayIndex: (now.getDay() + 6) % 7,
    sessions,
    sets: cur.filter(isEffectiveSet).length,
    tonnage: tonnage(cur, opts),
    prevSets: prev.filter(isEffectiveSet).length,
    prevTonnage: tonnage(prev, opts),
  }
}

/**
 * Records set in the last `days` days, one per exercise: the most meaningful kind (1RM, then
 * weight, then reps) at its best value in the window. Newest first.
 */
export function recentRecords(sets: readonly LoggedSet[], now: Date, days = 14): PersonalRecord[] {
  const since = now.getTime() - days * DAY_MS
  const bySet = recordsBySet(sets)
  const best = new Map<string, PersonalRecord>()
  for (const prs of bySet.values()) {
    for (const pr of prs) {
      if (new Date(pr.date).getTime() < since) continue
      const cur = best.get(pr.exerciseId)
      if (
        !cur ||
        PR_RANK[pr.kind] < PR_RANK[cur.kind] ||
        (pr.kind === cur.kind && pr.value > cur.value)
      ) {
        best.set(pr.exerciseId, pr)
      }
    }
  }
  return [...best.values()].toSorted((a, b) => b.date.localeCompare(a.date))
}

export interface ScanStatus {
  last: Scan
  previous: Scan | null
  daysAgo: number
}

/** Latest scan (scans come oldest first), the one before it and how old it is in local days. */
export function scanStatus(scans: readonly Scan[], now: Date): ScanStatus | null {
  const last = scans.at(-1)
  if (!last) return null
  const d = new Date(last.date.slice(0, 10) + 'T00:00:00')
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const daysAgo = Math.max(0, Math.round((today.getTime() - d.getTime()) / DAY_MS))
  return { last, previous: scans.at(-2) ?? null, daysAgo }
}

/** «hoy», «ayer», «hace 27 días». */
export function agoLabel(days: number): string {
  if (days <= 0) return 'hoy'
  if (days === 1) return 'ayer'
  return `hace ${days} días`
}

/** Scan older than this many days → remind to book one. */
export const SCAN_STALE_DAYS = 28

export interface GoalContext {
  sets: readonly LoggedSet[]
  scans: readonly Scan[]
  /** Sessions started in the current week. */
  sessionsThisWeek: number
}

/** «1RM Press de banca: 100 kg», «Grasa: 12 %», «4 sesiones por semana». */
export function goalTitle(
  goal: UserGoal,
  exerciseName: string | null,
  fmt: (n: number) => string,
): string {
  const t = fmt(goal.target)
  switch (goal.kind) {
    case 'e1rm':
      return `1RM ${exerciseName ?? 'ejercicio'}: ${t} kg`
    case 'lift':
      return `${exerciseName ?? 'Ejercicio'}: ${t} kg${goal.reps ? ` × ${goal.reps}` : ''}`
    case 'bodyweight':
      return `Peso: ${t} kg`
    case 'bodyfat':
      return `Grasa: ${t} %`
    case 'muscle':
      return `Músculo: ${t} kg`
    case 'frequency':
      return `${t} sesiones por semana`
  }
}

/** Unit of the measure a goal tracks. */
export function goalUnit(goal: UserGoal): string {
  if (goal.kind === 'bodyfat') return '%'
  if (goal.kind === 'frequency') return 'sesiones'
  return 'kg'
}

/** Current value of the measure a goal tracks, or null when there is no data for it. */
export function goalCurrent(goal: UserGoal, ctx: GoalContext): number | null {
  const last = ctx.scans.at(-1) ?? null
  switch (goal.kind) {
    case 'e1rm':
    case 'lift': {
      if (!goal.exerciseId) return null
      const mine = ctx.sets.filter((s) => s.exerciseId === goal.exerciseId)
      const b = bestsByExercise(mine)[goal.exerciseId]
      if (!b) return null
      if (goal.kind === 'e1rm') return b.e1rm?.value ?? null
      return goal.reps != null ? (b.repPRs[goal.reps] ?? null) : (b.maxWeight?.value ?? null)
    }
    case 'bodyweight':
      return last?.peso ?? null
    case 'bodyfat':
      return last?.grasa ?? null
    case 'muscle':
      return last?.musculo ?? null
    case 'frequency':
      return ctx.sessionsThisWeek
  }
}
