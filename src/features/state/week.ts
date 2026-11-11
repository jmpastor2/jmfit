/**
 * The week in one look: the last seven days against the seven before, and the two or three
 * things that would help most. Pure functions.
 */
import type { DayState } from './state'
import { sleepHabits } from './sleep'

export interface WeekNumbers {
  recovery: number | null
  strain: number | null
  /** Average of the whole nights, minutes. */
  sleep: number | null
  /** Nights recorded only in part (band off). */
  partialNights: number
  consistency: number | null
  steps: number | null
  gym: number
  sports: number
  kcal: number | null
  protein: number | null
}

export interface WeekReport {
  now: WeekNumbers
  before: WeekNumbers | null
  tips: string[]
}

const avg = (xs: (number | null)[], digits = 0) => {
  const v = xs.filter((x): x is number => x != null)
  if (!v.length) return null
  const f = 10 ** digits
  return Math.round((v.reduce((a, b) => a + b, 0) / v.length) * f) / f
}

const inWindow = (iso: string, from: string, to: string) => {
  const d = iso.slice(0, 10)
  return d >= from && d <= to
}

function numbers(
  days: readonly DayState[],
  gymDates: readonly string[],
  sportDates: readonly string[],
  food: readonly { date: string; kcal: number | null; protein: number | null }[],
): WeekNumbers {
  const from = days[0]!.date
  const to = days.at(-1)!.date
  const whole = days.filter((d) => d.sleepMin != null && !d.partialNight)
  const meals = food.filter((f) => f.date >= from && f.date <= to && f.kcal)
  return {
    recovery: avg(days.map((d) => d.recovery)),
    strain: avg(
      days.map((d) => d.strain),
      1,
    ),
    sleep: avg(whole.map((d) => d.sleepMin)),
    partialNights: days.filter((d) => d.partialNight).length,
    consistency: sleepHabits(days)?.consistency ?? null,
    steps: avg(days.map((d) => d.steps)),
    gym: gymDates.filter((d) => inWindow(d, from, to)).length,
    sports: sportDates.filter((d) => inWindow(d, from, to)).length,
    kcal: avg(meals.map((m) => m.kcal)),
    protein: avg(meals.map((m) => m.protein)),
  }
}

/**
 * `states` must reach today, oldest first; with fewer than seven days there is no week yet.
 * `gymDates` and `sportDates` are local YYYY-MM-DD of Forja sessions and band sports.
 */
export function weekReport(input: {
  states: readonly DayState[]
  gymDates: readonly string[]
  sportDates: readonly string[]
  food: readonly { date: string; kcal: number | null; protein: number | null }[]
  proteinTarget: number | null
}): WeekReport | null {
  const { states } = input
  if (states.length < 7) return null
  const now = numbers(states.slice(-7), input.gymDates, input.sportDates, input.food)
  const before =
    states.length >= 14
      ? numbers(states.slice(-14, -7), input.gymDates, input.sportDates, input.food)
      : null

  const tips: string[] = []
  if (now.partialNights >= 3)
    tips.push(
      `${now.partialNights} de 7 noches se registraron a medias: duerme con la pulsera puesta para que la recuperación sea fiable.`,
    )
  else if (now.sleep != null && now.sleep < 420)
    tips.push(
      `Duermes ${Math.floor(now.sleep / 60)} h ${now.sleep % 60} min de media y necesitas unas 7 h 30: es lo que más frena tu recuperación.`,
    )
  if (now.consistency != null && now.consistency < 50)
    tips.push(
      'Tu hora de acostarte y de levantarte cambia mucho: repetirlas, también el fin de semana, sube la recuperación sin dormir más.',
    )
  if (now.protein != null && input.proteinTarget != null && now.protein < input.proteinTarget * 0.9)
    tips.push(
      `Proteína media de ${now.protein} g frente a ${input.proteinTarget} g: súbela antes que las calorías.`,
    )
  if (now.gym < 2)
    tips.push(
      now.gym === 0
        ? 'Ninguna sesión de fuerza esta semana: con dos ya mantienes y con tres progresas.'
        : 'Una sola sesión de fuerza esta semana: con dos ya mantienes y con tres progresas.',
    )
  if (before?.recovery != null && now.recovery != null && now.recovery <= before.recovery - 8)
    tips.push(
      `Tu recuperación media bajó de ${before.recovery} % a ${now.recovery} %: semana de carga más suave y más sueño.`,
    )
  return { now, before, tips: tips.slice(0, 3) }
}
