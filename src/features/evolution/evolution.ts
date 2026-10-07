/**
 * Long-term evolution: training, records and body composition grouped by local month, automatic
 * milestones, the 26-week consistency grid, weekly-target streaks and a month-vs-month
 * comparison. Pure functions: the clock comes in as `now`.
 *
 * Sessions are finished workouts (whatever their origin: a program day or an imported session
 * without plan). Their sets are bucketed by the workout's local start, so a session that crosses
 * midnight stays whole. Scan dates are calendar days ("YYYY-MM-DD") and are never shifted by
 * the time zone.
 */
import {
  addLocalDays,
  formatNumber,
  isEffectiveSet,
  localDateKey,
  SECONDARY_FACTOR,
  startOfLocalDay,
  startOfLocalWeek,
  tonnage,
} from '@/domain/training'
import type { Exercise, LoggedSet, Muscle, PersonalRecord, Scan, Workout } from '@/domain/types'
import { deltaTone, metricDelta, type MetricDelta, type ScanMetric } from '@/features/body/scans'
import { mainLifts, prTimeline, setE1rm } from '@/features/exercise/stats'
import { formatInt, monthKey, monthLabel, PR_RANK } from '@/features/train/history'

const round1 = (n: number) => Math.round(n * 10) / 10

/* ───────────── Month keys ───────────── */

