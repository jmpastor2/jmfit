/**
 * Program templates. Day ids and slot ids are stable: workouts reference them.
 * Slot ids are `${dayId}-${n}` (1-based position), so never reorder slots of a shipped day;
 * append new slots at the end instead.
 *
 * Default prescription: RIR 2 on compounds, RIR 1 on isolation; rest from the exercise catalog.
 */
import type { ProgramDay, ProgramTemplate, Slot } from '@/domain/types'
import { exerciseById } from './exercises'

interface SlotOpts {
  rir?: number
  restSec?: number
  note?: string
  superset?: string
}

type SlotDef = Omit<Slot, 'id'>

/** sets × repMin–repMax of an exercise, RIR and rest defaulted from the catalog. */
function s(
  exerciseId: string,
  sets: number,
  repMin: number,
  repMax = repMin,
  o: SlotOpts = {},
): SlotDef {
  const ex = exerciseById(exerciseId)
  if (!ex) throw new Error(`Unknown exercise in program: ${exerciseId}`)
  const slot: SlotDef = {
    exerciseId,
    sets,
    repMin,
    repMax,
    rir: o.rir ?? (ex.compound ? 2 : 1),
    restSec: o.restSec ?? ex.restSec,
  }
  if (o.note) slot.note = o.note
  if (o.superset) slot.superset = o.superset
  return slot
}

function day(
  id: string,
  name: string,
  focus: string,
  weekday: number | null,
  slots: SlotDef[],
): ProgramDay {
  return { id, name, focus, weekday, slots: slots.map((x, i) => ({ id: `${id}-${i + 1}`, ...x })) }
}

const SECONDS = 'Segundos por serie, no repeticiones'
const SUPERSET = 'Superserie: alterna con el otro ejercicio de la letra sin descanso entre ambos'

/** Shift every slot to lower effort for maintenance phases. */
const easy = (x: SlotDef): SlotDef => ({ ...x, rir: x.rir + 1 })

const MON = 0
const TUE = 1
const WED = 2
const THU = 3
const FRI = 4
const SAT = 5

