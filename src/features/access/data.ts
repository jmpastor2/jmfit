import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { requireSupabase } from '@/lib/supabase'

/**
 * Access by approval. Every sign-up starts pending and the database lets a pending
 * account read and write nothing; these hooks are only what the screens show of it.
 */
export type AccessStatus = 'pending' | 'approved' | 'rejected'

export interface MyAccess {
  status: AccessStatus
  is_admin: boolean
}

/** One person as the admin's list shows them (`access_requests()`). */
export interface AccessRequest extends MyAccess {
  user_id: string
  email: string
  display_name: string
  requested_at: string
  decided_at: string | null
}

export const accessKeys = {
  mine: (uid: string) => ['access', uid] as const,
  requests: ['access', 'requests'] as const,
}

/** My own row: whether I may use the app, and whether I approve the others. */
export function useAccess(userId: string | undefined) {
  return useQuery({
    queryKey: accessKeys.mine(userId ?? ''),
    enabled: Boolean(userId),
    queryFn: async (): Promise<MyAccess | null> => {
      const { data, error } = await requireSupabase()
        .from('access')
        .select('status, is_admin')
        .eq('user_id', userId!)
        .maybeSingle()
      if (error) throw error
      return (data as MyAccess | null) ?? null
    },
  })
}

export type AccessVerdict = 'loading' | 'open' | 'pending' | 'rejected'

/**
 * What the shell does with my row. A failed read lets me through: the database still
 * guards every row, and a first start offline must not lock out an approved person.
 * No row at all is treated as pending.
 */
export function accessVerdict(data: MyAccess | null | undefined, failed: boolean): AccessVerdict {
  if (data === undefined) return failed ? 'open' : 'loading'
  if (data === null) return 'pending'
  return data.status === 'approved' ? 'open' : data.status
}

/** Everyone who has an account, pending first. Admins only. */
export function useAccessRequests(enabled: boolean) {
  return useQuery({
    queryKey: accessKeys.requests,
    enabled,
    queryFn: async (): Promise<AccessRequest[]> => {
      const { data, error } = await requireSupabase().rpc('access_requests')
      if (error) throw error
      return (data as AccessRequest[] | null) ?? []
    },
  })
}

export function useDecideAccess() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, status }: { userId: string; status: AccessStatus }) => {
      const { error } = await requireSupabase().rpc('decide_access', {
        p_user: userId,
        p_status: status,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: accessKeys.requests }),
  })
}
