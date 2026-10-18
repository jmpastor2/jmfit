/**
 * Bodyweight trend: every weight the person has (typed at the end of a session or read by the
 * Boditrax), one point per local day, the 7-day mean, the weekly rate and what that rate means
 * for the training goal. Pure functions: the clock comes in as `now`.
 *
 * Days are local calendar days ("YYYY-MM-DD"). A session's weight belongs to the day the session
 * started; a scan has only a date and is placed at local noon of that day, so a session finished
 * in the evening of a scan day wins as «the last weight of the day».
 */
import { addLocalDays, formatNumber, localDateKey, startOfLocalDay } from '@/domain/training'
import type { Goal, Scan, Workout } from '@/domain/types'

const DAY_MS = 86_400_000

export type WeightSource = 'workout' | 'scan'

export interface WeightEntry {
  /** Local day, "YYYY-MM-DD". */
  date: string
  value: number
  source: WeightSource
  /** Epoch ms used to order entries of the same day. */
  at: number
}

const valid = (v: number | null | undefined): v is number =>
  v != null && Number.isFinite(v) && v > 20 && v < 400

const noonOf = (date: string) => new Date(date.slice(0, 10) + 'T12:00:00').getTime()

/** Weights from finished sessions (`bodyweight`) and scans (`peso`), unordered. */
export function weightEntries(
  workouts: readonly Pick<Workout, 'startedAt' | 'endedAt' | 'bodyweight'>[],
  scans: readonly Pick<Scan, 'date' | 'peso'>[],
): WeightEntry[] {
  const out: WeightEntry[] = []
  for (const w of workouts) {
    if (!w.endedAt || !valid(w.bodyweight)) continue
    const start = new Date(w.startedAt)
    const end = Date.parse(w.endedAt)
    if (!Number.isFinite(start.getTime())) continue
    out.push({
      date: localDateKey(start),
      value: w.bodyweight,
      source: 'workout',
      at: Number.isFinite(end) ? end : start.getTime(),
    })
  }
  for (const s of scans) {
    if (!valid(s.peso)) continue
    const at = noonOf(s.date)
    if (!Number.isFinite(at)) continue
    out.push({ date: s.date.slice(0, 10), value: s.peso, source: 'scan', at })
  }
  return out
}

/** One entry per day (the last one of that day), oldest first. */
export function dailyWeights(entries: readonly WeightEntry[]): WeightEntry[] {
  const byDay = new Map<string, WeightEntry>()
  for (const e of entries) {
    const cur = byDay.get(e.date)
    if (!cur || e.at >= cur.at) byDay.set(e.date, e)
  }
  return [...byDay.values()].toSorted((a, b) => a.date.localeCompare(b.date))
}

/** Daily points whose day is within the last `days` local days, today included. */
export function lastDays(daily: readonly WeightEntry[], now: Date, days: number): WeightEntry[] {
  const from = localDateKey(addLocalDays(startOfLocalDay(now), -(days - 1)))
  const to = localDateKey(now)
  return daily.filter((p) => p.date >= from && p.date <= to)
}

/** Mean of the daily weights of the last 7 days, or null without any. */
export function weekMean(daily: readonly WeightEntry[], now: Date): number | null {
  const pts = lastDays(daily, now, 7)
  if (!pts.length) return null
  return pts.reduce((t, p) => t + p.value, 0) / pts.length
}

/** Fewest daily points for a rate, and the fewest days they must span. */
export const RATE_MIN_POINTS = 3
export const RATE_MIN_SPAN_DAYS = 6

/**
 * Weekly rate in kg/week: least-squares slope of the daily weights of the last 21 days.
 * Null with fewer than 3 points or when they span less than 6 days (a slope over two or three
 * consecutive days is water, not a trend).
 */
export function weeklyRate(daily: readonly WeightEntry[], now: Date): number | null {
  const pts = lastDays(daily, now, 21)
  if (pts.length < RATE_MIN_POINTS) return null
  const xs = pts.map((p) => noonOf(p.date) / DAY_MS)
  const x0 = xs[0]!
  const span = xs.at(-1)! - x0
  if (span < RATE_MIN_SPAN_DAYS - 0.01) return null
  const n = pts.length
  const mx = xs.reduce((t, x) => t + (x - x0), 0) / n
  const my = pts.reduce((t, p) => t + p.value, 0) / n
  let num = 0
  let den = 0
  pts.forEach((p, i) => {
    const dx = xs[i]! - x0 - mx
    num += dx * (p.value - my)
    den += dx * dx
  })
  if (den === 0) return null
  return (num / den) * 7
}

type GoalFamily = 'gain' | 'lose' | 'keep'

/** What the goal asks of bodyweight. */
export function goalFamily(goal: Goal): GoalFamily {
  if (goal === 'hypertrophy' || goal === 'glutes') return 'gain'
  if (goal === 'cut') return 'lose'
  return 'keep' // maintenance, recomp, strength
}

/** Band treated as «stable» for every goal, kg/week. */
export const STABLE_BAND = 0.2
/**
 * Upper end of a lean gain, kg/week. Helms et al. suggest ~0.25–0.5 % of bodyweight per week
 * for intermediates; 0.4 kg is the top of that band for ~78 kg.
 */
