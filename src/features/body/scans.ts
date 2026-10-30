/**
 * Body composition helpers: which scan to compare with, whether a change is good news, the
 * metrics the screen shows. Pure functions over `Scan[]` (oldest first).
 */
import { formatNumber } from '@/domain/training'
import type { Scan } from '@/domain/types'

export type ScanMetric = Exclude<keyof Scan, 'date'>

/** Which direction is good news for Jose Manuel (more muscle, less fat); null = neutral. */
export type GoodWhen = 'up' | 'down' | null

export interface MetricDef {
  key: ScanMetric
  label: string
  short: string
  unit: string
  decimals: number
  good: GoodWhen
}

export const METRIC_DEFS: Record<ScanMetric, MetricDef> = {
  peso: { key: 'peso', label: 'Peso', short: 'Peso', unit: 'kg', decimals: 1, good: null },
  grasa: { key: 'grasa', label: '% grasa', short: '% grasa', unit: '%', decimals: 1, good: 'down' },
  grasaKg: {
    key: 'grasaKg',
    label: 'Grasa',
    short: 'Grasa kg',
    unit: 'kg',
    decimals: 1,
    good: 'down',
  },
  musculo: {
    key: 'musculo',
    label: 'Masa muscular',
    short: 'Músculo',
    unit: 'kg',
    decimals: 1,
    good: 'up',
  },
  agua: { key: 'agua', label: 'Agua', short: 'Agua', unit: 'kg', decimals: 1, good: null },
  aguaIntra: {
    key: 'aguaIntra',
    label: 'Agua intracelular',
    short: 'Agua intra',
    unit: 'kg',
    decimals: 1,
    good: null,
  },
  aguaExtra: {
    key: 'aguaExtra',
    label: 'Agua extracelular',
    short: 'Agua extra',
    unit: 'kg',
    decimals: 1,
    good: null,
  },
  hueso: { key: 'hueso', label: 'Masa ósea', short: 'Hueso', unit: 'kg', decimals: 1, good: null },
  visceral: {
    key: 'visceral',
    label: 'Grasa visceral',
    short: 'Visceral',
    unit: '',
    decimals: 1,
    good: 'down',
  },
  tmb: {
    key: 'tmb',
    label: 'Metabolismo basal',
    short: 'TMB',
    unit: 'kcal',
    decimals: 0,
    good: null,
  },
  edadMet: {
    key: 'edadMet',
    label: 'Edad metabólica',
    short: 'Edad met.',
    unit: 'años',
    decimals: 0,
    good: 'down',
  },
  imc: { key: 'imc', label: 'IMC', short: 'IMC', unit: '', decimals: 1, good: null },
  score: {
    key: 'score',
    label: 'Puntuación Boditrax',
    short: 'Score',
    unit: '',
    decimals: 0,
    good: 'up',
  },
  masaMagra: {
    key: 'masaMagra',
    label: 'Masa libre de grasa',
    short: 'Magra',
    unit: 'kg',
    decimals: 1,
    good: 'up',
  },
  legScore: {
    key: 'legScore',
    label: 'Puntuación de pierna',
    short: 'Pierna',
    unit: '',
    decimals: 0,
    good: 'up',
  },
}

/** Order of the hero block and of the comparator table. */
export const HERO_METRICS: ScanMetric[] = [
  'peso',
  'grasa',
  'musculo',
  'visceral',
  'edadMet',
  'score',
  'agua',
  'tmb',
]
export const COMPARE_METRICS: ScanMetric[] = [
  'peso',
  'grasa',
  'grasaKg',
  'musculo',
  'masaMagra',
  'visceral',
  'agua',
  'aguaIntra',
  'aguaExtra',
  'hueso',
  'tmb',
  'edadMet',
  'imc',
  'score',
  'legScore',
]
export const CHART_METRICS: ScanMetric[] = [
  'peso',
  'grasa',
  'musculo',
  'grasaKg',
  'visceral',
  'score',
]

/** Days after which a new scan is due. */
export const SCAN_DUE_DAYS = 28

const DAY = 86_400_000
const t = (iso: string) => Date.parse(iso.length === 10 ? iso + 'T12:00:00' : iso)

export function daysBetween(fromIso: string, to: Date): number {
  return Math.floor((to.getTime() - t(fromIso)) / DAY)
}

/** The latest scan taken at least `days` days before `ref` (the "hace 3 meses" baseline). */
export function scanBefore(scans: readonly Scan[], ref: string, days: number): Scan | null {
  const limit = t(ref) - days * DAY
  let out: Scan | null = null
  for (const s of scans) if (t(s.date) <= limit) out = s
  return out
}

export type Tone = 'good' | 'bad' | 'neutral'

export function deltaTone(metric: ScanMetric, diff: number): Tone {
  const good = METRIC_DEFS[metric].good
  if (!good || Math.abs(diff) < 1e-9) return 'neutral'
  return diff > 0 === (good === 'up') ? 'good' : 'bad'
}

export interface MetricDelta {
  metric: ScanMetric
  from: number | null
  to: number | null
  diff: number | null
  tone: Tone
}

