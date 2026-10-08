/** Pure helpers for creating and editing programs. */
import type { Program } from '@/data/rows'
import type { ProgramDay, ProgramTemplate, Slot } from '@/domain/types'

export const MESO_MIN = 3
export const MESO_MAX = 12
/** Rest choices in the editor: 0:45 → 4:00 every 15 s. */
export const REST_OPTIONS: number[] = Array.from(
  { length: (240 - 45) / 15 + 1 },
  (_, i) => 45 + i * 15,
)
export const SUPERSET_LETTERS = ['A', 'B', 'C'] as const

/** Local "YYYY-MM-DD". */
export function todayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** A program of the person's own from a template: fresh ids for every day and slot, names kept. */
export function programFromTemplate(
  t: ProgramTemplate,
  startedOn: string,
  newId: () => string,
): Program {
  return {
    id: newId(),
    name: t.name,
    templateId: t.id,
    mesoWeeks: t.mesoWeeks,
    startedOn,
    archived: false,
    days: t.days.map((d) => ({
      ...d,
      id: newId(),
      slots: d.slots.map((s) => ({ ...s, id: newId() })),
    })),
  }
}

/** Move the item at `from` by `delta` places; out-of-range moves return the list unchanged. */
export function move<T>(list: readonly T[], from: number, delta: number): T[] {
  const to = from + delta
  if (from < 0 || from >= list.length || to < 0 || to >= list.length) return [...list]
  const out = [...list]
  const [item] = out.splice(from, 1)
  out.splice(to, 0, item as T)
  return out
}

export interface ProgramIssue {
  /** Day id, slot id or "program". */
  at: string
  message: string
}

/** Everything that stops a program from being saved. */
export function validateProgram(
  p: Pick<Program, 'name' | 'mesoWeeks' | 'startedOn' | 'days'>,
): ProgramIssue[] {
  const out: ProgramIssue[] = []
  if (!p.name.trim()) out.push({ at: 'program', message: 'Ponle un nombre al programa' })
  if (!Number.isInteger(p.mesoWeeks) || p.mesoWeeks < MESO_MIN || p.mesoWeeks > MESO_MAX) {
    out.push({ at: 'program', message: `El mesociclo va de ${MESO_MIN} a ${MESO_MAX} semanas` })
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.startedOn)) {
    out.push({ at: 'program', message: 'Falta la fecha de inicio' })
  }
  for (const d of p.days) {
    if (!d.name.trim()) out.push({ at: d.id, message: 'El día necesita un nombre' })
    for (const s of d.slots) out.push(...validateSlot(s).map((message) => ({ at: s.id, message })))
  }
  return out
}

export function validateSlot(s: Slot): string[] {
  const out: string[] = []
  if (!Number.isInteger(s.sets) || s.sets < 1) out.push('Al menos 1 serie')
  if (!Number.isInteger(s.repMin) || s.repMin < 1)
    out.push('Las repeticiones mínimas empiezan en 1')
  if (!Number.isInteger(s.repMax) || s.repMax < s.repMin)
    out.push('Reps mín. no puede superar a reps máx.')
  if (!Number.isFinite(s.rir) || s.rir < 0 || s.rir > 5) out.push('RIR entre 0 y 5')
  return out
}

/**
 * Apply a patch to one day. The day keeps its id whatever the patch says: past sessions link to
 * it (`Workout.dayId`), so editing a day must never break «la última vez».
 */
export function patchDayIn(
  days: readonly ProgramDay[],
  dayId: string,
  p: Partial<ProgramDay>,
): ProgramDay[] {
  return days.map((d) => (d.id === dayId ? { ...d, ...p, id: d.id } : d))
}

export function emptyDay(id: string, index: number): ProgramDay {
  return { id, name: `Día ${index + 1}`, focus: '', weekday: null, slots: [] }
}

/** Structural equality, for the "unsaved changes" warning. */
export function sameProgram(a: Program, b: Program): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}
