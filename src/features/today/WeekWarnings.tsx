import { ChevronRight } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { MUSCLE_LABEL } from '@/content/exercises'
import { Meter } from '@/components/kpi/Meter'
import { useGoals, useMe, useScans, useSets, useWorkouts } from '@/data/hooks'
import type { Program } from '@/data/rows'
import { formatNumber } from '@/domain/training'
import type { Muscle } from '@/domain/types'
import { useExerciseLookup } from '@/features/exercise/lookup'
import { mainLifts } from '@/features/exercise/stats'
import { goalSuggestions, type GoalSuggestion } from '@/features/goals/goalValues'
import { mesoWeek } from '@/features/session/useStartWorkout'
import { doneDayIdsThisWeek, finishedToday } from './today'
import { recoverSentence, skipsLine, volumeGaps, weekSkips } from './weekAlerts'

/** Jose Manuel's specialisation: always warned about when behind, even outside the top 3. */
const FOCUS_MUSCLES: readonly Muscle[] = ['biceps', 'triceps']

const goalHref = (s: GoalSuggestion) => {
  const q = new URLSearchParams({ new: s.goal.kind })
  if (s.goal.exerciseId) q.set('exercise', s.goal.exerciseId)
  // The sheet opens with the suggested figure and date already filled in.
  q.set('target', String(s.goal.target))
  if (s.goal.deadline) q.set('deadline', s.goal.deadline.slice(0, 10))
  return `/goals?${q.toString()}`
}

/**
 * Warnings under «Esta semana»: muscles that will end the week short of the program, planned
 * exercises skipped in the sessions done, and a first goal when there is none. Renders nothing
 * when all is in order.
 */
export function WeekWarnings({ now, program }: { now: Date; program: Program | null }) {
  const me = useMe()
  const workoutsQ = useWorkouts()
  const setsQ = useSets()
  const scans = useScans().data
  const goalsQ = useGoals()
  const lookup = useExerciseLookup()
  const workouts = workoutsQ.data
  const sets = setsQ.data

  const gaps = useMemo(() => {
    if (!program || !workouts || !sets || mesoWeek(program, now).deload) return []
    return volumeGaps({
      days: program.days,
      sets,
      doneDayIds: doneDayIdsThisWeek(workouts, program, now),
      trainedToday: finishedToday(workouts, now) != null,
      lookup,
      now,
      focus: FOCUS_MUSCLES,
    })
  }, [program, workouts, sets, lookup, now])

  const skipped = useMemo(
    () =>
      workouts && sets
        ? skipsLine(weekSkips(workouts, sets, lookup, now), (id) => lookup(id).name)
        : '',
    [workouts, sets, lookup, now],
  )

  const goals = goalsQ.data
  const hasActiveGoal = (goals ?? []).some((g) => !g.achievedAt)
  const suggestions = useMemo(() => {
    if (!goals || hasActiveGoal || !sets || !workouts || !scans) return []
    const lifts = mainLifts(sets, lookup).map((l) => ({
      id: l.exercise.id,
      name: l.exercise.name,
      increment: l.exercise.increment,
    }))
    return goalSuggestions({
      sets,
      workouts,
      scans,
      now,
      lifts,
      existing: goals,
      weeklyTarget: me.weeklyTarget,
    }).slice(0, 2)
  }, [goals, hasActiveGoal, sets, workouts, scans, lookup, now, me.weeklyTarget])
  const askGoal = Boolean(goals) && !hasActiveGoal

  if (!gaps.length && !skipped && !askGoal) return null

  return (
    <div className="mt-5 divide-y divide-line border-t border-line">
      {gaps.length > 0 && (
        <div className="py-4">
          <h3 className="spec text-warn">Por detrás del plan</h3>
          <ul className="mt-3 flex flex-col gap-4">
            {gaps.map((g) => (
              <li key={g.muscle}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[14.5px] font-medium">{MUSCLE_LABEL[g.muscle]}</span>
                  <span className="readout shrink-0 text-[16px] font-semibold text-ink-2">
                    {formatNumber(g.done, 1)}
                    <span className="ml-1 font-sans text-[12.5px] font-normal text-muted">
                      de {formatNumber(g.planned, 1)} series
                    </span>
                  </span>
                </div>
                <Meter
                  className="mt-2"
                  value={g.done}
                  max={g.planned}
                  color="var(--warn)"
                  label={`${MUSCLE_LABEL[g.muscle]}: ${formatNumber(g.done, 1)} de ${formatNumber(g.planned, 1)} series`}
                />
                <p className="mt-1 text-[12.5px] text-muted">{recoverSentence(g, now)}</p>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[12px] text-muted">
            Series efectivas de esta semana frente a las que pide tu programa (secundario = ½).
          </p>
        </div>
      )}

      {skipped && (
        <p className="py-4 text-[13.5px] text-ink-2">
          <span className="spec mr-2 text-warn">Saltados</span>
          {skipped}
        </p>
      )}

      {askGoal && (
        <div className="py-4">
          <h3 className="spec text-ink-2">
            {goals?.length ? 'Ponte un objetivo nuevo' : 'Crea tu primer objetivo'}
          </h3>
          <ul className="mt-1 divide-y divide-line">
            {(suggestions.length
              ? suggestions.map((s) => ({ key: s.key, label: s.label, to: goalHref(s) }))
              : [{ key: 'new', label: 'Elegir objetivo', to: '/goals?new=e1rm' }]
            ).map((r) => (
              <li key={r.key}>
                <Link
                  to={r.to}
                  className="flex min-h-11 items-center justify-between gap-3 py-2 text-[14.5px]"
                >
                  <span className="min-w-0 break-words">{r.label}</span>
                  <ChevronRight className="size-4 shrink-0 text-gold" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
