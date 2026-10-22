/**
 * Data hooks. Every table is read whole for the signed-in person and kept in the persisted
 * query cache, so the app opens instantly and works without signal in the gym. Writes are
 * optimistic upserts keyed by client-generated ids: a set logged offline shows at once and is
 * sent when the connection comes back (also after the app is closed and reopened, see
 * `registerMutationDefaults`).
 */
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import type { Checkin, LoggedSet, Scan, UserGoal } from '@/domain/types'
import { useSession } from '@/features/auth/SessionProvider'
import { WRITE_SCOPE } from '@/lib/queryClient'
import { requireSupabase } from '@/lib/supabase'
import {
  fromCheckin,
  fromGoal,
  fromMachine,
  fromProgram,
  fromScan,
  fromSet,
  fromWorkout,
  profilePatch,
  toCheckin,
  toGoal,
  toHealthDay,
  toMachine,
  toProfile,
  toProgram,
  toScan,
  toSet,
  toWorkout,
  type CheckinRow,
  type GoalRow,
  type GymMachine,
  type GymMachineRow,
  type Profile,
  type ProfileRow,
  type Program,
  type ProgramRow,
  type ScanRow,
  type SetRow,
  type WorkoutFull,
  type WorkoutRow,
} from './rows'
import { reportWriteError } from './writeErrors'

export function useUid(): string {
  const { user } = useSession()
  if (!user) throw new Error('useUid requires a signed-in session')
  return user.id
}

/** PostgREST returns at most 1000 rows per request: page until the table is exhausted. */
async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const out: T[] = []
  const page = 1000
  for (let from = 0; ; from += page) {
    const { data, error } = await build(from, from + page - 1)
    if (error) throw error
    out.push(...(data ?? []))
    if (!data || data.length < page) return out
  }
}

/* ───────────── Generic writes (one queue, resumable after a reload) ───────────── */

/** Options a screen can pass to a write. */
export interface WriteOptions {
  /** The screen reports a failure itself: skip the generic toast. */
  quiet?: boolean
}

interface UpsertVars extends WriteOptions {
  table: string
  rows: object[]
  onConflict?: string
}
interface DeleteVars extends WriteOptions {
  table: string
  column: string
  values: string[]
  /** Extra equality filters (e.g. the owner). */
  match?: Record<string, string>
}
interface UpdateVars extends WriteOptions {
  table: string
  patch: object
  match: Record<string, string>
}
type WriteVars = UpsertVars | DeleteVars | UpdateVars

async function runUpsert({ table, rows, onConflict }: UpsertVars) {
  const sb = requireSupabase()
  const { error } = await sb.from(table).upsert(rows, onConflict ? { onConflict } : undefined)
  if (error) throw error
}

async function runDelete({ table, column, values, match = {} }: DeleteVars) {
  let q = requireSupabase().from(table).delete().in(column, values)
  for (const [k, v] of Object.entries(match)) q = q.eq(k, v)
  const { error } = await q
  if (error) throw error
}

async function runUpdate({ table, patch, match }: UpdateVars) {
  let q = requireSupabase().from(table).update(patch)
  for (const [k, v] of Object.entries(match)) q = q.eq(k, v)
  const { error } = await q
  if (error) throw error
}

/** The cached lists a write to each table touches (a workout takes its sets with it). */
const QUERIES_OF_TABLE: Record<string, string[]> = {
  profiles: ['profile'],
  programs: ['programs'],
  workouts: ['workouts', 'sets'],
  workout_sets: ['sets'],
  scans: ['scans'],
  goals: ['goals'],
  checkins: ['checkins'],
  gym_machines: ['machines'],
}

/**
 * Every write goes through one of these defaults (matched by mutation key), which:
 * - share one scope, so they reach the server one at a time in the order they were made
 *   (a set never arrives before its workout, a delete never overtakes the insert before it);
 * - keep their functions, so writes persisted while paused are sent after a reload;
 * - on a definite failure, tell the person and refetch what was touched, so the screen never
 *   shows as saved something the server does not have. The refetch waits until the queue is
 *   empty, so the writes still on their way keep showing.
 */
