/**
 * The morning notification after the 08:00 sync: last night and the heart against their usual,
 * or on Mondays the week in one line. Only measured figures: the recovery score itself is
 * computed by the app, so the notification never shows a number the app would not.
 * Pure functions (tested from src/lib).
 */

export interface MorningDay {
  date: string
  sleep_min: number | null
  hrv_ms: number | string | null
  resting_hr: number | null
  steps: number | null
}

export interface MorningMessage {
  title: string
  body: string
  url: string
}

/** Under this the band did not record the whole night. */
const PARTIAL_NIGHT_MIN = 240

const hm = (min: number) =>
  `${Math.floor(min / 60)}:${String(Math.round(min % 60)).padStart(2, '0')}`
const n = (v: number | string | null | undefined) => (v == null ? null : Number(v))
const avg = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x != null && Number.isFinite(x))
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
}
const thousands = (x: number) => Math.round(x).toLocaleString('es-ES').replace(/,/g, '.')

/** `days` oldest first, ending today; `today` is the local YYYY-MM-DD. */
export function morningMessage(input: {
  days: readonly MorningDay[]
  today: string
  monday: boolean
  gymSessions: number
  sports: number
}): MorningMessage | null {
  const { days, today } = input
  if (input.monday) {
    const week = days.filter((d) => d.date < today).slice(-7)
    if (!week.length) return null
    const sleep = avg(
      week.map((d) =>
        d.sleep_min != null && d.sleep_min >= PARTIAL_NIGHT_MIN ? d.sleep_min : null,
      ),
    )
    const steps = avg(week.map((d) => d.steps))
    const parts = [
      `${input.gymSessions} ${input.gymSessions === 1 ? 'sesión' : 'sesiones'} de fuerza`,
      ...(input.sports ? [`${input.sports} de deporte`] : []),
      ...(sleep != null ? [`sueño ${hm(sleep)} h de media`] : []),
      ...(steps != null ? [`${thousands(steps)} pasos al día`] : []),
    ]
    return {
      title: 'Tu semana',
      body: `${parts.join(' · ')}. El resumen y qué mejorar, en Forja.`,
      url: '#/body',
    }
  }

  const night = days.find((d) => d.date === today)
  if (!night || (night.sleep_min == null && n(night.hrv_ms) == null && night.resting_hr == null))
    return null
  const before = days.filter((d) => d.date < today).slice(-7)
  const hrvAvg = avg(before.map((d) => n(d.hrv_ms)))
  const rhrAvg = avg(before.map((d) => d.resting_hr))
  const parts: string[] = []
  if (night.sleep_min != null) {
    parts.push(
      night.sleep_min < PARTIAL_NIGHT_MIN
        ? `Noche registrada a medias (${hm(night.sleep_min)} h)`
        : `Dormiste ${hm(night.sleep_min)} h`,
    )
  }
  const hrv = n(night.hrv_ms)
  if (hrv != null)
    parts.push(
      `VFC ${Math.round(hrv)} ms${hrvAvg != null ? ` (tu media ${Math.round(hrvAvg)})` : ''}`,
    )
  if (night.resting_hr != null)
    parts.push(
      `pulso ${night.resting_hr}${rhrAvg != null ? ` (tu media ${Math.round(rhrAvg)})` : ''}`,
    )
  return {
    title: 'Buenos días',
    body: `${parts.join(' · ')}. Tu recuperación y el entreno de hoy, en Forja.`,
    url: '#/',
  }
}
