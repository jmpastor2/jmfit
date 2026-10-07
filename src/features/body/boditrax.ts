/**
 * Parser for the CSV that the official Boditrax exporter produces. Each "User Scan Details"
 * section holds rows `BodyMetricTypeId,value,dd/mm/yyyy[ hh:mm[:ss]]`. Spanish locales write the
 * value with a decimal comma and do not quote it, so `BodyWeight,78,4,10/09/2026` (value split
 * over two columns) is read as 78.4. Pure: no DOM, no clock.
 */
import type { Scan } from '@/domain/types'

/** kJ → kcal. */
export const KJ_PER_KCAL = 4.184

type ScanField = Exclude<keyof Scan, 'date' | 'grasa'>

const METRICS: Record<string, { field: ScanField; convert?: (v: number) => number }> = {
  bodyweight: { field: 'peso' },
  musclemass: { field: 'musculo' },
  fatmass: { field: 'grasaKg' },
  watermass: { field: 'agua' },
  bonemass: { field: 'hueso' },
  visceralfatrating: { field: 'visceral' },
  basalmetabolicratekj: { field: 'tmb', convert: (v) => Math.round(v / KJ_PER_KCAL) },
  metabolicage: { field: 'edadMet' },
  bodymassindex: { field: 'imc' },
  boditraxscore: { field: 'score' },
  intracellularwatermass: { field: 'aguaIntra' },
  extracellularwatermass: { field: 'aguaExtra' },
  fatfreemass: { field: 'masaMagra' },
  legmusclescore: { field: 'legScore' },
}

export interface BoditraxParse {
  /** One scan per date, oldest first. */
  scans: Scan[]
  /** Rows with a known metric that could not be read (bad value or date). */
  skipped: number
}

export function emptyScan(date: string): Scan {
  return {
    date,
    peso: null,
    grasa: null,
    grasaKg: null,
    musculo: null,
    agua: null,
    aguaIntra: null,
    aguaExtra: null,
    hueso: null,
    visceral: null,
    tmb: null,
    edadMet: null,
    imc: null,
    score: null,
    masaMagra: null,
    legScore: null,
  }
}

/** Split one CSV line, honouring double quotes ("78,4" stays one cell). */
export function splitCsvLine(line: string, sep = ','): string[] {
  const out: string[] = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"'
        i++
      } else quoted = !quoted
    } else if (ch === sep && !quoted) {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out.map((c) => c.trim())
}

const DATE_RE = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:[ T].*)?$/

/** "10/09/2026" or "10/09/2026 18:32:00" → "2026-09-10"; null when it is not a valid date. */
export function parseBoditraxDate(cell: string): string | null {
  const m = DATE_RE.exec(cell.trim())
  if (!m) return null
  const d = Number(m[1])
  const mo = Number(m[2])
  const y = Number(m[3])
  const dt = new Date(Date.UTC(y, mo - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** The value cells between the metric and the date: one cell ("78.4"/"78,4") or two ("78","4"). */
function parseValue(cells: string[]): number | null {
  const clean = cells.map((c) => c.replace(/\s/g, '')).filter((c) => c !== '')
  let text: string
  if (clean.length === 1) text = clean[0]!.replace(',', '.')
  else if (clean.length === 2 && /^-?\d+$/.test(clean[0]!) && /^\d+$/.test(clean[1]!))
    text = `${clean[0]}.${clean[1]}`
  else return null
  if (!/^-?\d+(\.\d+)?$/.test(text)) return null
  const n = Number(text)
  return Number.isFinite(n) ? n : null
}

const round1 = (n: number) => Math.round(n * 10) / 10

export function parseBoditraxCsv(text: string): BoditraxParse {
  const byDate = new Map<string, Scan>()
  let skipped = 0
  const sep = text.includes(';') && !text.includes(',') ? ';' : ','
  for (const raw of text.replace(/^﻿/, '').split(/\r?\n/)) {
    if (!raw.trim()) continue
    const cells = splitCsvLine(raw, sep)
    const metric = METRICS[cells[0]!.toLowerCase().replace(/[^a-z]/g, '')]
    if (!metric) continue // section titles, headers and metrics Forja does not keep
    const dateIdx = cells.findIndex((c, i) => i > 0 && parseBoditraxDate(c) !== null)
    const date = dateIdx > 0 ? parseBoditraxDate(cells[dateIdx]!) : null
    const value = dateIdx > 1 ? parseValue(cells.slice(1, dateIdx)) : null
    if (!date || value === null) {
      skipped++
      continue
    }
    const scan = byDate.get(date) ?? emptyScan(date)
    scan[metric.field] = metric.convert ? metric.convert(value) : value
    byDate.set(date, scan)
  }
  const scans = [...byDate.values()]
    .filter((s) => s.peso !== null)
    .map((s) => ({
      ...s,
      grasa: s.grasaKg !== null && s.peso ? round1((s.grasaKg / s.peso) * 100) : null,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
  return { scans, skipped }
}