export function registerMutationDefaults(qc: QueryClient) {
  const stale = new Set<string>()
  const settle = (error: unknown, vars: WriteVars | undefined) => {
    if (error) {
      for (const k of QUERIES_OF_TABLE[vars?.table ?? ''] ?? []) stale.add(k)
      if (!vars?.quiet) reportWriteError(error)
    }
    // This write still counts as pending while it settles.
    const pending = qc.isMutating({ predicate: (m) => m.options.scope?.id === WRITE_SCOPE })
    if (stale.size && pending <= 1) {
      for (const k of stale) void qc.invalidateQueries({ queryKey: [k] })
      stale.clear()
    }
  }
  const common = {
    scope: { id: WRITE_SCOPE },
    onSettled: (_data: unknown, error: unknown, vars: WriteVars | undefined) => settle(error, vars),
  }
  qc.setMutationDefaults(['upsert'], { ...common, mutationFn: (v: UpsertVars) => runUpsert(v) })
  qc.setMutationDefaults(['delete'], { ...common, mutationFn: (v: DeleteVars) => runDelete(v) })
  qc.setMutationDefaults(['update'], { ...common, mutationFn: (v: UpdateVars) => runUpdate(v) })
}

/**
 * The write functions. Each call is queued at once (callers update the cache first and need
 * not wait for one write before making the next); the promise settles when the server has it,
 * or rejects on a definite failure.
 */
function useWrites() {
  const qc = useQueryClient()
  const upsert = useMutation<void, Error, UpsertVars>({ mutationKey: ['upsert'] })
  const del = useMutation<void, Error, DeleteVars>({ mutationKey: ['delete'] })
  const update = useMutation<void, Error, UpdateVars>({ mutationKey: ['update'] })
  return { qc, upsert: upsert.mutateAsync, del: del.mutateAsync, update: update.mutateAsync }
}

/**
 * Hand a write to the queue without waiting for the server: the cache already shows it, the
 * queue sends it when it can, and a failure is reported (toast and refetch) by the queue.
 */
export function queued(write: Promise<unknown>): void {
  write.catch(() => {})
}

/** Replace or insert items by id in a cached list. */
function patchList<T extends { id: string }>(
  qc: QueryClient,
  key: readonly unknown[],
  items: T[],
  sort?: (a: T, b: T) => number,
) {
  qc.setQueryData<T[]>(key, (prev = []) => {
    const map = new Map(prev.map((x) => [x.id, x]))
    for (const it of items) map.set(it.id, it)
    const out = [...map.values()]
    return sort ? out.sort(sort) : out
  })
}

function dropFromList<T extends { id: string }>(
  qc: QueryClient,
  key: readonly unknown[],
  ids: string[],
) {
  const gone = new Set(ids)
  qc.setQueryData<T[]>(key, (prev = []) => prev.filter((x) => !gone.has(x.id)))
}

/* ───────────── Profile ───────────── */

export const profileKey = (uid: string) => ['profile', uid] as const

export function useProfile(uid: string | undefined) {
  return useQuery({
    queryKey: ['profile', uid],
    enabled: Boolean(uid),
    queryFn: async () => {
      const { data, error } = await requireSupabase()
        .from('profiles')
        .select('*')
        .eq('id', uid!)
        .single()
      if (error) throw error
      return toProfile(data as ProfileRow)
    },
  })
}

export function useMe(): Profile {
  const uid = useUid()
  const q = useProfile(uid)
  if (!q.data) throw new Error('profile not loaded (AppShell gates on it)')
  return q.data
}

export function useUpdateProfile() {
  const uid = useUid()
  const qc = useQueryClient()
  const { mutateAsync: send, isPending } = useMutation<void, Error, UpdateVars>({
    mutationKey: ['update'],
  })
  const mutateAsync = useCallback(
    async (patch: Partial<Profile>, opts: WriteOptions = {}) => {
      qc.setQueryData<Profile>(profileKey(uid), (p) => (p ? { ...p, ...patch } : p))
      await send({
        ...opts,
        table: 'profiles',
        patch: { ...profilePatch(patch), updated_at: new Date().toISOString() },
        match: { id: uid },
      }).finally(() => void qc.invalidateQueries({ queryKey: profileKey(uid) }))
    },
    [qc, uid, send],
  )
  return { mutateAsync, isPending }
}

