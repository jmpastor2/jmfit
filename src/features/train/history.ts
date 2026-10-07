/**
 * Training history helpers shared by Hoy, Entrenar, the workout detail and the session summary.
 * Pure functions: no React, no clock unless passed in.
 */
import { detectPRs, isEffectiveSet } from '@/domain/training'
import type { LoggedSet, PersonalRecord, Slot, Workout } from '@/domain/types'

const SPANISH_MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const

const SHORT_MONTHS = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
]
const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

/** «Miércoles 7 oct». */
export function formatLongDate(d: Date): string {
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${SHORT_MONTHS[d.getMonth()]}`
}

/** «mié 7 oct» (with the year when it is not `now`'s). */
export function formatShortDate(iso: string, now = new Date()): string {
  const d = new Date(iso)
  const wd = (WEEKDAYS[d.getDay()] ?? '').slice(0, 3).toLowerCase()
  const year = d.getFullYear() !== now.getFullYear() ? ` ${d.getFullYear()}` : ''
  return `${wd} ${d.getDate()} ${SHORT_MONTHS[d.getMonth()]}${year}`
}

/** «Octubre 2026». */
export function monthLabel(key: string): string {
  const [y, m] = key.split('-')
  const name = SPANISH_MONTHS[Number(m) - 1] ?? ''
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${y}`
}

/**
 * Whole number in Spanish style: digits grouped with a point from 10 000 up (RAE: four-digit
 * numbers stay together). 4320 → "4320", 12450 → "12.450".
 */
export function formatInt(n: number): string {
  const r = Math.round(n)
  const s = String(Math.abs(r))
  const body = s.length > 4 ? s.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : s
  return r < 0 ? `-${body}` : body
}

/** Signed change for a Delta: "+2", "-1,5", "0". */
export function signed(n: number, fmt: (n: number) => string): string {
  return n > 0 ? `+${fmt(n)}` : n < 0 ? `-${fmt(-n)}` : '0'
}

/** «4 × 6–8» (or «3 × 10» when the range is a single number). */
export function prescription(slot: Pick<Slot, 'sets' | 'repMin' | 'repMax'>): string {
  const reps = slot.repMin === slot.repMax ? `${slot.repMin}` : `${slot.repMin}–${slot.repMax}`
  return `${slot.sets} × ${reps}`
}

/** Seconds a work set takes under the bar, for duration estimates. */
export const SET_SECONDS = 40

/** Estimated minutes of a list of slots: every set takes ~40 s plus its rest. */
export function estimateMinutes(slots: readonly Pick<Slot, 'sets' | 'restSec'>[]): number {
  const sec = slots.reduce((t, s) => t + s.sets * (SET_SECONDS + s.restSec), 0)
  return Math.round(sec / 60)
}

/** Whole minutes between start and end, or null when the session has no usable length. */
export function workoutMinutes(w: Pick<Workout, 'startedAt' | 'endedAt'>): number | null {
  if (!w.endedAt) return null
  const ms = new Date(w.endedAt).getTime() - new Date(w.startedAt).getTime()
  if (!Number.isFinite(ms) || ms < 60_000) return null
  return Math.round(ms / 60_000)
}

/** "YYYY-MM" in local time. */
export function monthKey(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Finished workouts, newest first, grouped by local month (newest month first). */
export function groupByMonth<T extends Pick<Workout, 'startedAt' | 'endedAt'>>(
  workouts: readonly T[],
): { key: string; label: string; items: T[] }[] {
  const groups = new Map<string, T[]>()
  const sorted = workouts
    .filter((w) => w.endedAt)
    .toSorted((a, b) => b.startedAt.localeCompare(a.startedAt))
  for (const w of sorted) {
    const k = monthKey(w.startedAt)
    const list = groups.get(k)
    if (list) list.push(w)
    else groups.set(k, [w])
  }
  return [...groups.entries()].map(([key, items]) => ({ key, label: monthLabel(key), items }))
}

/** Sets grouped by workout id. */
export function setsByWorkout(sets: readonly LoggedSet[]): Map<string, LoggedSet[]> {
  const out = new Map<string, LoggedSet[]>()
  for (const s of sets) {
    const list = out.get(s.workoutId)
    if (list) list.push(s)
    else out.set(s.workoutId, [s])
  }
  return out
}

/** Number of effective sets (hard kinds, reps ≥ 1, RIR ≤ 4 or unknown). */
export const countEffective = (sets: readonly LoggedSet[]) => sets.filter(isEffectiveSet).length

/** Work sets (anything that is not a warm-up). */
export const countWork = (sets: readonly LoggedSet[]) =>
  sets.filter((s) => s.kind !== 'warmup').length

const byTime = (a: LoggedSet, b: LoggedSet) =>
  a.doneAt.localeCompare(b.doneAt) || a.exerciseIndex - b.exerciseIndex || a.setIndex - b.setIndex

/**
 * Records broken by every set in the history, each set judged against the sets of the same
 * exercise done before it (as the session does live). Keyed by set id; sets without a record
 * are absent. A first-ever set is a baseline, not a record.
 */
export function recordsBySet(sets: readonly LoggedSet[]): Map<string, PersonalRecord[]> {
  const byExercise = new Map<string, LoggedSet[]>()
  for (const s of sets) {
    const list = byExercise.get(s.exerciseId)
    if (list) list.push(s)
    else byExercise.set(s.exerciseId, [s])
  }
  const out = new Map<string, PersonalRecord[]>()
  for (const list of byExercise.values()) {
    const sorted = list.toSorted(byTime)
    for (let i = 1; i < sorted.length; i++) {
      const s = sorted[i]!
      if (s.kind === 'warmup') continue
      const prs = detectPRs(s, sorted.slice(0, i))
      if (prs.length) out.set(s.id, prs)
    }
  }
  return out
}

/** Order in which record kinds matter to the lifter. */
export const PR_RANK: Record<PersonalRecord['kind'], number> = {
  e1rm: 0,
  weight: 1,
  reps: 2,
  volume: 3,
}

export const PR_LABEL: Record<PersonalRecord['kind'], string> = {
  e1rm: '1RM estimado',
  weight: 'Peso máximo',
  reps: 'Repeticiones',
  volume: 'Volumen',
}

/** «112,5 kg», «12 reps con 80 kg»… */
export function prValue(pr: PersonalRecord, fmt: (n: number) => string): string {
  if (pr.kind === 'reps') return `${pr.value} reps con ${fmt(pr.atWeight ?? 0)} kg`
  return `${fmt(pr.value)} kg`
}
