import { describe, expect, it } from 'vitest'
import { buildExport, exportFileName, type PageReader } from './exportData'

describe('buildExport', () => {
  it('pages through tables and skips missing or failing ones', async () => {
    const sets = Array.from({ length: 1500 }, (_, i) => ({ id: i }))
    const read: PageReader = async (table, from, to) => {
      if (table === 'health_daily') return { data: null, error: { code: '42P01' } }
      if (table === 'health_workouts') return { data: null, error: { code: 'X', message: 'boom' } }
      if (table === 'workout_sets') return { data: sets.slice(from, to + 1), error: null }
      if (table === 'scans') return { data: [{ date: '2026-09-10' }], error: null }
      return { data: [], error: null }
    }
    const out = await buildExport(read, '1.0.0', new Date('2026-10-07T10:00:00Z'))
    expect(out.tables.workout_sets).toHaveLength(1500)
    expect(out.tables.scans).toEqual([{ date: '2026-09-10' }])
    expect(out.tables.health_daily).toBeUndefined()
    expect(out.skipped).toEqual({ health_daily: 'no existe', health_workouts: 'boom' })
    expect(out.exportedAt).toBe('2026-10-07T10:00:00.000Z')
  })

  it('names the file with the local date', () => {
    expect(exportFileName(new Date(2026, 9, 7, 23, 30))).toBe('forja-datos-2026-10-07.json')
  })
})
