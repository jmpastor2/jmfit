import type { Experience, Goal, Slot } from '@/domain/types'

export const GOAL_LABEL: Record<Goal, string> = {
  hypertrophy: 'Hipertrofia',
  strength: 'Fuerza',
  recomp: 'Recomposición',
  cut: 'Definición',
  maintenance: 'Mantenimiento',
  glutes: 'Glúteo',
}

export const GOAL_ORDER: Goal[] = [
  'hypertrophy',
  'strength',
  'recomp',
  'cut',
  'maintenance',
  'glutes',
]

export const EXPERIENCE_LABEL: Record<Experience, string> = {
  novice: 'Novato',
  intermediate: 'Intermedio',
  advanced: 'Avanzado',
}

export const WEEKDAY_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'] as const
export const WEEKDAY_LONG = [
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
  'Domingo',
] as const

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic']

/** "2026-10-07" → "7 oct 2026". */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return `${d} ${MONTHS[m - 1] ?? ''} ${y}`
}

/** Seconds → "2:00", "0:45". */
export function formatRest(sec: number): string {
  const s = Math.max(0, Math.round(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** "4 × 10 · RIR 2 · 2:00" (a range when repMin ≠ repMax: "3 × 8–12"). */
export function formatPrescription(
  slot: Pick<Slot, 'sets' | 'repMin' | 'repMax' | 'rir' | 'restSec'>,
): string {
  const reps = slot.repMin === slot.repMax ? `${slot.repMin}` : `${slot.repMin}–${slot.repMax}`
  return `${slot.sets} × ${reps} · RIR ${slot.rir} · ${formatRest(slot.restSec)}`
}
