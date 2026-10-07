/**
 * Gym machines: personal settings packed into one text column, the deep link a QR points at and
 * brand/model suggestions for the equipment lines Fitness Park España uses (docs/research.md
 * §3.4: catalogue models of the brands present; which ones a club has must be confirmed there).
 */

export interface MachineSetting {
  /** "Asiento", "Respaldo"… Empty for a free note. */
  name: string
  value: string
}

/** Common adjustments offered as quick names. */
export const SETTING_NAMES = ['Asiento', 'Respaldo', 'Agarre', 'Rodillo', 'Brazo', 'Pies', 'Topes']

const SEP = ' · '

/** "Asiento: 4 · Respaldo: 2" → [{name:'Asiento',value:'4'}, …]. Also reads ";" and new lines. */
export function parseSettings(text: string | null | undefined): MachineSetting[] {
  if (!text) return []
  return text
    .split(/\s·\s|;|\n/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const i = part.indexOf(':')
      if (i <= 0) return { name: '', value: part }
      return { name: part.slice(0, i).trim(), value: part.slice(i + 1).trim() }
    })
}

/** Inverse of {@link parseSettings}; drops empty values. Null when nothing is left. */
export function serializeSettings(settings: readonly MachineSetting[]): string | null {
  const parts = settings
    .map((s) => ({
      name: s.name.replace(/[:·;\n]/g, ' ').trim(),
      value: s.value.replace(/[·;\n]/g, ' ').trim(),
    }))
    .filter((s) => s.value)
    .map((s) => (s.name ? `${s.name}: ${s.value}` : s.value))
  return parts.length ? parts.join(SEP) : null
}

/** Deep link to a machine inside this installation (works on Pages and on localhost). */
export function machineUrl(id: string, loc: Pick<Location, 'origin' | 'pathname'>): string {
  return `${loc.origin}${loc.pathname}#/m/${id}`
}

/** A file name without accents, spaces or symbols: "Press hombro (Pure)" → "press-hombro-pure". */
export function fileSlug(label: string): string {
  return (
    label
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'maquina'
  )
}

export interface BrandLine {
  brand: string
  kind: string
  models: string[]
}

/** Suggestions only: nothing here is stored until the person picks it for a machine. */
export const BRAND_LINES: BrandLine[] = [
  {
    brand: 'Technogym Pure Strength',
    kind: 'Discos',
    models: [
      'Shoulder Press',
      'Biceps',
      'Pullover',
      'Low Row',
      'Row',
      'Linear Leg Press',
      'Hack Squat',
      'Hip Thrust',
      'Standing Abductor',
    ],
  },
  {
    brand: 'Technogym Selection',
    kind: 'Placas',
    models: [
      'Arm Extension',
      'Arm Curl',
      'Leg Extension',
      'Leg Curl',
      'Chest Press',
      'Lat Machine',
      'Low Row',
      'Shoulder Press',
      'Pectoral / Rear Delt',
      'Abductor / Adductor',
      'Leg Press',
    ],
  },
  {
    brand: 'Hammer Strength Plate-Loaded',
    kind: 'Discos',
    models: [
      'Iso-Lateral Low Row',
      'Iso-Lateral Wide Pulldown',
      'Iso-Lateral Chest/Back',
      'Iso-Lateral Decline Press',
      'Iso-Lateral Leg Curl',
      'Seated Biceps',
    ],
  },
  {
    brand: 'Hammer Strength MTS',
    kind: 'Placas',
    models: ['Iso-Lateral Biceps Curl', 'Iso-Lateral Triceps Extension'],
  },
  {
    brand: 'Hammer Strength Select',
    kind: 'Placas',
    models: ['Biceps Curl', 'Triceps Extension'],
  },
  {
    brand: 'Eleiko',
    kind: 'Peso libre',
    models: ['Barra olímpica', 'Mancuernas', 'Plataforma', 'Rack'],
  },
]

export const BRAND_SUGGESTIONS = BRAND_LINES.map((l) => l.brand)

export function modelsFor(brand: string): string[] {
  const b = brand.trim().toLowerCase()
  return BRAND_LINES.find((l) => l.brand.toLowerCase() === b)?.models ?? []
}
