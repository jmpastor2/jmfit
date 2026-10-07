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

/* ───────────── Generic writes (resumable after a reload) ───────────── */

interface UpsertVars {
  table: string
  rows: object[]
  onConflict?: string
}
interface DeleteVars {
  table: string
  column: string
  values: string[]
}

async function runUpsert({ table, rows, onConflict }: UpsertVars) {
  const sb = requireSupabase()
  const { error } = await sb.from(table).upsert(rows, onConflict ? { onConflict } : undefined)
  if (error) throw error
}

async function runDelete({ table, column, values }: DeleteVars) {
  const sb = requireSupabase()
  const { error } = await sb.from(table).delete().in(column, values)
  if (error) throw error
}

/**
 * Paused mutations are persisted without their functions; after a reload TanStack Query finds
 * them again through these defaults (matched by mutation key) and sends them.
 */
export function registerMutationDefaults(qc: QueryClient) {
  qc.setMutationDefaults(['upsert'], { mutationFn: (v: UpsertVars) => runUpsert(v) })
  qc.setMutationDefaults(['delete'], { mutationFn: (v: DeleteVars) => runDelete(v) })
}

function useWrites() {
  const qc = useQueryClient()
  const upsert = useMutation<void, Error, UpsertVars>({ mutationKey: ['upsert'] })
  const del = useMutation<void, Error, DeleteVars>({ mutationKey: ['delete'] })
  return { qc, upsert: upsert.mutateAsync, del: del.mutateAsync }
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
  return useMutation({
    mutationFn: async (patch: Partial<Profile>) => {
      const { error } = await requireSupabase()
        .from('profiles')
        .update({ ...profilePatch(patch), updated_at: new Date().toISOString() })
        .eq('id', uid)
      if (error) throw error
    },
    onMutate: (patch) => {
      qc.setQueryData<Profile>(profileKey(uid), (p) => (p ? { ...p, ...patch } : p))
    },
    onSettled: () => qc.invalidateQueries({ queryKey: profileKey(uid) }),
  })
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
    async (p: Program) => {
      patchList(qc, ['programs', uid], [p])
      await upsert({
        table: 'programs',
        rows: [{ ...fromProgram(p), updated_at: new Date().toISOString() }],
      })
    },
    [qc, uid, upsert],
  )
  const activate = useCallback(
    async (p: Program) => {
      await save(p)
      await updateProfile.mutateAsync({ activeProgramId: p.id })
    },
    [save, updateProfile],
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
    async (w: WorkoutFull) => {
      patchList(qc, ['workouts', uid], [w], byStartDesc)
      await upsert({ table: 'workouts', rows: [fromWorkout(w)] })
    },
    [qc, uid, upsert],
  )

  const saveSets = useCallback(
    async (sets: LoggedSet[]) => {
      if (!sets.length) return
      patchList(qc, ['sets', uid], sets, bySetOrder)
      await upsert({ table: 'workout_sets', rows: sets.map(fromSet) })
    },
    [qc, uid, upsert],
  )

  const deleteSets = useCallback(
    async (ids: string[]) => {
      if (!ids.length) return
      dropFromList<LoggedSet>(qc, ['sets', uid], ids)
      await del({ table: 'workout_sets', column: 'id', values: ids })
    },
    [qc, uid, del],
  )

  const deleteWorkout = useCallback(
    async (id: string) => {
      dropFromList<WorkoutFull>(qc, ['workouts', uid], [id])
      qc.setQueryData<LoggedSet[]>(['sets', uid], (prev = []) =>
        prev.filter((s) => s.workoutId !== id),
      )
      await del({ table: 'workouts', column: 'id', values: [id] })
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
  const { qc, upsert } = useWrites()
  const save = useCallback(
    async (scans: Scan[]) => {
      if (!scans.length) return
      qc.setQueryData<Scan[]>(['scans', uid], (prev = []) => {
        const map = new Map(prev.map((s) => [s.date, s]))
        for (const s of scans) map.set(s.date, s)
        return [...map.values()].sort((a, b) => a.date.localeCompare(b.date))
      })
      await upsert({
        table: 'scans',
        rows: scans.map((s) => ({ ...fromScan(s), user_id: uid })),
        onConflict: 'user_id,date',
      })
    },
    [qc, uid, upsert],
  )
  const remove = useCallback(
    async (date: string) => {
      qc.setQueryData<Scan[]>(['scans', uid], (prev = []) => prev.filter((s) => s.date !== date))
      const { error } = await requireSupabase()
        .from('scans')
        .delete()
        .eq('date', date)
        .eq('user_id', uid)
      if (error) throw error
    },
    [qc, uid],
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
  const { qc, upsert } = useWrites()
  const save = useCallback(
    async (g: UserGoal) => {
      patchList(qc, ['goals', uid], [g])
      await upsert({ table: 'goals', rows: [fromGoal(g)] })
    },
    [qc, uid, upsert],
  )
  const archive = useCallback(
    async (id: string) => {
      dropFromList<UserGoal>(qc, ['goals', uid], [id])
      const { error } = await requireSupabase()
        .from('goals')
        .update({ archived: true })
        .eq('id', id)
      if (error) throw error
    },
    [qc, uid],
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
    async (c: Checkin) => {
      qc.setQueryData<Checkin[]>(['checkins', uid], (prev = []) =>
        [c, ...prev.filter((x) => x.date !== c.date)].sort((a, b) => b.date.localeCompare(a.date)),
      )
      await upsert({ table: 'checkins', rows: [fromCheckin(c)], onConflict: 'user_id,date' })
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
    async (m: GymMachine) => {
      patchList(qc, ['machines', uid], [m], (a, b) => a.label.localeCompare(b.label, 'es'))
      await upsert({ table: 'gym_machines', rows: [fromMachine(m)] })
    },
    [qc, uid, upsert],
  )
  const remove = useCallback(
    async (id: string) => {
      dropFromList<GymMachine>(qc, ['machines', uid], [id])
      await del({ table: 'gym_machines', column: 'id', values: [id] })
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
