/**
 * Pick the program template that best fits the person: goal first, then level, then how close
 * its days per week are to the ones they plan to train.
 */
import type { Experience, Goal, ProgramTemplate } from '@/domain/types'
import { EXPERIENCE_LABEL, GOAL_LABEL } from './labels'

export interface TemplateFit {
  template: ProgramTemplate
  /** One Spanish line saying why. */
  reason: string
  score: number
}

/** Goals that train close enough to stand in for each other when nothing matches exactly. */
const RELATED_GOALS: Record<Goal, Goal[]> = {
  hypertrophy: ['recomp', 'glutes'],
  strength: ['hypertrophy'],
  recomp: ['hypertrophy', 'cut'],
  cut: ['recomp', 'maintenance'],
  maintenance: ['cut', 'recomp'],
  glutes: ['hypertrophy'],
}

const LEVEL_RANK: Record<Experience, number> = { novice: 0, intermediate: 1, advanced: 2 }

export function scoreTemplate(
  t: Pick<ProgramTemplate, 'goal' | 'level' | 'daysPerWeek'>,
  me: { trainingGoal: Goal; experience: Experience; weeklyTarget: number },
): number {
  let score = 0
  if (t.goal.includes(me.trainingGoal)) score += 100
  else if (t.goal.some((g) => RELATED_GOALS[me.trainingGoal].includes(g))) score += 40

  if (t.level.includes(me.experience)) score += 30
  else {
    const gap = Math.min(...t.level.map((l) => Math.abs(LEVEL_RANK[l] - LEVEL_RANK[me.experience])))
    score += gap === 1 ? 10 : 0
  }

  const dayGap = Math.abs(t.daysPerWeek - me.weeklyTarget)
  // More days than planned hurts more than fewer: a missed session breaks the week.
  score -= t.daysPerWeek > me.weeklyTarget ? dayGap * 12 : dayGap * 8
  return score
}

function reasonFor(
  t: ProgramTemplate,
  me: { trainingGoal: Goal; experience: Experience; weeklyTarget: number },
): string {
  const parts: string[] = []
  const goal = GOAL_LABEL[me.trainingGoal].toLowerCase()
  parts.push(t.goal.includes(me.trainingGoal) ? `pensado para ${goal}` : `lo más cercano a ${goal}`)
  if (t.level.includes(me.experience)) {
    parts.push(`nivel ${EXPERIENCE_LABEL[me.experience].toLowerCase()}`)
  }
  const days =
    t.daysPerWeek === me.weeklyTarget
      ? `tus ${me.weeklyTarget} días por semana`
      : `${t.daysPerWeek} días por semana (tú planeas ${me.weeklyTarget})`
  parts.push(days)
  const text =
    parts.length === 3 ? `${parts[0]}, ${parts[1]} y ${parts[2]}` : `${parts[0]} y ${parts[1]}`
  return text.charAt(0).toUpperCase() + text.slice(1) + '.'
}

/** Best template for the person, or null when there are no templates. Ties keep catalog order. */
export function recommendTemplate(
  templates: readonly ProgramTemplate[],
  me: { trainingGoal: Goal; experience: Experience; weeklyTarget: number },
): TemplateFit | null {
  let best: TemplateFit | null = null
  for (const template of templates) {
    const score = scoreTemplate(template, me)
    if (!best || score > best.score) best = { template, score, reason: '' }
  }
  if (!best) return null
  return { ...best, reason: reasonFor(best.template, me) }
}
