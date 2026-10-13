import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { BrandMark } from '@/features/auth/BrandMark'
import { useSession } from '@/features/auth/SessionProvider'
import { requireSupabase } from '@/lib/supabase'
import { useAccess } from './data'

const COPY = {
  pending: {
    title: 'Solicitud enviada',
    body: (email: string) =>
      `Tu cuenta ${email} está pendiente de aprobación. Podrás entrar en cuanto la aprueben.`,
  },
  rejected: {
    title: 'Sin acceso',
    body: (email: string) => `La cuenta ${email} no tiene acceso a Forja.`,
  },
}

/**
 * What a signed-in account sees until someone approves it, or after it was turned
 * down: the same frame as the sign-in screen, a sentence and the way out.
 */
export function AccessPending({ verdict }: { verdict: 'pending' | 'rejected' }) {
  const { toast } = useToast()
  const qc = useQueryClient()
  const { user } = useSession()
  const access = useAccess(user?.id)
  const [leaving, setLeaving] = useState(false)

  const check = async () => {
    const res = await access.refetch()
    if (res.data?.status === 'approved') {
      // Everything read while pending came back empty: start the account afresh.
      await qc.resetQueries({ predicate: (q) => q.queryKey[0] !== 'access' })
    } else {
      toast('Tu solicitud sigue pendiente', 'info')
    }
  }

  const signOut = async () => {
    setLeaving(true)
    try {
      await requireSupabase().auth.signOut()
      qc.clear()
    } catch (e) {
      toast(`No se pudo cerrar sesión: ${(e as Error).message}`, 'error')
      setLeaving(false)
    }
  }

  const copy = COPY[verdict]
  return (
    <div className="safe-top mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 pb-10">
      <div className="mb-10 flex flex-col items-center text-center">
        <BrandMark className="size-16" />
        <h1 className="mt-6 font-display text-[34px] font-semibold uppercase tracking-[0.32em] text-ink">
          Forja
        </h1>
      </div>
      <div className="text-center" role="status">
        <h2 className="font-display text-[22px] font-semibold uppercase tracking-[0.06em]">
          {copy.title}
        </h2>
        <p className="mx-auto mt-2 max-w-[32ch] text-[14px] leading-relaxed text-muted">
          {copy.body(user?.email ?? '')}
        </p>
      </div>
      <div className="mt-8 flex flex-col gap-3">
        {verdict === 'pending' && (
          <Button size="lg" block variant="secondary" loading={access.isFetching} onClick={check}>
            Comprobar de nuevo
          </Button>
        )}
        <Button size="lg" block variant="ghost" loading={leaving} onClick={signOut}>
          Cerrar sesión
        </Button>
      </div>
    </div>
  )
}
