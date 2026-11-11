/** Shared bits of the «Estado» screens (no components here, so Fast Refresh keeps working). */
import { recoveryBand, type DayState } from './state'

export const BAND_TEXT = { high: 'text-gold', mid: 'text-ink', low: 'text-warn' } as const
export const BAND_COLOR = { high: 'var(--gold)', mid: 'var(--ink-2)', low: 'var(--warn)' } as const
export const BAND_LABEL = { high: 'Alta', mid: 'Media', low: 'Baja' } as const

/** 197 → «3:17». */
export const hm = (min: number) =>
  `${Math.floor(min / 60)}:${String(Math.round(min % 60)).padStart(2, '0')}`

/** The night shown: last night, or the latest one recorded before the morning sync. */
export const lastNight = (states: readonly DayState[]) =>
  states.toReversed().find((s) => s.sleepMin != null) ?? null

/** «lun 9» from a YYYY-MM-DD key. */
export function shortDay(date: string): string {
  const d = new Date(date + 'T12:00:00')
  return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' }).replace('.', '')
}

/** One line on what to do today with this recovery and this much strain already. */
export function stateAdvice(today: DayState, target: { min: number; max: number } | null): string {
  if (today.recovery == null || !target) {
    return 'Aún no hay datos de esta mañana: con la sincronización de las 8:00 verás cómo llegas.'
  }
  if (today.strain >= target.max)
    return 'Ya has llegado a la carga que te tocaba hoy: lo que queda, suave.'
  const band = recoveryBand(today.recovery)
  if (band === 'high')
    return `Recuperado: buen día para apretar. Objetivo de carga ${target.min}–${target.max}; una sesión fuerte de Forja encaja.`
  if (band === 'mid')
    return `Recuperación media: entrena normal sin buscar récords. Objetivo de carga ${target.min}–${target.max}.`
  return 'Recuperación baja: hoy mejor sesión ligera, movilidad o descanso, y dormir pronto.'
}
