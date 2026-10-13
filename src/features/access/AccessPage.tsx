import { Check, UserMinus, X } from 'lucide-react'
import { Navigate } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { Badge, SectionTitle, Skeleton } from '@/components/ui/primitives'
import { useSession } from '@/features/auth/SessionProvider'
import { formatDate } from '@/features/programs/labels'
import {
  useAccess,
  useAccessRequests,
  useDecideAccess,
  type AccessRequest,
  type AccessStatus,
} from './data'

const GROUPS: { status: AccessStatus; title: string }[] = [
  { status: 'pending', title: 'Pendientes' },
  { status: 'approved', title: 'Con acceso' },
  { status: 'rejected', title: 'Sin acceso' },
]

/** A timestamp as the day it fell on here: "13 oct 2026". */
const day = (iso: string) => {
  const d = new Date(iso)
  return formatDate(`${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`)
}

/** The admin's list: who asked to come in, who is in, who was turned down. */
export function AccessPage() {
  const { toast } = useToast()
  const { user } = useSession()
  const mine = useAccess(user?.id)
  const isAdmin = mine.data?.is_admin === true
  const list = useAccessRequests(isAdmin)
  const decide = useDecideAccess()

  if (mine.data !== undefined && !isAdmin) return <Navigate to="/more" replace />

  const rows = list.data ?? []

  const set = async (person: AccessRequest, status: AccessStatus) => {
    if (
      person.status === 'approved' &&
      status === 'rejected' &&
      !window.confirm(
        `¿Quitar el acceso a ${person.display_name}? Sus datos se conservan y puedes volver a aprobarlo cuando quieras.`,
      )
    ) {
      return
    }
    try {
      await decide.mutateAsync({ userId: person.user_id, status })
      toast(
        status === 'approved'
          ? `${person.display_name} ya tiene acceso`
          : `${person.display_name} se queda sin acceso`,
        'success',
      )
    } catch (e) {
      toast(`No se pudo guardar: ${(e as Error).message}`, 'error')
    }
  }

  return (
    <>
      <PageHeader back="/more" title="Accesos" />
      <p className="mb-5 text-[13.5px] leading-snug text-muted">
        Quien se registra queda pendiente hasta que lo apruebes. Mientras tanto no puede ver ni
        guardar nada.
      </p>

      {list.isPending ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-16 rounded-[8px]" />
          <Skeleton className="h-16 rounded-[8px]" />
        </div>
      ) : list.isError ? (
        <p className="py-8 text-center text-[14px] text-danger">No se pudo cargar la lista.</p>
      ) : (
        GROUPS.map(({ status, title }) => {
          const people = rows.filter((r) => r.status === status)
          if (status !== 'pending' && people.length === 0) return null
          return (
            <section key={status} aria-label={title} className="mb-6">
              <SectionTitle>{title}</SectionTitle>
              {people.length === 0 ? (
                <p className="border-y border-line py-4 text-[13.5px] text-muted">
                  No hay solicitudes pendientes.
                </p>
              ) : (
                <ul className="divide-y divide-line border-y border-line">
                  {people.map((p) => (
                    <Person
                      key={p.user_id}
                      person={p}
                      me={p.user_id === user?.id}
                      busy={decide.isPending && decide.variables?.userId === p.user_id}
                      onSet={(next) => set(p, next)}
                    />
                  ))}
                </ul>
              )}
            </section>
          )
        })
      )}
    </>
  )
}

function Person({
  person,
  me,
  busy,
  onSet,
}: {
  person: AccessRequest
  me: boolean
  busy: boolean
  onSet: (status: AccessStatus) => void
}) {
  const line =
    person.status === 'pending'
      ? `Pidió acceso el ${day(person.requested_at)}`
      : `${person.status === 'approved' ? 'Con acceso' : 'Sin acceso'} desde el ${day(
          person.decided_at ?? person.requested_at,
        )}`

  return (
    <li className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 py-3">
      <div className="min-w-[10rem] flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[15px] font-medium">{person.display_name}</span>
          {me ? <Badge>Tú</Badge> : person.is_admin && <Badge tone="brand">Admin</Badge>}
        </div>
        <div className="truncate text-[12.5px] text-ink-2">{person.email}</div>
        <div className="text-[12px] text-muted">{line}</div>
      </div>

      {!me && (
        <div className="ml-auto flex shrink-0 gap-1.5">
          {person.status === 'pending' && (
            <>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                leading={<X className="size-4" />}
                onClick={() => onSet('rejected')}
              >
                Rechazar
              </Button>
              <Button
                size="sm"
                loading={busy}
                leading={<Check className="size-4" />}
                onClick={() => onSet('approved')}
              >
                Aprobar
              </Button>
            </>
          )}
          {person.status === 'approved' && (
            <Button
              size="sm"
              variant="ghost"
              className="-mr-2"
              loading={busy}
              leading={<UserMinus className="size-4" />}
              onClick={() => onSet('rejected')}
            >
              Quitar acceso
            </Button>
          )}
          {person.status === 'rejected' && (
            <Button size="sm" variant="secondary" loading={busy} onClick={() => onSet('approved')}>
              Aprobar
            </Button>
          )}
        </div>
      )}
    </li>
  )
}
