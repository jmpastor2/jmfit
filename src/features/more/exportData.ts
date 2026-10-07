/**
 * "Exportar mis datos": every table the person owns, as one JSON file. Row-level security
 * already limits each read to their own rows. Tables that do not exist yet are skipped.
 */

export const EXPORT_TABLES = [
  'profiles',
  'programs',
  'workouts',
  'workout_sets',
  'scans',
  'goals',
  'checkins',
  'gym_machines',
  'custom_exercises',
  'health_daily',
  'health_workouts',
] as const

export type ExportTable = (typeof EXPORT_TABLES)[number]

/** Reads one page of a table: rows `from`..`to` inclusive. */
export type PageReader = (
  table: string,
  from: number,
  to: number,
) => PromiseLike<{ data: unknown[] | null; error: { code?: string; message?: string } | null }>

export interface ExportFile {
  app: 'Forja'
  version: string
  exportedAt: string
  tables: Partial<Record<ExportTable, unknown[]>>
  /** Tables that could not be read and why ("no existe" for missing ones). */
  skipped: Partial<Record<ExportTable, string>>
}

const PAGE = 1000
const MISSING = new Set(['42P01', 'PGRST205'])

export async function buildExport(
  read: PageReader,
  version: string,
  now: Date,
): Promise<ExportFile> {
  const out: ExportFile = {
    app: 'Forja',
    version,
    exportedAt: now.toISOString(),
    tables: {},
    skipped: {},
  }
  for (const table of EXPORT_TABLES) {
    const rows: unknown[] = []
    let failed: string | null = null
    for (let from = 0; ; from += PAGE) {
      // Pages depend on each other (stop at a short page): sequential on purpose.
      // oxlint-disable-next-line no-await-in-loop
      const { data, error } = await read(table, from, from + PAGE - 1)
      if (error) {
        failed = MISSING.has(error.code ?? '') ? 'no existe' : (error.message ?? 'error')
        break
      }
      rows.push(...(data ?? []))
      if (!data || data.length < PAGE) break
    }
    if (failed) out.skipped[table] = failed
    else out.tables[table] = rows
  }
  return out
}

const p = (n: number) => String(n).padStart(2, '0')

export function exportFileName(now: Date): string {
  return `forja-datos-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}.json`
}