export const PROGRAM_TEMPLATES: readonly ProgramTemplate[] = [
  {
    id: 'jm-ppl-arms-5',
    name: 'PPL + Brazos · 5 días',
    description:
      'Empuje, tirón y pierna, más un día de hombro y brazos y un día de torso. Hipertrofia con especialización de brazos.',
    goal: ['hypertrophy'],
    level: ['intermediate', 'advanced'],
    daysPerWeek: 5,
    mesoWeeks: 6,
    days: [
      day('jm5-push', 'Empuje', 'Pecho · Hombro · Tríceps', MON, [
        s('bench-press', 4, 6, 8),
        s('incline-dumbbell-press', 3, 8, 10),
        s('low-cable-fly', 3, 10, 12),
        s('overhead-press', 3, 8, 10),
        s('dips', 3, 8, 10, { note: 'Lastrados' }),
      ]),
      day('jm5-pull', 'Tirón', 'Espalda · Bíceps', TUE, [
        s('deadlift', 4, 5, 6),
        s('pendlay-row', 4, 8),
        s('pull-up', 3, 6, 8, { note: 'Lastradas' }),
        s('seated-cable-row', 3, 10, 12),
        s('barbell-curl', 3, 8, 10),
        s('hammer-curl', 3, 10, 12),
      ]),
      day('jm5-legs', 'Pierna', 'Cuádriceps · Isquios · Gemelos', WED, [
        s('squat', 4, 6, 8),
        s('leg-press', 3, 10, 12),
        s('leg-extension', 3, 12, 15),
        s('lying-leg-curl', 3, 10, 12),
        s('romanian-deadlift', 3, 10),
        s('standing-calf-raise', 4, 12, 15),
      ]),
      day('jm5-arms', 'Hombro y brazos', 'Hombro · Bíceps · Tríceps', THU, [
        s('arnold-press', 4, 8, 10),
        s('cable-lateral-raise', 4, 12, 15),
        s('preacher-curl', 3, 8, 10),
        s('concentration-curl', 2, 10, 12),
        s('skull-crusher', 3, 10),
        s('triceps-pushdown', 3, 12),
      ]),
      day('jm5-torso', 'Torso', 'Pecho · Espalda · Brazos · Core', FRI, [
        s('close-grip-bench-press', 4, 6, 8),
        s('one-arm-dumbbell-row', 4, 8, 10),
        s('pec-deck', 3, 12),
        s('incline-dumbbell-curl', 3, 10, 10, { superset: 'A', note: SUPERSET }),
        s('overhead-cable-extension', 3, 10, 10, { superset: 'A', note: SUPERSET }),
        s('plank', 3, 45, 45, { note: SECONDS }),
        s('ab-wheel', 3, 12),
      ]),
    ],
  },
  {
    id: 'ppl-6',
    name: 'Empuje · Tirón · Pierna · 6 días',
    description:
      'Cada grupo muscular dos veces por semana con variantes distintas en cada vuelta. Para quien ya tiene base y tiempo para entrenar a diario.',
    goal: ['hypertrophy'],
    level: ['intermediate', 'advanced'],
    daysPerWeek: 6,
    mesoWeeks: 5,
    days: [
      day('ppl6-push-1', 'Empuje A', 'Pecho · Hombro · Tríceps', MON, [
        s('bench-press', 4, 6, 8),
        s('incline-dumbbell-press', 3, 8, 10),
        s('seated-dumbbell-press', 3, 8, 10),
        s('cable-lateral-raise', 3, 12, 15),
        s('triceps-pushdown', 3, 10, 12),
        s('overhead-cable-extension', 2, 10, 12),
      ]),
      day('ppl6-pull-1', 'Tirón A', 'Espalda · Deltoides posterior · Bíceps', TUE, [
        s('pull-up', 4, 6, 8),
        s('barbell-row', 3, 8, 10),
        s('seated-cable-row', 3, 10, 12),
        s('face-pull', 3, 12, 15),
        s('ez-bar-curl', 3, 8, 10),
        s('hammer-curl', 2, 10, 12),
      ]),
      day('ppl6-legs-1', 'Pierna A', 'Cuádriceps · Isquios · Gemelos', WED, [
        s('squat', 4, 6, 8),
        s('romanian-deadlift', 3, 8, 10),
        s('leg-press', 3, 10, 12),
        s('lying-leg-curl', 3, 10, 12),
        s('standing-calf-raise', 4, 10, 12),
        s('cable-crunch', 3, 10, 12),
      ]),
      day('ppl6-push-2', 'Empuje B', 'Hombro · Pecho · Tríceps', THU, [
        s('overhead-press', 4, 6, 8),
        s('plate-loaded-incline-press', 3, 8, 10),
        s('dips', 3, 8, 10),
        s('cable-crossover', 3, 12, 15),
        s('dumbbell-lateral-raise', 4, 12, 15),
        s('skull-crusher', 3, 10, 12),
      ]),
      day('ppl6-pull-2', 'Tirón B', 'Espalda · Deltoides posterior · Bíceps', FRI, [
        s('lat-pulldown', 4, 8, 10),
        s('chest-supported-dumbbell-row', 3, 8, 10),
        s('plate-loaded-row', 3, 10, 12),
        s('reverse-pec-deck', 3, 12, 15),
        s('incline-dumbbell-curl', 3, 10, 12),
        s('cable-curl', 2, 12, 15),
      ]),
      day('ppl6-legs-2', 'Pierna B', 'Cuádriceps · Glúteo · Isquios', SAT, [
        s('hack-squat', 4, 8, 10),
        s('bulgarian-split-squat', 3, 8, 10),
        s('hip-thrust', 3, 8, 10),
        s('seated-leg-curl', 3, 10, 12),
        s('leg-extension', 3, 12, 15),
        s('seated-calf-raise', 4, 12, 15),
      ]),
    ],
  },
  {
    id: 'upper-lower-4',
    name: 'Torso / Pierna · 4 días',
    description:
      'Dos días de torso y dos de pierna: cada músculo dos veces por semana con buen equilibrio entre carga y recuperación.',
    goal: ['hypertrophy', 'recomp', 'strength'],
    level: ['novice', 'intermediate'],
    daysPerWeek: 4,
    mesoWeeks: 5,
    days: [
      day('ul4-upper-1', 'Torso A', 'Pecho · Espalda · Hombro · Brazos', MON, [
        s('bench-press', 4, 6, 8),
        s('barbell-row', 4, 6, 8),
        s('seated-dumbbell-press', 3, 8, 10),
        s('lat-pulldown', 3, 8, 10),
        s('ez-bar-curl', 3, 10, 12),
        s('triceps-pushdown', 3, 10, 12),
      ]),
      day('ul4-lower-1', 'Pierna A', 'Cuádriceps · Isquios · Gemelos', TUE, [
        s('squat', 4, 6, 8),
        s('romanian-deadlift', 3, 8, 10),
        s('leg-press', 3, 10, 12),
        s('lying-leg-curl', 3, 10, 12),
        s('standing-calf-raise', 4, 10, 12),
      ]),
      day('ul4-upper-2', 'Torso B', 'Pecho · Espalda · Hombro · Brazos', THU, [
        s('incline-dumbbell-press', 4, 8, 10),
        s('pull-up', 4, 6, 8),
        s('seated-cable-row', 3, 10, 12),
        s('cable-lateral-raise', 3, 12, 15),
        s('incline-dumbbell-curl', 3, 10, 12),
        s('overhead-cable-extension', 3, 10, 12),
      ]),
      day('ul4-lower-2', 'Pierna B', 'Isquios · Glúteo · Cuádriceps', FRI, [
        s('deadlift', 3, 5, 6),
        s('hack-squat', 3, 8, 10),
        s('bulgarian-split-squat', 3, 8, 10),
        s('seated-leg-curl', 3, 10, 12),
        s('leg-extension', 3, 12, 15),
        s('seated-calf-raise', 3, 12, 15),
      ]),
    ],
  },
  {
    id: 'full-body-3',
    name: 'Cuerpo completo · 3 días',
    description:
      'Tres sesiones de cuerpo completo con los básicos y máquinas sencillas. Ideal para empezar: mucha práctica técnica y progresión rápida.',
    goal: ['hypertrophy', 'recomp', 'strength'],
    level: ['novice'],
    daysPerWeek: 3,
    mesoWeeks: 6,
    days: [
      day('fb3-a', 'Cuerpo completo A', 'Sentadilla · Press banca · Remo', MON, [
        s('squat', 3, 6, 8),
        s('bench-press', 3, 6, 8),
        s('seated-cable-row', 3, 10, 12),
        s('dumbbell-lateral-raise', 2, 12, 15),
        s('plank', 3, 30, 30, { note: SECONDS }),
      ]),
      day('fb3-b', 'Cuerpo completo B', 'Bisagra · Hombro · Jalón', WED, [
        s('romanian-deadlift', 3, 8, 10),
        s('seated-dumbbell-press', 3, 8, 10),
        s('lat-pulldown', 3, 10, 12),
        s('leg-press', 3, 10, 12),
        s('dumbbell-curl', 2, 10, 12),
        s('triceps-pushdown', 2, 10, 12),
      ]),
      day('fb3-c', 'Cuerpo completo C', 'Peso muerto · Inclinado · Dominadas', FRI, [
        s('deadlift', 3, 5, 6),
        s('incline-dumbbell-press', 3, 8, 10),
        s('assisted-pull-up-machine', 3, 6, 8),
        s('leg-extension', 2, 12, 15),
        s('lying-leg-curl', 2, 10, 12),
        s('cable-crunch', 2, 10, 12),
      ]),
    ],
  },
  {
    id: 'glutes-4',
    name: 'Tren inferior y glúteo · 4 días',
    description:
      'Tres días de pierna con prioridad en glúteo (empuje de cadera, bisagra y zancadas) y un día de torso para mantener el tren superior.',
    goal: ['glutes', 'hypertrophy'],
    level: ['novice', 'intermediate'],
    daysPerWeek: 4,
    mesoWeeks: 5,
    days: [
      day('gl4-glute-quad', 'Glúteo y cuádriceps', 'Glúteo · Cuádriceps', MON, [
        s('hip-thrust', 4, 8, 10),
        s('bulgarian-split-squat', 3, 8, 10),
        s('leg-press', 3, 10, 12, { note: 'Pies altos en la plataforma' }),
        s('hip-abduction', 3, 15, 20),
        s('standing-calf-raise', 3, 12, 15),
      ]),
      day('gl4-upper', 'Torso', 'Espalda · Pecho · Hombro', TUE, [
        s('lat-pulldown', 3, 10, 12),
        s('machine-chest-press', 3, 8, 10),
        s('seated-cable-row', 3, 10, 12),
        s('seated-dumbbell-press', 3, 10, 12),
        s('cable-lateral-raise', 3, 12, 15),
        s('plank', 3, 30, 45, { note: SECONDS }),
      ]),
      day('gl4-glute-ham', 'Glúteo e isquios', 'Glúteo · Isquios', THU, [
        s('romanian-deadlift', 4, 8, 10),
        s('machine-hip-thrust', 3, 10, 12),
        s('lying-leg-curl', 3, 10, 12),
        s('cable-glute-kickback', 3, 12, 15),
        s('back-extension', 3, 12, 15, { note: 'Espalda redondeada ligeramente y foco en glúteo' }),
      ]),
      day('gl4-lower', 'Pierna completa', 'Glúteo · Cuádriceps · Aductores', SAT, [
        s('squat', 4, 6, 8),
        s('walking-lunge', 3, 10, 12, { note: 'Repeticiones por pierna' }),
        s('cable-pull-through', 3, 12, 15),
        s('seated-leg-curl', 3, 10, 12),
        s('hip-abduction', 3, 15, 20),
        s('hip-adduction', 2, 12, 15),
      ]),
    ],
  },
  {
    id: 'strength-4',
    name: 'Fuerza · 4 días',
    description:
      'Un día para cada básico (sentadilla, banca, peso muerto y press militar) en rangos de 3 a 5 repeticiones, con accesorios en rangos medios.',
    goal: ['strength'],
    level: ['intermediate', 'advanced'],
    daysPerWeek: 4,
    mesoWeeks: 4,
    days: [
      day('str4-squat', 'Sentadilla', 'Sentadilla · Pierna', MON, [
        s('squat', 5, 3, 5, { restSec: 180 }),
        s('romanian-deadlift', 3, 6, 8),
        s('leg-press', 3, 8, 10),
        s('standing-calf-raise', 3, 10, 12),
        s('ab-wheel', 3, 8, 10),
      ]),
      day('str4-bench', 'Press banca', 'Banca · Espalda · Tríceps', TUE, [
        s('bench-press', 5, 3, 5, { restSec: 180 }),
        s('barbell-row', 4, 6, 8),
        s('close-grip-bench-press', 3, 6, 8),
        s('pull-up', 3, 5, 8),
        s('triceps-pushdown', 3, 10, 12),
      ]),
      day('str4-deadlift', 'Peso muerto', 'Peso muerto · Cadena posterior', THU, [
        s('deadlift', 4, 3, 5, { restSec: 180 }),
        s('front-squat', 3, 4, 6),
        s('lying-leg-curl', 3, 8, 10),
        s('back-extension', 3, 10, 12),
        s('hanging-leg-raise', 3, 8, 12),
      ]),
      day('str4-press', 'Press militar', 'Press militar · Torso', FRI, [
        s('overhead-press', 5, 3, 5, { restSec: 180 }),
        s('incline-bench-press', 3, 6, 8),
        s('chin-up', 4, 5, 8),
        s('dumbbell-lateral-raise', 3, 12, 15),
        s('ez-bar-curl', 3, 8, 10),
      ]),
    ],
  },
  {
    id: 'maintenance-3',
    name: 'Mantenimiento · 3 días',
    description:
      'Volumen mínimo eficaz (unas dos terceras partes de las series habituales) a RIR 2–3. Para mantener músculo y fuerza en épocas de mucho trabajo, viajes o definición.',
    goal: ['maintenance', 'cut'],
    level: ['novice', 'intermediate', 'advanced'],
    daysPerWeek: 3,
    mesoWeeks: 8,
    days: [
      day(
        'mnt3-a',
        'Mantenimiento A',
        'Sentadilla · Banca · Remo',
        MON,
        [
          s('squat', 2, 6, 8),
          s('bench-press', 3, 6, 8),
          s('seated-cable-row', 2, 8, 10),
          s('cable-lateral-raise', 2, 12, 15),
          s('ez-bar-curl', 2, 10, 12),
        ].map(easy),
      ),
      day(
        'mnt3-b',
        'Mantenimiento B',
        'Bisagra · Militar · Dominadas',
        WED,
        [
          s('romanian-deadlift', 2, 8, 10),
          s('overhead-press', 2, 6, 8),
          s('pull-up', 3, 6, 8),
          s('leg-extension', 2, 12, 15),
          s('triceps-pushdown', 2, 10, 12),
        ].map(easy),
      ),
      day(
        'mnt3-c',
        'Mantenimiento C',
        'Prensa · Inclinado · Remo',
        FRI,
        [
          s('leg-press', 2, 10, 12),
          s('incline-dumbbell-press', 2, 8, 10),
          s('one-arm-dumbbell-row', 2, 8, 10),
          s('lying-leg-curl', 2, 10, 12),
          s('dumbbell-lateral-raise', 2, 12, 15),
          s('hammer-curl', 2, 10, 12),
        ].map(easy),
      ),
    ],
  },
  {
    id: 'minimal-2',
    name: 'Mínimo · 2 días',
    description:
      'Dos sesiones de cuerpo completo de unos 45 minutos con lo esencial. Para semanas con muy poco tiempo.',
    goal: ['maintenance', 'hypertrophy', 'recomp'],
    level: ['novice', 'intermediate', 'advanced'],
    daysPerWeek: 2,
    mesoWeeks: 6,
    days: [
      day('min2-a', 'Mínimo A', 'Sentadilla · Banca · Jalón', MON, [
        s('squat', 3, 6, 8),
        s('bench-press', 3, 6, 8),
        s('lat-pulldown', 3, 8, 10),
        s('romanian-deadlift', 2, 8, 10),
        s('cable-lateral-raise', 2, 12, 15),
      ]),
      day('min2-b', 'Mínimo B', 'Prensa · Militar · Remo · Brazos', THU, [
        s('leg-press', 3, 8, 10),
        s('overhead-press', 3, 6, 8),
        s('seated-cable-row', 3, 8, 10),
        s('lying-leg-curl', 2, 10, 12),
        s('dumbbell-curl', 2, 10, 12),
        s('triceps-pushdown', 2, 10, 12),
      ]),
    ],
  },
]

const TEMPLATE_BY_ID = new Map(PROGRAM_TEMPLATES.map((t) => [t.id, t]))

export function templateById(id: string): ProgramTemplate | undefined {
  return TEMPLATE_BY_ID.get(id)
}
