/* oxlint-disable no-console -- a command line step */
/**
 * Export the owner's rows into src/dev/real-snapshot.json (git-ignored) for the development lab.
 * Usage: node scripts/snapshot.mjs <owner-uuid>
 */
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const REF = 'jzhltzafdqipeortwdra'
const owner = process.argv[2]
if (!/^[0-9a-f-]{36}$/.test(owner ?? '')) throw new Error('usage: node scripts/snapshot.mjs <owner-uuid>')

const TABLES = {
  profiles: `id = '${owner}'`,
  scans: `user_id = '${owner}'`,
  programs: `user_id = '${owner}'`,
  workouts: `user_id = '${owner}'`,
  workout_sets: `user_id = '${owner}'`,
  goals: `user_id = '${owner}'`,
  checkins: `user_id = '${owner}'`,
  gym_machines: `user_id = '${owner}'`,
  custom_exercises: `user_id = '${owner}'`,
  health_daily: `user_id = '${owner}'`,
  health_connections: `user_id = '${owner}'`,
}

const out = { owner }
for (const [table, where] of Object.entries(TABLES)) {
  const sql = `select coalesce(json_agg(t), '[]') as rows from (select * from ${table} where ${where}) t`
  // The SQL goes in a file: quoting it through the Windows shell is not reliable.
  const file = join(tmpdir(), `forja-snapshot-${table}.sql`)
  writeFileSync(file, sql)
  const raw = execFileSync(
    'npx',
    ['supabase', 'db', 'query', '--linked=false', '--project-ref', REF, '-f', file],
    { encoding: 'utf8', shell: true, maxBuffer: 64 * 1024 * 1024 },
  )
  const json = JSON.parse(raw.slice(raw.indexOf('{')))
  out[table] = json.rows[0]?.rows ?? []
  console.log(`${table}: ${out[table].length}`)
}
writeFileSync(new URL('../src/dev/real-snapshot.json', import.meta.url), JSON.stringify(out))
