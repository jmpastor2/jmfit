/**
 * Development lab only (lab.html, never part of the published app): an in-memory stand-in for
 * the Supabase client with the subset of the query builder the app uses. It runs on a local copy
 * of the real account (see snapshot.ts); everything the app writes stays in memory.
 */
import type { TypedSupabase } from '@/lib/supabase'

export type Row = Record<string, unknown>
export type Store = Record<string, Row[]>

interface Result {
  data: unknown
  error: { message: string; code?: string } | null
  count?: number | null
}

/** PostgREST's default `max-rows`: a request that matches more gets the first thousand. */
export const MAX_ROWS = 1000

const nowIso = () => new Date().toISOString()
const uuid = () => crypto.randomUUID()

/** Columns the database fills in when a row is inserted without them. */
const DEFAULTS: Record<string, () => Row> = {
  workouts: () => ({
    ended_at: null,
    notes: null,
    session_rpe: null,
    bodyweight: null,
    deload: false,
    plan: [],
  }),
  workout_sets: () => ({ kind: 'work', rir: null, note: null }),
  goals: () => ({ archived: false, achieved_at: null, deadline: null }),
  programs: () => ({ archived: false, template_id: null }),
}

class Query implements PromiseLike<Result> {
  private op: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select'
  private filters: ((r: Row) => boolean)[] = []
  private payload: Row | Row[] | undefined
  private orderBy: { col: string; asc: boolean }[] = []
  private limitTo: number | undefined
  private rangeTo: [number, number] | undefined
  private wantSingle: 'single' | 'maybe' | null = null
  private returning = false
  private head = false
  private wantCount = false
  private onConflict: string[] = []
  private ignoreDuplicates = false

  private readonly db: Store
  private readonly table: string

  constructor(db: Store, table: string) {
    this.db = db
    this.table = table
  }

  select(_cols?: string, opts?: { count?: string; head?: boolean }) {
    if (this.op !== 'select') this.returning = true
    if (opts?.count) this.wantCount = true
    if (opts?.head) this.head = true
    return this
  }
  insert(p: Row | Row[]) {
    this.op = 'insert'
    this.payload = p
    return this
  }
  update(p: Row) {
    this.op = 'update'
    this.payload = p
    return this
  }
  upsert(p: Row | Row[], opts?: { onConflict?: string; ignoreDuplicates?: boolean }) {
    this.op = 'upsert'
    this.payload = p
    this.onConflict = (opts?.onConflict ?? 'id').split(',').map((s) => s.trim())
    this.ignoreDuplicates = Boolean(opts?.ignoreDuplicates)
    return this
  }
  delete() {
    this.op = 'delete'
    return this
  }
  eq(col: string, v: unknown) {
    this.filters.push((r) => r[col] === v)
    return this
  }
  neq(col: string, v: unknown) {
    this.filters.push((r) => r[col] !== v)
    return this
  }
  in(col: string, vs: unknown[]) {
    this.filters.push((r) => vs.includes(r[col]))
    return this
  }
  is(col: string, v: unknown) {
    this.filters.push((r) => (v === null ? r[col] == null : r[col] === v))
    return this
  }
  gte(col: string, v: unknown) {
    this.filters.push((r) => String(r[col] ?? '') >= String(v))
    return this
  }
  lte(col: string, v: unknown) {
    this.filters.push((r) => String(r[col] ?? '') <= String(v))
    return this
  }
  gt(col: string, v: unknown) {
    this.filters.push((r) => String(r[col] ?? '') > String(v))
    return this
  }
  lt(col: string, v: unknown) {
    this.filters.push((r) => String(r[col] ?? '') < String(v))
    return this
  }
  /** `not('kind', 'in', '(a,b)')`, `not('kind', 'eq', 'a')` and `not('col', 'is', null)`. */
  not(col: string, op: string, v: unknown) {
    const listed = () =>
      String(v)
        .replace(/^\(|\)$/g, '')
        .split(',')
        .map((x) => x.trim())
    this.filters.push((r) =>
      op === 'in'
        ? !listed().includes(String(r[col]))
        : op === 'is'
          ? !(v === null ? r[col] == null : r[col] === v)
          : r[col] !== v,
    )
    return this
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.orderBy.push({ col, asc: opts?.ascending !== false })
    return this
  }
  limit(n: number) {
    this.limitTo = n
    return this
  }
  range(from: number, to: number) {
    this.rangeTo = [from, to]
    return this
  }
  single() {
    this.wantSingle = 'single'
    return this
  }
  maybeSingle() {
    this.wantSingle = 'maybe'
    return this
  }

  private rows(): Row[] {
    return (this.db[this.table] ??= []).filter((r) => this.filters.every((f) => f(r)))
  }