export function metricDelta(metric: ScanMetric, from: Scan | null, to: Scan | null): MetricDelta {
  const a = from?.[metric] ?? null
  const b = to?.[metric] ?? null
  const diff = a !== null && b !== null ? Math.round((b - a) * 1000) / 1000 : null
  return { metric, from: a, to: b, diff, tone: diff === null ? 'neutral' : deltaTone(metric, diff) }
}

/** Differences from scan A to scan B for every metric both have. */
export function compareScans(
  a: Scan,
  b: Scan,
  metrics: readonly ScanMetric[] = COMPARE_METRICS,
): MetricDelta[] {
  return metrics.map((m) => metricDelta(m, a, b)).filter((d) => d.from !== null || d.to !== null)
}

export function formatMetric(metric: ScanMetric, v: number): string {
  return formatNumber(v, METRIC_DEFS[metric].decimals)
}

/** "+0,4" / "−1,2" with the metric's decimals. */
export function formatSigned(metric: ScanMetric, diff: number): string {
  const s = formatNumber(Math.abs(diff), METRIC_DEFS[metric].decimals)
  if (s === '0') return '0'
  return `${diff > 0 ? '+' : '−'}${s}`
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** "2026-09-10" → "10 sep 2026". */
export function longDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return iso
  return `${d} ${MONTHS[m - 1]} ${y}`
}

/** Whole number with Spanish thousands dots: 10234 → "10.234". */
export function formatInt(n: number): string {
  const r = Math.round(n)
  const s = String(Math.abs(r)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return r < 0 ? `-${s}` : s
}

/** Text typed in a field ("78,4", " 78.4 ", "") → number or null. */
export function parseDecimal(text: string): number | null {
  const s = text.trim().replace(',', '.')
  if (!s) return null
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null
  return Number(s)
}

export interface ChangeQuality {
  days: number
  weight: number
  fat: number
  /** Everything but fat (muscle, water, glycogen, bone): weight − fat. */
  lean: number
  water: number | null
  /** Share of the weight change that is fat (0…1, clamped), when the weight moved. */
  fatShare: number | null
  verdict: { tone: Tone; text: string } | null
}

const fatKg = (s: Scan) =>
  s.grasaKg ?? (s.peso != null && s.grasa != null ? (s.peso * s.grasa) / 100 : null)
const round1 = (n: number) => Math.round(n * 10) / 10
const kg1 = (n: number) => `${n.toLocaleString('es-ES', { maximumFractionDigits: 1 })} kg`

/**
 * What a change of weight between two scans was made of: fat or lean mass. Losing weight while
 * most of it is lean mass means too big a deficit or too little protein for someone after muscle;
 * gaining with most of it fat, too big a surplus. Under 1 kg of change it only names a
 * recomposition (less fat and more lean at the same weight).
 */
export function changeQuality(from: Scan | null, to: Scan): ChangeQuality | null {
  if (!from || from.peso == null || to.peso == null) return null
  const f0 = fatKg(from)
  const f1 = fatKg(to)
  if (f0 == null || f1 == null) return null
  const weight = round1(to.peso - from.peso)
  const fat = round1(f1 - f0)
  const lean = round1(weight - fat)
  const water = from.agua != null && to.agua != null ? round1(to.agua - from.agua) : null
  const moved = Math.abs(weight) >= 1
  const fatShare = moved ? Math.min(1, Math.max(0, fat / weight)) : null
  const protein = `${Math.round(to.peso * 1.8)}–${Math.round(to.peso * 2.2)} g de proteína al día`
  let verdict: ChangeQuality['verdict'] = null
  if (fatShare != null && weight < 0) {
    verdict =
      fatShare >= 0.6
        ? { tone: 'good', text: 'Lo que pierdes es sobre todo grasa: buen ritmo, mantenlo.' }
        : fatShare >= 0.3
          ? {
              tone: 'neutral',
              text: `Pierdes grasa, pero casi lo mismo de masa magra. Frena un poco el déficit y llega a ${protein}.`,
            }
          : {
              tone: 'bad',
              text: `Casi todo lo que pierdes es masa magra, no grasa. Para ganar músculo: come más (sin bajar más de 0,5 kg por semana), ${protein} y series cerca del fallo.`,
            }
  } else if (fatShare != null) {
    verdict =
      fatShare <= 0.4
        ? { tone: 'good', text: 'Lo que ganas es sobre todo masa magra: buen superávit.' }
        : {
            tone: 'bad',
            text: 'Buena parte de lo que ganas es grasa: recorta un poco el superávit.',
          }
  } else if (fat < 0 && lean > 0) {
    verdict = {
      tone: 'good',
      text: `Recomposición: ${kg1(-fat)} menos de grasa y ${kg1(lean)} más de masa magra con el mismo peso.`,
    }
  }
  return {
    days: Math.round((t(to.date) - t(from.date)) / DAY),
    weight,
    fat,
    lean,
    water,
    fatShare,
    verdict,
  }
}
