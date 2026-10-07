/**
 * Settings form: profile ⇄ text fields, validation and the patch that goes to `profiles`.
 * Pure, so the rules are testable without rendering the screen.
 */
import type { Profile } from '@/data/rows'
import type { Experience, Goal } from '@/domain/types'

export interface SettingsForm {
  displayName: string
  sex: '' | 'M' | 'F' | 'O'
  birthDate: string
  heightCm: string
  experience: Experience
  trainingGoal: Goal
  weeklyTarget: string
  barKg: string
  platesKg: number[]
  restSound: boolean
  targetKcal: string
  targetProtein: string
  targetCarbs: string
  targetFat: string
}

const str = (n: number | null) => (n === null ? '' : String(n).replace('.', ','))

export function formFromProfile(p: Profile): SettingsForm {
  return {
    displayName: p.displayName ?? '',
    sex: p.sex ?? '',
    birthDate: p.birthDate ?? '',
    heightCm: str(p.heightCm),
    experience: p.experience,
    trainingGoal: p.trainingGoal,
    weeklyTarget: String(p.weeklyTarget),
    barKg: str(p.barKg),
    platesKg: [...p.platesKg].sort((a, b) => b - a),
    restSound: p.restSound,
    targetKcal: str(p.targetKcal),
    targetProtein: str(p.targetProtein),
    targetCarbs: str(p.targetCarbs),
    targetFat: str(p.targetFat),
  }
}

/** "" → null; "82,5" → 82.5; anything else → NaN (invalid). */
export function readNumber(text: string): number | null {
  const s = text.trim().replace(',', '.')
  if (!s) return null
  return /^\d+(\.\d+)?$/.test(s) ? Number(s) : Number.NaN
}

export type SettingsErrors = Partial<Record<keyof SettingsForm, string>>

export function validate(
  f: SettingsForm,
  today: string,
): { patch: Partial<Profile> | null; errors: SettingsErrors } {
  const errors: SettingsErrors = {}
  const range = (
    key: keyof SettingsForm,
    v: number | null,
    min: number,
    max: number,
    required = false,
    int = false,
  ) => {
    if (v === null) {
      if (required) errors[key] = 'Obligatorio'
      return
    }
    if (Number.isNaN(v) || v < min || v > max || (int && !Number.isInteger(v)))
      errors[key] = `Entre ${String(min).replace('.', ',')} y ${String(max).replace('.', ',')}`
  }

  const height = readNumber(f.heightCm)
  const weekly = readNumber(f.weeklyTarget)
  const bar = readNumber(f.barKg)
  const kcal = readNumber(f.targetKcal)
  const prot = readNumber(f.targetProtein)
  const carbs = readNumber(f.targetCarbs)
  const fat = readNumber(f.targetFat)

  if (!f.displayName.trim()) errors.displayName = 'Pon tu nombre'
  if (
    f.birthDate &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(f.birthDate) || f.birthDate > today || f.birthDate < '1900-01-01')
  )
    errors.birthDate = 'Fecha no válida'
  range('heightCm', height, 120, 230)
  range('weeklyTarget', weekly, 1, 7, true, true)
  range('barKg', bar, 0, 30, true)
  range('targetKcal', kcal, 800, 6000, false, true)
  range('targetProtein', prot, 0, 500, false, true)
  range('targetCarbs', carbs, 0, 1000, false, true)
  range('targetFat', fat, 0, 400, false, true)
  if (!f.platesKg.length) errors.platesKg = 'Añade al menos un disco'

  if (Object.keys(errors).length) return { patch: null, errors }
  return {
    errors,
    patch: {
      displayName: f.displayName.trim(),
      sex: f.sex || null,
      birthDate: f.birthDate || null,
      heightCm: height,
      experience: f.experience,
      trainingGoal: f.trainingGoal,
      weeklyTarget: weekly!,
      barKg: bar!,
      platesKg: [...f.platesKg].sort((a, b) => b - a),
      restSound: f.restSound,
      targetKcal: kcal,
      targetProtein: prot,
      targetCarbs: carbs,
      targetFat: fat,
    },
  }
}

/** Adds a plate weight (kg per plate) once, kept heaviest first. Invalid input leaves the list. */
export function addPlate(plates: readonly number[], text: string): number[] {
  const v = readNumber(text)
  if (v === null || Number.isNaN(v) || v <= 0 || v > 50 || plates.includes(v)) return [...plates]
  return [...plates, v].sort((a, b) => b - a)
}

/** kcal the macros add up to (4/4/9), to check them against the kcal target. */
export function macroKcal(
  protein: number | null,
  carbs: number | null,
  fat: number | null,
): number | null {
  if (protein === null && carbs === null && fat === null) return null
  return (protein ?? 0) * 4 + (carbs ?? 0) * 4 + (fat ?? 0) * 9
}