  private run(): Result {
    const table = (this.db[this.table] ??= [])
    let out: Row[] = []

    if (this.op === 'insert' || this.op === 'upsert') {
      const list = Array.isArray(this.payload) ? this.payload : [this.payload ?? {}]
      for (const raw of list) {
        const key = this.onConflict
        const existing =
          this.op === 'upsert' ? table.find((r) => key.every((k) => r[k] === raw[k])) : undefined
        if (existing) {
          if (!this.ignoreDuplicates) Object.assign(existing, raw, { updated_at: nowIso() })
          out.push(existing)
          continue
        }
        const row: Row = {
          id: uuid(),
          created_at: nowIso(),
          ...DEFAULTS[this.table]?.(),
          ...raw,
        }
        table.push(row)
        out.push(row)
      }
    } else if (this.op === 'update') {
      for (const r of this.rows()) {
        Object.assign(r, this.payload, { updated_at: nowIso() })
        out.push(r)
      }
    } else if (this.op === 'delete') {
      const hit = this.rows()
      for (const r of hit) table.splice(table.indexOf(r), 1)
      if (this.table === 'workouts') {
        const gone = new Set(hit.map((r) => r.id))
        this.db.workout_sets = (this.db.workout_sets ?? []).filter((s) => !gone.has(s.workout_id))
      }
      out = hit
    } else {
      out = this.rows()
      for (const { col, asc } of this.orderBy.toReversed()) {
        out = out.toSorted((a, b) => {
          const x = String(a[col] ?? '')
          const y = String(b[col] ?? '')
          return (x < y ? -1 : x > y ? 1 : 0) * (asc ? 1 : -1)
        })
      }
      if (this.rangeTo) out = out.slice(this.rangeTo[0], this.rangeTo[1] + 1)
      if (this.limitTo !== undefined) out = out.slice(0, this.limitTo)
      // The API never answers with more than this many rows, however many match.
      out = out.slice(0, MAX_ROWS)
    }

    const count = this.wantCount ? out.length : null
    const mutation = this.op !== 'select'
    if (this.head) return { data: null, error: null, count }
    const data = mutation && !this.returning ? null : out.map((r) => ({ ...r }))
    if (this.wantSingle) {
      if (data && data.length === 1) return { data: data[0], error: null, count }
      if (this.wantSingle === 'maybe' && data && data.length === 0)
        return { data: null, error: null, count }
      return {
        data: null,
        error: {
          message: 'JSON object requested, multiple (or no) rows returned',
          code: 'PGRST116',
        },
        count,
      }
    }
    return { data, error: null, count }
  }

  // The real query builder is awaitable the same way.
  // oxlint-disable-next-line unicorn/no-thenable
  then<A = Result, B = never>(
    ok?: ((v: Result) => A | PromiseLike<A>) | null,
    fail?: ((e: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return Promise.resolve()
      .then(() => this.run())
      .then(ok, fail)
  }
}

/** `access_requests()`: every access row with a name and an email, pending first. */
function accessRequests(db: Store, user: { id: string; email: string }): Row[] {
  return (db.access ?? [])
    .map((a): Row => {
      const profile = db.profiles?.find((p) => p.id === a.user_id)
      const email = String(a.email ?? (a.user_id === user.id ? user.email : ''))
      return {
        ...a,
        email,
        display_name: String(a.display_name ?? profile?.display_name ?? email.split('@')[0]),
      }
    })
    .toSorted((x, y) => Number(y.status === 'pending') - Number(x.status === 'pending'))
}

function decideAccess(db: Store, args: Record<string, unknown>): Result {
  const row = (db.access ?? []).find((a) => a.user_id === args.p_user)
  if (!row) return { data: null, error: { message: 'not_found' } }
  row.status = args.p_status
  row.decided_at = args.p_status === 'pending' ? null : nowIso()
  return { data: null, error: null }
}

export function createFakeSupabase(db: Store, user: { id: string; email: string }): TypedSupabase {
  const session = { user, access_token: 'lab' }
  const client = {
    from: (table: string) => new Query(db, table),
    rpc: async (name: string, args: Record<string, unknown> = {}): Promise<Result> =>
      name === 'access_requests'
        ? { data: accessRequests(db, user), error: null }
        : name === 'decide_access'
          ? decideAccess(db, args)
          : { data: null, error: { message: `rpc ${name} not faked` } },
    functions: {
      invoke: async () => ({ data: null, error: { message: 'not_configured' } }),
    },
    auth: {
      getSession: async () => ({ data: { session }, error: null }),
      getUser: async () => ({ data: { user }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signOut: async () => ({ error: null }),
    },
  }
  return client as unknown as TypedSupabase
}
