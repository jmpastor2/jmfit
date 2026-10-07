/**
 * One place that turns an exercise id into an {@link Exercise}: the built-in catalog first, then
 * the person's own exercises, then a readable stand-in for ids that only exist in old sessions
 * ("legacy-press-de-pierna" → "Press de pierna"), so history never shows a raw slug.
 */
import { useQuery } from '@tanstack/react-query'
import { useCallback } from 'react'
import { EXERCISES, exerciseById } from '@/content/exercises'
import { useUid } from '@/data/hooks'
import { num } from '@/data/rows'
import type { Equipment, Exercise, Muscle, Pattern } from '@/domain/types'
import { requireSupabase } from '@/lib/supabase'

interface CustomRow {
  id: string
  name: string
  primary_muscles: string[]
  secondary_muscles: string[]
  equipment: string
  pattern: string
  compound: boolean
  increment: unknown
  bodyweight: boolean
  rest_sec: number
}

const toExercise = (r: CustomRow): Exercise => ({
  id: r.id,
  name: r.name,
  primary: r.primary_muscles as Muscle[],
  secondary: r.secondary_muscles as Muscle[],
  equipment: r.equipment as Equipment,
  pattern: r.pattern as Pattern,
  compound: r.compound,
  increment: num(r.increment) ?? 2.5,
  bodyweight: r.bodyweight,
  restSec: r.rest_sec,
  cues: [],
  mistakes: [],
  videos: [],
})

export function useCustomExercises() {
  const uid = useUid()
  return useQuery({
    queryKey: ['customExercises', uid],
    queryFn: async () => {
      const { data, error } = await requireSupabase()
        .from('custom_exercises')
        .select('*')
        .order('name')
      if (error) throw error
      return (data as CustomRow[]).map(toExercise)
    },
  })
}

export function fallbackExercise(id: string): Exercise {
  const words = id
    .replace(/^(legacy|custom)-/, '')
    .replace(/-/g, ' ')
    .trim()
  return {
    id,
    name: words ? words[0]!.toUpperCase() + words.slice(1) : 'Ejercicio',
    primary: [],
    secondary: [],
    equipment: 'machine',
    pattern: 'isolation_upper',
    compound: false,
    increment: 2.5,
    restSec: 90,
    cues: [],
    mistakes: [],
    videos: [],
  }
}

/** Resolver that always answers: catalog → custom → readable fallback. */
export function useExerciseLookup(): (id: string) => Exercise {
  const custom = useCustomExercises().data
  return useCallback(
    (id: string) => exerciseById(id) ?? custom?.find((e) => e.id === id) ?? fallbackExercise(id),
    [custom],
  )
}

/** Everything that can be picked: the catalog plus the person's own exercises. */
export function useAllExercises(): readonly Exercise[] {
  const custom = useCustomExercises().data
  return custom?.length ? [...custom, ...EXERCISES] : EXERCISES
}