/** "YYYY-MM" moved by `delta` months (crosses years both ways). */
export function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(y!, m! - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Local month of a Date. */
export function dateMonthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Every month from `from` to `to` (inclusive), newest first. */
export function monthRange(from: string, to: string): string[] {
  const out: string[] = []
  for (let k = to; k >= from; k = shiftMonth(k, -1)) out.push(k)
  return out
}

/* ───────────── Build ───────────── */

export interface EvolutionInput {
  workouts: readonly Pick<Workout, 'id' | 'name' | 'startedAt' | 'endedAt'>[]
  sets: readonly LoggedSet[]
  /** Oldest first. */
  scans: readonly Scan[]
  lookup: (id: string) => Exercise
  now: Date
  /** Added to the load of bodyweight exercises in tonnage. */
  bodyweight?: number | null
}

export interface EvoSession {
  id: string
  name: string
  startedAt: string
  /** Local day "YYYY-MM-DD". */
  day: string
  /** Local month "YYYY-MM". */
  month: string
  sets: LoggedSet[]
  /** Effective sets (hard kinds, RIR ≤ 4 or unknown). */
  effective: number
  tonnage: number
}

export interface LiftMonth {
  exerciseId: string
  /** Best e1RM of the month. */
  best: number
  /** Against the best of the last earlier month the lift was trained; null the first time. */
  change: number | null
}

export type MilestoneKind =
  'first_workout' | 'sessions' | 'session_record' | 'max_muscle' | 'min_fat' | 'best_volume_month'

export interface Milestone {
  kind: MilestoneKind
  text: string
}

export interface MonthSummary {
  key: string
  label: string
  sessions: number
  /** Sessions per week over the month (elapsed days for the current one); null without sessions. */
  perWeek: number | null
  sets: number
  tonnage: number
  /** Totals of the previous calendar month when it had sessions (for the deltas). */
  prev: { sets: number; tonnage: number } | null
  lifts: LiftMonth[]
  /** One record per record-breaking set (its most telling kind), oldest first. */
  records: PersonalRecord[]
  /** Scans of the month, oldest first. */
  scans: Scan[]
  /** Effective sets per muscle (secondary muscles count half). */
  muscles: Partial<Record<Muscle, number>>
  milestones: Milestone[]
}

export interface Evolution {
  /** Finished sessions, oldest first. */
  sessions: EvoSession[]
  /** One record per record-breaking set, oldest first. */
  records: PersonalRecord[]
  scans: readonly Scan[]
  /** Months with sessions or scans, newest first. */
  months: MonthSummary[]
  /** Main compound lifts (most trained first, at most 4). */
  mainLiftIds: string[]
  /** First day with data (session or scan), "YYYY-MM-DD". */
  firstDate: string | null
  /** Every month from the first one with data to the current one, newest first. */
  monthKeys: string[]
  nowMonth: string
}

export const MAIN_LIFTS_SHOWN = 4
export const SESSION_MILESTONES = [10, 50, 100, 200, 500] as const

/** Keep, for every set, only its most telling record (1RM > weight > reps > volume). */
export function recordsPerSet(records: readonly PersonalRecord[]): PersonalRecord[] {
  const bySet = new Map<string, PersonalRecord>()
  for (const pr of records) {
    const cur = bySet.get(pr.setId)
    if (!cur || PR_RANK[pr.kind] < PR_RANK[cur.kind]) bySet.set(pr.setId, pr)
  }
  return [...bySet.values()]
}

function emptyMonth(key: string): MonthSummary {
  return {
    key,
    label: monthLabel(key),
    sessions: 0,
    perWeek: null,
    sets: 0,
    tonnage: 0,
    prev: null,
    lifts: [],
    records: [],
    scans: [],
    muscles: {},
    milestones: [],
  }
}

function addMuscles(
  out: Partial<Record<Muscle, number>>,
  ex: Pick<Exercise, 'primary' | 'secondary'>,
) {
  const primary = new Set(ex.primary)
  for (const m of primary) out[m] = (out[m] ?? 0) + 1
  for (const m of new Set(ex.secondary)) {
    if (!primary.has(m)) out[m] = (out[m] ?? 0) + SECONDARY_FACTOR
  }
}

export function buildEvolution(input: EvolutionInput): Evolution {
  const { lookup, now } = input
  const nowMonth = dateMonthKey(now)

  // Sessions: finished workouts with their sets.
  const finished = input.workouts
    .filter((w) => w.endedAt && Number.isFinite(Date.parse(w.startedAt)))
    .toSorted((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt))
  const setsBy = new Map<string, LoggedSet[]>(finished.map((w) => [w.id, []]))
  for (const s of input.sets) setsBy.get(s.workoutId)?.push(s)

  const byId: Record<string, Exercise> = {}
  for (const list of setsBy.values())
    for (const s of list) byId[s.exerciseId] ??= lookup(s.exerciseId)
  const tonOpts = { bodyweight: input.bodyweight ?? null, exercisesById: byId }

  const sessions: EvoSession[] = finished.map((w) => {
    const list = setsBy.get(w.id) ?? []
    return {
      id: w.id,
      name: w.name,
      startedAt: w.startedAt,
      day: localDateKey(new Date(w.startedAt)),
      month: monthKey(w.startedAt),
      sets: list,
      effective: list.filter(isEffectiveSet).length,
      tonnage: tonnage(list, tonOpts),
    }
  })
  const sessionMonth = new Map(sessions.map((s) => [s.id, s.month]))
  const sessionSets = sessions.flatMap((s) => s.sets)

  const records = recordsPerSet(prTimeline(sessionSets))
  const mainLiftIds = mainLifts(sessionSets, lookup)
    .slice(0, MAIN_LIFTS_SHOWN)
    .map((l) => l.exercise.id)
  const mainSet = new Set(mainLiftIds)
  const recordMonth = new Map<string, string>()
  for (const s of sessionSets) recordMonth.set(s.id, sessionMonth.get(s.workoutId)!)

  // Months.
  const map = new Map<string, MonthSummary>()
  const month = (key: string) => {
    let m = map.get(key)
    if (!m) map.set(key, (m = emptyMonth(key)))
    return m
  }
  const liftBest = new Map<string, Map<string, number>>() // month → lift → best
  for (const s of sessions) {
    const m = month(s.month)
    m.sessions++
    m.sets += s.effective
    m.tonnage += s.tonnage
    for (const set of s.sets) {
      if (isEffectiveSet(set)) addMuscles(m.muscles, byId[set.exerciseId]!)
      if (!mainSet.has(set.exerciseId)) continue
      const e = setE1rm(set)
      if (e == null) continue
      const lifts = liftBest.get(s.month) ?? new Map<string, number>()
      if (e > (lifts.get(set.exerciseId) ?? -Infinity)) lifts.set(set.exerciseId, e)
      liftBest.set(s.month, lifts)
    }
  }
  for (const pr of records) {
    const key = recordMonth.get(pr.setId)
    if (key) month(key).records.push(pr)
  }
  for (const sc of input.scans) month(sc.date.slice(0, 7)).scans.push(sc)

  const asc = [...map.values()].toSorted((a, b) => a.key.localeCompare(b.key))

  // Per-month derived values, walking forward in time.
  const lastLift = new Map<string, number>()
  for (const m of asc) {
    m.tonnage = Math.round(m.tonnage)
    m.perWeek = m.sessions ? sessionsPerWeek(m.key, m.sessions, now) : null
    const prev = map.get(shiftMonth(m.key, -1))
    m.prev = prev && prev.sessions ? { sets: prev.sets, tonnage: prev.tonnage } : null
    const lifts = liftBest.get(m.key)
    for (const id of mainLiftIds) {
      const best = lifts?.get(id)
      if (best == null) continue
      const before = lastLift.get(id)
      m.lifts.push({ exerciseId: id, best, change: before == null ? null : round1(best - before) })
      lastLift.set(id, best)
    }
  }
  addMilestones(map, asc, sessions, input.scans)

  const firstSession = sessions[0]?.day ?? null
  const firstScan = input.scans[0]?.date.slice(0, 10) ?? null
  const firstDate =
    firstSession && firstScan
      ? firstSession < firstScan
        ? firstSession
        : firstScan
      : (firstSession ?? firstScan)
  const firstMonth = asc[0]?.key
  return {
    sessions,
    records,
    scans: input.scans,
    months: asc.toReversed(),
    mainLiftIds,
    firstDate,
    monthKeys: firstMonth
      ? monthRange(firstMonth < nowMonth ? firstMonth : nowMonth, nowMonth)
      : [nowMonth],
    nowMonth,
  }
}

function sessionsPerWeek(key: string, sessions: number, now: Date): number {
  const [y, m] = key.split('-').map(Number)
  const days =
    key === dateMonthKey(now) ? now.getDate() : new Date(y!, m!, 0).getDate() /* last day */
  return round1(sessions / (days / 7))
}

function addMilestones(
  map: Map<string, MonthSummary>,
  asc: MonthSummary[],
  sessions: readonly EvoSession[],
  scans: readonly Scan[],
) {
  const push = (key: string, ms: Milestone) => map.get(key)?.milestones.push(ms)

  const first = sessions[0]
  if (first) push(first.month, { kind: 'first_workout', text: 'Primer entreno registrado' })

  sessions.forEach((s, i) => {
    const n = i + 1
    if ((SESSION_MILESTONES as readonly number[]).includes(n))
      push(s.month, { kind: 'sessions', text: `Sesión n.º ${n}` })
  })

  // Session tonnage records: the best one of each month that beat every earlier session.
  let best = 0
  const recordOf = new Map<string, number>()
  sessions.forEach((s, i) => {
    if (i > 0 && s.tonnage > best && best > 0) recordOf.set(s.month, s.tonnage)
    best = Math.max(best, s.tonnage)
  })
  for (const [key, t] of recordOf)
    push(key, {
      kind: 'session_record',
      text: `Récord de tonelaje en una sesión: ${formatInt(t)} kg`,
    })

  const extreme = (metric: 'musculo' | 'grasa', pick: (a: number, b: number) => boolean) => {
    const withValue = scans.filter((s) => s[metric] != null)
    if (withValue.length < 2) return null
    return withValue.reduce((m, s) => (pick(s[metric]!, m[metric]!) ? s : m))
  }
  const maxMuscle = extreme('musculo', (a, b) => a > b)
  if (maxMuscle)
    push(maxMuscle.date.slice(0, 7), {
      kind: 'max_muscle',
      text: `Máximo de masa muscular: ${formatNumber(maxMuscle.musculo!, 1)} kg`,
    })
  const minFat = extreme('grasa', (a, b) => a < b)
  if (minFat)
    push(minFat.date.slice(0, 7), {
      kind: 'min_fat',
      text: `Mínimo de grasa: ${formatNumber(minFat.grasa!, 1)} %`,
    })

  const trained = asc.filter((m) => m.sessions > 0)
  if (trained.length >= 2) {
    const top = trained.reduce((m, x) => (x.tonnage > m.tonnage ? x : m))
    if (top.tonnage > 0)
      push(top.key, {
        kind: 'best_volume_month',
        text: `Mejor mes de volumen: ${formatInt(top.tonnage)} kg`,
      })
  }
}

/** The month's summary, or an empty one when nothing happened in it. */
export function monthSummary(ev: Evolution, key: string): MonthSummary {
  return ev.months.find((m) => m.key === key) ?? emptyMonth(key)
}

/* ───────────── Period summary ───────────── */

export type Period = '3m' | '6m' | '1y' | 'all'

/** Local midnight `period` ago, or null for the whole history. */
export function periodStart(period: Period, now: Date): Date | null {
  if (period === 'all') return null
  const months = period === '3m' ? 3 : period === '6m' ? 6 : 12
  return new Date(now.getFullYear(), now.getMonth() - months, now.getDate())
}

export const BODY_METRICS: ScanMetric[] = ['peso', 'grasa', 'musculo']

export interface PeriodSummary {
  sessions: number
  sets: number
  tonnage: number
  records: number
  firstScan: Scan | null
  lastScan: Scan | null
  /** First scan of the period → last one (only when there are two). */
  body: MetricDelta[]
}

export function summarize(ev: Evolution, from: Date | null): PeriodSummary {
  const fromDay = from ? localDateKey(startOfLocalDay(from)) : ''
  const sessions = ev.sessions.filter((s) => s.day >= fromDay)
  const setIds = new Set(sessions.flatMap((s) => s.sets.map((set) => set.id)))
  const scans = ev.scans.filter((s) => s.date.slice(0, 10) >= fromDay)
  const firstScan = scans[0] ?? null
  const lastScan = scans.at(-1) ?? null
  return {
    sessions: sessions.length,
    sets: sessions.reduce((t, s) => t + s.effective, 0),
    tonnage: Math.round(sessions.reduce((t, s) => t + s.tonnage, 0)),
    records: ev.records.filter((r) => setIds.has(r.setId)).length,
    firstScan,
    lastScan,
    body:
      firstScan && lastScan && firstScan !== lastScan
        ? BODY_METRICS.map((m) => metricDelta(m, firstScan, lastScan))
        : [],
  }
}

/* ───────────── Consistency grid & streaks ───────────── */

export interface DayCell {
  /** Local day "YYYY-MM-DD". */
  date: string
  sessions: number
  /** Effective sets that day. */
  sets: number
  /** 0 = rest, 1–3 = trained (more sets, higher). */
  level: 0 | 1 | 2 | 3
  /** After today. */
  future: boolean
}

export interface WeekColumn {
  /** Local Monday "YYYY-MM-DD". */
  start: string
  /** Month key of the Monday, for the column labels. */
  month: string
  /** Monday … Sunday. */
  days: DayCell[]
}

/** The last `weeks` Monday–Sunday weeks, oldest first, the current week last. */
export function consistencyGrid(
  sessions: readonly Pick<EvoSession, 'day' | 'effective'>[],
  now: Date,
  weeks = 26,
): WeekColumn[] {
  const byDay = new Map<string, { sessions: number; sets: number }>()
  for (const s of sessions) {
    const d = byDay.get(s.day) ?? { sessions: 0, sets: 0 }
    d.sessions++
    d.sets += s.effective
    byDay.set(s.day, d)
  }
  const today = localDateKey(now)
  const current = startOfLocalWeek(now)
  const out: WeekColumn[] = []
  let maxSets = 0
  for (let w = weeks - 1; w >= 0; w--) {
    const monday = addLocalDays(current, -7 * w)
    const days: DayCell[] = []
    for (let i = 0; i < 7; i++) {
      const date = localDateKey(addLocalDays(monday, i))
      const d = byDay.get(date)
      if (d) maxSets = Math.max(maxSets, d.sets)
      days.push({
        date,
        sessions: d?.sessions ?? 0,
        sets: d?.sets ?? 0,
        level: 0,
        future: date > today,
      })
    }
    out.push({ start: localDateKey(monday), month: dateMonthKey(monday), days })
  }
  for (const col of out)
    for (const d of col.days) {
      if (!d.sessions) continue
      d.level =
        maxSets > 0 ? (Math.min(3, Math.max(1, Math.ceil((d.sets / maxSets) * 3))) as 1 | 2 | 3) : 1
    }
  return out
}

export interface Streaks {
  /** Consecutive weeks meeting the target up to now (the current week counts once met). */
  current: number
  best: number
  /** Sessions so far this week. */
  thisWeek: number
  target: number
}

/** Streaks of Monday–Sunday weeks with at least `target` sessions. */
export function weekStreaks(
  sessions: readonly Pick<EvoSession, 'startedAt'>[],
  target: number,
  now: Date,
): Streaks {
  const goal = Math.max(1, Math.round(target) || 1)
  const byWeek = new Map<string, number>()
  let first: Date | null = null
  for (const s of sessions) {
    const d = new Date(s.startedAt)
    if (!Number.isFinite(d.getTime())) continue
    const wk = startOfLocalWeek(d)
    if (!first || wk < first) first = wk
    const k = localDateKey(wk)
    byWeek.set(k, (byWeek.get(k) ?? 0) + 1)
  }
  const currentWeek = startOfLocalWeek(now)
  const thisWeek = byWeek.get(localDateKey(currentWeek)) ?? 0
  if (!first) return { current: 0, best: 0, thisWeek, target: goal }

  const met: boolean[] = [] // oldest → current week
  for (let wk = first; wk <= currentWeek; wk = addLocalDays(wk, 7))
    met.push((byWeek.get(localDateKey(wk)) ?? 0) >= goal)

  let best = 0
  let run = 0
  for (const ok of met) {
    run = ok ? run + 1 : 0
    best = Math.max(best, run)
  }
  // The current week is still open: it does not break the streak until it is over.
  let i = met.length - 1
  if (!met[i]) i--
  let current = 0
  while (i >= 0 && met[i]) {
    current++
    i--
  }
  return { current, best, thisWeek, target: goal }
}

/* ───────────── Month comparison ───────────── */

export type Tone = 'good' | 'bad' | 'neutral'

export type CompareSubject =
  | { group: 'training'; metric: 'sessions' | 'sets' | 'tonnage' }
  | { group: 'muscle'; muscle: Muscle }
  | { group: 'lift'; exerciseId: string }
  | { group: 'body'; metric: ScanMetric }

export interface CompareRow {
  subject: CompareSubject
  a: number | null
  b: number | null
  /** b − a. */
  diff: number | null
  tone: Tone
}

const upTone = (diff: number | null): Tone =>
  diff == null || Math.abs(diff) < 1e-9 ? 'neutral' : diff > 0 ? 'good' : 'bad'

const row = (subject: CompareSubject, a: number | null, b: number | null): CompareRow => {
  const diff = a != null && b != null ? Math.round((b - a) * 1000) / 1000 : null
  const tone =
    subject.group === 'body'
      ? diff == null
        ? 'neutral'
        : deltaTone(subject.metric, diff)
      : upTone(diff)
  return { subject, a, b, diff, tone }
}

/** Month A → month B (B is usually the more recent one): training, muscles, lifts and body. */
export function compareMonths(ev: Evolution, aKey: string, bKey: string): CompareRow[] {
  const a = monthSummary(ev, aKey)
  const b = monthSummary(ev, bKey)
  const rows: CompareRow[] = [
    row({ group: 'training', metric: 'sessions' }, a.sessions, b.sessions),
    row({ group: 'training', metric: 'sets' }, a.sets, b.sets),
    row({ group: 'training', metric: 'tonnage' }, a.tonnage, b.tonnage),
  ]
  const muscles = [...new Set([...Object.keys(a.muscles), ...Object.keys(b.muscles)])] as Muscle[]
  muscles
    .toSorted(
      (x, y) =>
        Math.max(b.muscles[y] ?? 0, a.muscles[y] ?? 0) -
          Math.max(b.muscles[x] ?? 0, a.muscles[x] ?? 0) || x.localeCompare(y),
    )
    .forEach((m) =>
      rows.push(row({ group: 'muscle', muscle: m }, a.muscles[m] ?? 0, b.muscles[m] ?? 0)),
    )
  for (const id of ev.mainLiftIds) {
    const la = a.lifts.find((l) => l.exerciseId === id)?.best ?? null
    const lb = b.lifts.find((l) => l.exerciseId === id)?.best ?? null
    if (la != null || lb != null) rows.push(row({ group: 'lift', exerciseId: id }, la, lb))
  }
  const sa = a.scans.at(-1) ?? null
  const sb = b.scans.at(-1) ?? null
  for (const m of BODY_METRICS) {
    const va = sa?.[m] ?? null
    const vb = sb?.[m] ?? null
    if (va != null || vb != null) rows.push(row({ group: 'body', metric: m }, va, vb))
  }
  return rows
}

/** Default comparison: three months ago → this month. */
export function defaultComparison(ev: Evolution): { a: string; b: string } {
  return { a: shiftMonth(ev.nowMonth, -3), b: ev.nowMonth }
}