/* ───────────── Programs ───────────── */

export function usePrograms() {
  const uid = useUid()
  return useQuery({
    queryKey: ['programs', uid],
    queryFn: async () => {
      const { data, error } = await requireSupabase()
        .from('programs')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data as ProgramRow[]).map(toProgram)
    },
  })
}

export function useActiveProgram(): { program: Program | null; isPending: boolean } {
  const me = useMe()
  const q = usePrograms()
  const program = q.data?.find((p) => p.id === me.activeProgramId) ?? null
  return { program, isPending: q.isPending }
}

export function useProgramActions() {
  const uid = useUid()
  const { qc, upsert } = useWrites()
  const updateProfile = useUpdateProfile()
  const save = useCallback(
    async (p: Program, opts: WriteOptions = {}) => {
      patchList(qc, ['programs', uid], [p])
      await upsert({
        ...opts,
        table: 'programs',
        rows: [{ ...fromProgram(p), updated_at: new Date().toISOString() }],
      })
    },
    [qc, uid, upsert],
  )
  const setActive = updateProfile.mutateAsync
  const activate = useCallback(
    async (p: Program, opts: WriteOptions = {}) => {
      // Both queued now; the queue sends the program before the profile that points at it.
      await Promise.all([save(p, opts), setActive({ activeProgramId: p.id }, opts)])
    },
    [save, setActive],
  )
  return { save, activate }
}

/* ───────────── Workouts & sets ───────────── */

const byStartDesc = (a: WorkoutFull, b: WorkoutFull) => b.startedAt.localeCompare(a.startedAt)
const bySetOrder = (a: LoggedSet, b: LoggedSet) =>
  a.doneAt.localeCompare(b.doneAt) || a.exerciseIndex - b.exerciseIndex || a.setIndex - b.setIndex

export function useWorkouts() {
  const uid = useUid()
  return useQuery({
    queryKey: ['workouts', uid],
    queryFn: async () => {
      const rows = await fetchAll<WorkoutRow>((from, to) =>
        requireSupabase()
          .from('workouts')
          .select(
            'id,name,program_id,day_id,started_at,ended_at,notes,session_rpe,bodyweight,deload,plan',
          )
          .order('started_at', { ascending: false })
          .range(from, to),
      )
      return rows.map(toWorkout)
    },
  })
}

/** Every logged set, oldest first. The engine derives records, progressions and volume from it. */
export function useSets() {
  const uid = useUid()
  return useQuery({
    queryKey: ['sets', uid],
    queryFn: async () => {
      const rows = await fetchAll<SetRow>((from, to) =>
        requireSupabase()
          .from('workout_sets')
          .select('id,workout_id,exercise_id,exercise_index,set_index,kind,weight,reps,rir,done_at')
          .order('done_at', { ascending: true })
          .order('id', { ascending: true })
          .range(from, to),
      )
      return rows.map(toSet)
    },
  })
}

export function useActiveWorkout(): WorkoutFull | null {
  const q = useWorkouts()
  return q.data?.find((w) => !w.endedAt) ?? null
}

