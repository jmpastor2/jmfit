import { useQueryClient } from '@tanstack/react-query'
import {
  BookOpen,
  ChevronRight,
  Download,
  Dumbbell,
  HeartPulse,
  KeyRound,
  LogOut,
  Settings,
  Target,
  CalendarRange,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import { useToast } from '@/components/ui/Toast'
import { useMe, useScans } from '@/data/hooks'
import { useAccess, useAccessRequests } from '@/features/access/data'
import { useSession } from '@/features/auth/SessionProvider'
import { formatNumber } from '@/domain/training'
import { EXPERIENCE_LABEL, GOAL_LABEL } from '@/features/programs/labels'
import { env } from '@/lib/env'
import { requireSupabase } from '@/lib/supabase'
import { buildExport, exportFileName, type PageReader } from './exportData'

const ORDER_BY: Record<string, string> = { scans: 'date', checkins: 'date', health_daily: 'date' }

const readPage: PageReader = (table, from, to) =>
  requireSupabase()
    .from(table)
    .select('*')
    .order(ORDER_BY[table] ?? 'id', { ascending: true })
    .range(from, to)

function ageFrom(birth: string | null, now = new Date()): number | null {
  if (!birth) return null
  const b = new Date(birth + 'T12:00:00')
  if (Number.isNaN(b.getTime())) return null
  let age = now.getFullYear() - b.getFullYear()
  if (
    now.getMonth() < b.getMonth() ||
    (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())
  )
    age--
  return age
}

export function MorePage() {
  const me = useMe()
  const lastScan = useScans().data?.at(-1) ?? null
  const isAdmin = useAccess(useSession().user?.id).data?.is_admin === true
  const waiting = (useAccessRequests(isAdmin).data ?? []).filter((r) => r.status === 'pending')
  const qc = useQueryClient()
  const { toast } = useToast()
  const [exporting, setExporting] = useState(false)
  const [leaving, setLeaving] = useState(false)

  const age = ageFrom(me.birthDate)
  const facts = [
    age !== null && `${age} años`,
    me.heightCm && `${me.heightCm} cm`,
    lastScan?.peso != null && `${formatNumber(lastScan.peso, 1)} kg`,
    lastScan?.grasa != null && `${formatNumber(lastScan.grasa, 1)} % grasa`,
  ].filter(Boolean)

  const exportAll = async () => {
    setExporting(true)
    try {
      const now = new Date()
      const data = await buildExport(readPage, env.appVersion, now)
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = exportFileName(now)
      document.body.append(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      const n = Object.values(data.tables).reduce((s, rows) => s + (rows?.length ?? 0), 0)
      toast(`${n} registros exportados`, 'success')
    } catch (e) {
      toast(`No se pudo exportar: ${(e as Error).message}`, 'error')
    } finally {
      setExporting(false)
    }
  }

  const signOut = async () => {
    setLeaving(true)
    try {
      await requireSupabase().auth.signOut()
      // Nothing of this account stays cached on the device.
      qc.clear()
    } catch (e) {
      toast(`No se pudo cerrar sesión: ${(e as Error).message}`, 'error')
      setLeaving(false)
    }
  }

  return (
    <>
      <PageHeader large title="Más" />

      <Link to="/settings" className="card mb-6 flex items-center gap-3 p-4 active:bg-panel-2">
        <div className="min-w-0 flex-1">
          <div className="break-words font-display text-[24px] font-semibold uppercase leading-tight tracking-[0.04em]">
            {me.displayName || 'Sin nombre'}
          </div>
          {me.email && <div className="truncate text-[13px] text-muted">{me.email}</div>}
          <div className="mt-2 text-[13.5px] text-ink-2">
            {GOAL_LABEL[me.trainingGoal]} · {EXPERIENCE_LABEL[me.experience]} · {me.weeklyTarget}{' '}
            {me.weeklyTarget === 1 ? 'sesión' : 'sesiones'}/semana
          </div>
          {facts.length > 0 && <div className="text-[13px] text-muted">{facts.join(' · ')}</div>}
        </div>
        <ChevronRight className="size-5 shrink-0 text-muted" />
      </Link>

      <ul className="divide-y divide-line border-y border-line">
        <NavRow to="/goals" icon={<Target />} label="Objetivos" />
        <NavRow to="/programs" icon={<CalendarRange />} label="Programas" />
        <NavRow to="/library" icon={<BookOpen />} label="Biblioteca y vídeos" />
        <NavRow to="/gym" icon={<Dumbbell />} label="Mi gimnasio" hint="Fitness Park" />
        <NavRow to="/settings/health" icon={<HeartPulse />} label="Pulsera y salud" />
        <NavRow to="/settings" icon={<Settings />} label="Ajustes" />
        {isAdmin && (
          <NavRow
            to="/access"
            icon={<KeyRound />}
            label="Accesos"
            hint={
              waiting.length
                ? `${waiting.length} ${waiting.length === 1 ? 'pendiente' : 'pendientes'}`
                : undefined
            }
          />
        )}
      </ul>

      <ul className="mt-6 divide-y divide-line border-y border-line">
        <ActionRow
          icon={<Download />}
          label="Exportar mis datos"
          hint="Un archivo JSON con todo lo tuyo"
          onClick={exportAll}
          busy={exporting}
        />
        <ActionRow icon={<LogOut />} label="Cerrar sesión" onClick={signOut} busy={leaving} />
      </ul>

      <p className="mt-8 text-center text-[12px] text-muted">Forja {env.appVersion}</p>
    </>
  )
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <span className="grid size-5 shrink-0 place-items-center text-ink-2 [&>svg]:size-5">
      {children}
    </span>
  )
}

function NavRow({
  to,
  icon,
  label,
  hint,
}: {
  to: string
  icon: ReactNode
  label: string
  hint?: string
}) {
  return (
    <li>
      <Link to={to} className="flex min-h-[52px] items-center gap-3 py-2 active:bg-panel-2">
        <Icon>{icon}</Icon>
        <span className="min-w-0 flex-1 text-[15px] font-medium">{label}</span>
        {hint && <span className="text-[13px] text-muted">{hint}</span>}
        <ChevronRight className="size-4 shrink-0 text-muted" />
      </Link>
    </li>
  )
}

function ActionRow({
  icon,
  label,
  hint,
  onClick,
  busy,
}: {
  icon: ReactNode
  label: string
  hint?: string
  onClick: () => void
  busy?: boolean
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        aria-busy={busy || undefined}
        className="flex min-h-[52px] w-full items-center gap-3 py-2 text-left active:bg-panel-2 disabled:opacity-60"
      >
        <Icon>{icon}</Icon>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-medium">{label}</span>
          {hint && <span className="block text-[12.5px] text-muted">{hint}</span>}
        </span>
        {busy && (
          <span
            className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent text-muted"
            aria-hidden
          />
        )}
      </button>
    </li>
  )
}