export const LEAN_GAIN_MAX = 0.4
/** Fastest loss before muscle is at risk: 1 % of bodyweight per week. */
export const MAX_LOSS_FRACTION = 0.01

/**
 * One line that reads the rate against the goal, e.g. «Bajas 0,6 kg/semana: si buscas ganar
 * músculo, te falta comida.» Null when there is no rate.
 */
export function rateVerdict(
  rate: number | null,
  goal: Goal,
  bodyweight: number | null,
): string | null {
  if (rate == null || !Number.isFinite(rate)) return null
  const abs = formatNumber(Math.abs(rate), 1)
  const moving = rate > 0 ? `Subes ${abs} kg/semana` : `Bajas ${abs} kg/semana`
  const stable = Math.abs(rate) <= STABLE_BAND
  switch (goalFamily(goal)) {
    case 'gain':
      if (rate < -STABLE_BAND) return `${moving}: si buscas ganar músculo, te falta comida.`
      if (stable)
        return 'Peso estable: para ganar músculo, come algo más hasta subir unos 0,2–0,4 kg/semana.'
      if (rate <= LEAN_GAIN_MAX) return `${moving}: buen ritmo para ganar músculo sin mucha grasa.`
      return `${moving}: más rápido de lo útil, parte será grasa. Recorta un poco.`
    case 'lose': {
      if (rate > STABLE_BAND) return `${moving}: si buscas definir, te sobra comida.`
      if (stable) return 'Peso estable: para definir necesitas comer algo menos.'
      const maxLoss = (bodyweight ?? 0) * MAX_LOSS_FRACTION
      if (maxLoss > 0 && -rate > maxLoss)
        return `${moving}: demasiado rápido, arriesgas músculo. Come un poco más.`
      return `${moving}: buen ritmo para definir.`
    }
    case 'keep':
      if (stable) return `Peso estable (±${formatNumber(STABLE_BAND, 1)} kg/semana): mantienes.`
      return rate > 0
        ? `${moving}: por encima de mantenimiento.`
        : `${moving}: por debajo de mantenimiento.`
  }
}

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** Local days from `date` to `now` (0 = today). */
export function daysAgo(date: string, now: Date): number {
  const d = new Date(date.slice(0, 10) + 'T00:00:00').getTime()
  return Math.round((startOfLocalDay(now).getTime() - d) / DAY_MS)
}

/** «hoy», «ayer», «el jueves» (this past week) or «el 3 oct». */
export function dayPhrase(date: string, now: Date): string {
  const ago = daysAgo(date, now)
  if (ago <= 0) return 'hoy'
  if (ago === 1) return 'ayer'
  const d = new Date(date.slice(0, 10) + 'T00:00:00')
  if (ago < 7) return `el ${WEEKDAYS[d.getDay()]}`
  return `el ${d.getDate()} ${MONTHS[d.getMonth()]}`
}

/** «tras la sesión del jueves», «tras la sesión de hoy», «escáner Boditrax del 10 oct». */
export function weightSourceLabel(e: Pick<WeightEntry, 'date' | 'source'>, now: Date): string {
  const when = dayPhrase(e.date, now)
  if (e.source === 'scan') {
    if (when === 'hoy' || when === 'ayer') return `escáner Boditrax de ${when}`
    return `escáner Boditrax ${when.replace(/^el /, 'del ')}`
  }
  if (when === 'hoy' || when === 'ayer') return `tras la sesión de ${when}`
  return `tras la sesión ${when.replace(/^el /, 'del ')}`
}

/**
 * What a rate stands on: «5 pesos en 8 días». Under two weeks, water and food in the gut move the
 * scale by a kilo or more, so the line says it is only a guide.
 */
export function rateBasis(points: number, spanDays: number): string {
  const base = `${points} pesos en ${spanDays + 1} días`
  return spanDays < 13
    ? `${base}: con tan pocos días pesa mucho el agua, tómalo como orientación`
    : base
}

export interface WeightSummary {
  daily: WeightEntry[]
  latest: WeightEntry | null
  mean7: number | null
  rate: number | null
  verdict: string | null
  /** «Con 5 pesos en 8 días»: what the rate stands on; null without a rate. */
  rateBasis: string | null
  /** Daily points of the last 90 days, for the chart. */
  chart: WeightEntry[]
}

/** Everything the «Peso» block shows. */
export function weightSummary(
  workouts: readonly Pick<Workout, 'startedAt' | 'endedAt' | 'bodyweight'>[],
  scans: readonly Pick<Scan, 'date' | 'peso'>[],
  goal: Goal,
  now: Date,
): WeightSummary {
  const daily = dailyWeights(weightEntries(workouts, scans)).filter(
    (p) => p.date <= localDateKey(now),
  )
  const latest = daily.at(-1) ?? null
  const rate = weeklyRate(daily, now)
  const window = lastDays(daily, now, 21)
  const span = window.length ? daysAgo(window[0]!.date, now) - daysAgo(window.at(-1)!.date, now) : 0
  return {
    daily,
    latest,
    mean7: weekMean(daily, now),
    rate,
    verdict: rateVerdict(rate, goal, latest?.value ?? null),
    rateBasis: rate == null ? null : rateBasis(window.length, span),
    chart: lastDays(daily, now, 90),
  }
}