export function useTrainingActions() {
  const uid = useUid()
  const { qc, upsert, del } = useWrites()

  const saveWorkout = useCallback(
    async (w: WorkoutFull, opts: WriteOptions = {}) => {
      patchList(qc, ['workouts', uid], [w], byStartDesc)
      await upsert({ ...opts, table: 'workouts', rows: [fromWorkout(w)] })
    },
    [qc, uid, upsert],
  )

  const saveSets = useCallback(
    async (sets: LoggedSet[], opts: WriteOptions = {}) => {
      if (!sets.length) return
      patchList(qc, ['sets', uid], sets, bySetOrder)
      await upsert({ ...opts, table: 'workout_sets', rows: sets.map(fromSet) })
    },
    [qc, uid, upsert],
  )

  const deleteSets = useCallback(
    async (ids: string[], opts: WriteOptions = {}) => {
      if (!ids.length) return
      dropFromList<LoggedSet>(qc, ['sets', uid], ids)
      await del({ ...opts, table: 'workout_sets', column: 'id', values: ids })
    },
    [qc, uid, del],
  )

  const deleteWorkout = useCallback(
    async (id: string, opts: WriteOptions = {}) => {
      dropFromList<WorkoutFull>(qc, ['workouts', uid], [id])
      qc.setQueryData<LoggedSet[]>(['sets', uid], (prev = []) =>
        prev.filter((s) => s.workoutId !== id),
      )
      await del({ ...opts, table: 'workouts', column: 'id', values: [id] })
    },
    [qc, uid, del],
  )

  return { saveWorkout, saveSets, deleteSets, deleteWorkout }
}

/* ───────────── Body scans ───────────── */

export function useScans() {
  const uid = useUid()
  return useQuery({
    queryKey: ['scans', uid],
    queryFn: async () => {
      const { data, error } = await requireSupabase()
        .from('scans')
        .select('*')
        .order('date', { ascending: true })
      if (error) throw error
      return (data as ScanRow[]).map(toScan).filter((s) => s.peso !== null)
    },
  })
}

export function useScanActions() {
  const uid = useUid()
  const { qc, upsert, del } = useWrites()
  const save = useCallback(
    async (scans: Scan[], opts: WriteOptions = {}) => {
      if (!scans.length) return
      qc.setQueryData<Scan[]>(['scans', uid], (prev = []) => {
        const map = new Map(prev.map((s) => [s.date, s]))
        for (const s of scans) map.set(s.date, s)
        return [...map.values()].sort((a, b) => a.date.localeCompare(b.date))
      })
      await upsert({
        ...opts,
        table: 'scans',
        rows: scans.map((s) => ({ ...fromScan(s), user_id: uid })),
        onConflict: 'user_id,date',
      })
    },
    [qc, uid, upsert],
  )
  const remove = useCallback(
    async (date: string, opts: WriteOptions = {}) => {
      qc.setQueryData<Scan[]>(['scans', uid], (prev = []) => prev.filter((s) => s.date !== date))
      await del({
        ...opts,
        table: 'scans',
        column: 'date',
        values: [date],
        match: { user_id: uid },
      })
    },
    [qc, uid, del],
  )
  return { save, remove }
}

/* ───────────── Goals ───────────── */

export function useGoals() {
  const uid = useUid()
  return useQuery({
    queryKey: ['goals', uid],
    queryFn: async () => {
      const { data, error } = await requireSupabase()
        .from('goals')
        .select('*')
        .eq('archived', false)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data as GoalRow[]).map(toGoal)
    },
  })
}

export function useGoalActions() {
  const uid = useUid()
  const { qc, upsert, update } = useWrites()
  const save = useCallback(
    async (g: UserGoal, opts: WriteOptions = {}) => {
      patchList(qc, ['goals', uid], [g])
      await upsert({ ...opts, table: 'goals', rows: [fromGoal(g)] })
    },
    [qc, uid, upsert],
  )
  const archive = useCallback(
    async (id: string, opts: WriteOptions = {}) => {
      dropFromList<UserGoal>(qc, ['goals', uid], [id])
      await update({ ...opts, table: 'goals', patch: { archived: true }, match: { id } })
    },
    [qc, uid, update],
  )
  return { save, archive }
}

/* ───────────── Check-ins & wearable ───────────── */

export function useCheckins() {
  const uid = useUid()
  return useQuery({
    queryKey: ['checkins', uid],
    queryFn: async () => {
      const { data, error } = await requireSupabase()
        .from('checkins')
        .select('date,sleep_h,sleep_quality,energy,soreness,stress,resting_hr,hrv_ms,steps')
        .order('date', { ascending: false })
        .limit(60)
      if (error) throw error
      return (data as CheckinRow[]).map(toCheckin)
    },
  })
}

