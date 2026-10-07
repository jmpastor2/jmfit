/**
 * Development lab only: the app runs on a copy of the real account. The copy lives in
 * `real-snapshot.json` next to this file (ignored by git; `node scripts/snapshot.mjs` exports
 * it with the Supabase CLI) and everything the app writes stays in memory.
 */
import type { Row, Store } from './fakeSupabase'

type Snapshot = Partial<Record<string, Row[]>> & { owner?: string }

export interface RealAccount {
  store: Store
  user: { id: string; email: string }
}

export function loadRealAccount(): RealAccount | null {
  const files = import.meta.glob<Snapshot>('./real-snapshot.json', {
    eager: true,
    import: 'default',
  })
  const snapshot = Object.values(files)[0]
  const owner = snapshot?.owner
  if (!snapshot || !owner) return null
  const store: Store = {}
  for (const [table, rows] of Object.entries(snapshot)) {
    if (Array.isArray(rows)) store[table] = rows.map((r) => ({ ...r }))
  }
  return { store, user: { id: owner, email: 'lab@forja.test' } }
}
