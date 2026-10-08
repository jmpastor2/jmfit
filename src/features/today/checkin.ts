/**
 * The morning check-in asks for yesterday's steps: they are stored on yesterday's row so
 * Cuerpo → Recuperación shows them on the day they were walked. Pure functions.
 */
import type { Checkin } from '@/domain/types'

/** What the form collects, already parsed. `steps` are yesterday's. */
export type CheckinForm = Omit<Checkin, 'date' | 'steps'> & { steps: number | null }

export const emptyCheckin = (date: string): Checkin => ({
  date,
  sleepH: null,
  sleepQuality: null,
  energy: null,
  soreness: null,
  stress: null,
  restingHr: null,
  hrvMs: null,
  steps: null,
})

/**
 * Yesterday's steps to prefill: what yesterday's row has, or else what an older version of the
 * app saved on today's row.
 */
export function stepsToPrefill(today: Checkin | null, yesterday: Checkin | null): number | null {
  return yesterday?.steps ?? today?.steps ?? null
}

/**
 * Rows to write: today's check-in without steps (null when there is nothing to save for today)
 * and yesterday's row with the steps, keeping its other fields (null when the steps did not
 * change).
 */
export function checkinWrites(
  form: CheckinForm,
  dates: { today: string; yesterday: string },
  existing: { today: Checkin | null; yesterday: Checkin | null },
): { today: Checkin | null; yesterday: Checkin | null } {
  const { steps, ...rest } = form
  const today: Checkin = { ...rest, date: dates.today, steps: null }
  const hasToday = existing.today != null || Object.values(rest).some((v) => v != null)

  const prevSteps = existing.yesterday?.steps ?? null
  const yesterday =
    steps === prevSteps
      ? null
      : { ...(existing.yesterday ?? emptyCheckin(dates.yesterday)), date: dates.yesterday, steps }

  return { today: hasToday ? today : null, yesterday }
}