export function useSaveCheckin() {
  const uid = useUid()
  const { qc, upsert } = useWrites()
  return useCallback(
    async (c: Checkin, opts: WriteOptions = {}) => {
      qc.setQueryData<Checkin[]>(['checkins', uid], (prev = []) =>
        [c, ...prev.filter((x) => x.date !== c.date)].sort((a, b) => b.date.localeCompare(a.date)),
      )
      await upsert({
        ...opts,
        table: 'checkins',
        rows: [fromCheckin(c)],
        onConflict: 'user_id,date',
      })
    },
    [qc, uid, upsert],
  )
}

/**
 * Wearable days (Google Health). The tables arrive with the integration; until they exist
 * the query answers an empty list instead of an error.
 */
export function useHealthDays() {
  const uid = useUid()
  return useQuery({
    queryKey: ['health', uid],
    queryFn: async () => {
      const since = new Date(Date.now() - 60 * 86_400_000).toISOString().slice(0, 10)
      const { data, error } = await requireSupabase()
        .from('health_daily')
        .select('*')
        .gte('date', since)
        .order('date', { ascending: true })
      if (error) {
        if (isMissingTable(error)) return []
        throw error
      }
      return (data as Record<string, unknown>[]).map(toHealthDay)
    },
  })
}

export interface HealthConnection {
  status: string
  connectedAt: string | null
  lastSyncAt: string | null
  lastError: string | null
}

export function useHealthConnection() {
  const uid = useUid()
  return useQuery({
    queryKey: ['healthConn', uid],
    queryFn: async (): Promise<HealthConnection | null> => {
      const { data, error } = await requireSupabase()
        .from('health_connections')
        .select('status,connected_at,last_sync_at,last_error')
        .maybeSingle()
      if (error) {
        if (isMissingTable(error)) return null
        throw error
      }
      if (!data) return null
      const r = data as Record<string, string | null>
      return {
        status: r.status ?? 'unknown',
        connectedAt: r.connected_at ?? null,
        lastSyncAt: r.last_sync_at ?? null,
        lastError: r.last_error ?? null,
      }
    },
  })
}

function isMissingTable(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code
  return code === '42P01' || code === 'PGRST205'
}

/* ───────────── Gym machines ───────────── */

export function useMachines() {
  const uid = useUid()
  return useQuery({
    queryKey: ['machines', uid],
    queryFn: async () => {
      const { data, error } = await requireSupabase()
        .from('gym_machines')
        .select('id,label,brand,exercise_id,seat_setting,notes')
        .order('label')
      if (error) throw error
      return (data as GymMachineRow[]).map(toMachine)
    },
  })
}

export function useMachineActions() {
  const uid = useUid()
  const { qc, upsert, del } = useWrites()
  const save = useCallback(
    async (m: GymMachine, opts: WriteOptions = {}) => {
      patchList(qc, ['machines', uid], [m], (a, b) => a.label.localeCompare(b.label, 'es'))
      await upsert({ ...opts, table: 'gym_machines', rows: [fromMachine(m)] })
    },
    [qc, uid, upsert],
  )
  const remove = useCallback(
    async (id: string, opts: WriteOptions = {}) => {
      dropFromList<GymMachine>(qc, ['machines', uid], [id])
      await del({ ...opts, table: 'gym_machines', column: 'id', values: [id] })
    },
    [qc, uid, del],
  )
  return { save, remove }
}

/** Load everything the home screen needs while the profile is still on its way. */
export async function prefetchCore(qc: QueryClient, uid: string) {
  // Hooks own the query functions; warming the cache is enough to start the requests early.
  void qc.prefetchQuery({
    queryKey: ['profile', uid],
    queryFn: async () => {
      const { data, error } = await requireSupabase()
        .from('profiles')
        .select('*')
        .eq('id', uid)
        .single()
      if (error) throw error
      return toProfile(data as ProfileRow)
    },
  })
}
