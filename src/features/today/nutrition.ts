/**
 * What was eaten, from the food logged in Google Health, against the day's targets. Pure
 * functions: the clock comes in as `now`.
 */
import { addLocalDays, localDateKey } from '@/domain/training'
import type { HealthDay } from '@/domain/types'

/** Protein for someone training for muscle when no target is set: 1.8 g per kg. */
export const PROTEIN_PER_KG = 1.8

export interface FoodDay {
  date: string
  kcal: number
  protein: number | null
}

export interface FoodSummary {
  /** Today so far, when something was logged today. */
  today: FoodDay | null
  /** Yesterday, the last complete day. */
  yesterday: FoodDay | null
  /** Average of the days with food logged in the last seven complete days. */
  week: { kcal: number; protein: number | null; days: number } | null
  kcalTarget: number | null
  proteinTarget: number | null
  /** The protein target comes from bodyweight, not from Ajustes. */
  proteinEstimated: boolean
}

const asFood = (d: HealthDay): FoodDay | null =>
  d.kcalIn ? { date: d.date, kcal: d.kcalIn, protein: d.proteinG } : null

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

/** Null when nothing was logged in the last week: the block then stays hidden. */
export function foodSummary(
  days: readonly HealthDay[],
  now: Date,
  targets: { kcal: number | null; protein: number | null },
  bodyweight: number | null,
): FoodSummary | null {
  const today = localDateKey(now)
  const yesterday = localDateKey(addLocalDays(now, -1))
  const weekFrom = localDateKey(addLocalDays(now, -7))
  const food = new Map<string, FoodDay>()
  for (const d of days) {
    const f = asFood(d)
    if (f) food.set(d.date, f)
  }
  const week = [...food.values()].filter((f) => f.date >= weekFrom && f.date < today)
  if (!week.length && !food.has(today)) return null
  const proteins = week.map((f) => f.protein).filter((p): p is number => p != null)
  const estimated = targets.protein == null && bodyweight != null
  return {
    today: food.get(today) ?? null,
    yesterday: food.get(yesterday) ?? null,
    week: week.length
      ? {
          kcal: Math.round(mean(week.map((f) => f.kcal))!),
          protein: proteins.length ? Math.round(mean(proteins)!) : null,
          days: week.length,
        }
      : null,
    kcalTarget: targets.kcal,
    proteinTarget:
      targets.protein ?? (bodyweight != null ? Math.round(bodyweight * PROTEIN_PER_KG) : null),
    proteinEstimated: estimated,
  }
}
