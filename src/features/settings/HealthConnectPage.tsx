import { useQueryClient } from '@tanstack/react-query'
import { ExternalLink, RefreshCw, Unplug } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { Badge, SectionTitle, Skeleton } from '@/components/ui/primitives'
import { useHealthConnection, useUid } from '@/data/hooks'
import { longDate } from '@/features/body/scans'
import {
  disconnectGoogleHealth,
  GoogleHealthError,
  startGoogleHealthConnect,
  syncGoogleHealth,
} from '@/lib/googleHealth'
import { requireSupabase } from '@/lib/supabase'
import { healthErrorMessage } from './healthMessages'

const DOCS_URL = 'https://github.com/jmpastor2/jmfit/blob/main/docs/google-health.md'

const codeOf = (e: unknown) =>
  e instanceof GoogleHealthError ? e.code : e instanceof Error ? e.message : 'internal_error'

const p = (n: number) => String(n).padStart(2, '0')

function when(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const day = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
  return `${longDate(day)}, ${p(d.getHours())}:${p(d.getMinutes())}`
}

export function HealthConnectPage() {
  const uid = useUid()
  const qc = useQueryClient()
  const conn = useHealthConnection()
  const { toast } = useToast()
  const [params, setParams] = useSearchParams()
  const [busy, setBusy] = useState<null | 'connect' | 'sync' | 'disconnect'>(null)
  // Back from Google: `#/settings/health?connected=1[&sync=failed]` or `?error=code`. The page
  // mounts fresh after that redirect, so the first render reads the outcome.
  const [problem, setProblem] = useState<string | null>(() => {
    const error = params.get('error')
    return error ? healthErrorMessage(error) : null
  })
  const [notice, setNotice] = useState<string | null>(() => {
    if (params.get('error') || !params.get('connected')) return null
    return params.get('sync') === 'failed'
      ? 'Conectado, pero la primera descarga falló. Pulsa «Sincronizar ahora».'
      : 'Conectado. Ya se han descargado los últimos 30 días.'
  })
  const [confirmOff, setConfirmOff] = useState(false)

  useEffect(() => {
    if (!params.get('error') && !params.get('connected')) return
    void qc.invalidateQueries({ queryKey: ['healthConn', uid] })
    void qc.invalidateQueries({ queryKey: ['health', uid] })
    setParams({}, { replace: true })
  }, [params, setParams, qc, uid])

  const run = async (kind: 'connect' | 'sync' | 'disconnect') => {
    setBusy(kind)
    setProblem(null)
    setNotice(null)
    try {
      const sb = requireSupabase()
      if (kind === 'connect') {
        const url = await startGoogleHealthConnect(sb)
        window.location.assign(url)
        return // leaving the app; keep the spinner
      }
      if (kind === 'sync') {
        const r = await syncGoogleHealth(sb)
        toast(`Sincronizados ${r.days} días`, 'success')
      } else {
        await disconnectGoogleHealth(sb)
        setConfirmOff(false)
        toast('Pulsera desconectada. Lo ya sincronizado se queda.', 'success')
      }
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['healthConn', uid] }),
        qc.invalidateQueries({ queryKey: ['health', uid] }),
      ])
    } catch (e) {
      setProblem(healthErrorMessage(codeOf(e)))
    }
    setBusy(null)
  }

  const c = conn.data ?? null
  const status = c?.status ?? 'none'

  return (
    <>
      <PageHeader
        back="/more"
        title="Pulsera y salud"
        subtitle="Google Fitbit Air · Google Health"
      />

      <section className="card p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="spec">Conexión</span>
          {conn.isPending ? (
            <Skeleton className="h-5 w-24 rounded-full" />
          ) : status === 'connected' ? (
            <Badge tone="brand">Conectada</Badge>
          ) : status === 'reauth_required' ? (
            <Badge tone="warn">Hay que reconectar</Badge>
          ) : status === 'error' ? (
            <Badge tone="danger">Con errores</Badge>
          ) : (
            <Badge>Sin conectar</Badge>
          )}
        </div>
        {c && (
          <dl className="mt-3 grid grid-cols-2 gap-3 text-[13.5px]">
            <div>
              <dt className="text-muted">Conectada el</dt>
              <dd>{when(c.connectedAt)}</dd>
            </div>
            <div>
              <dt className="text-muted">Última sincronización</dt>
              <dd>{when(c.lastSyncAt)}</dd>
            </div>
            {c.lastError && (
              <div className="col-span-2 text-warn">
                <dt className="text-muted">Último error</dt>
                <dd>{healthErrorMessage(c.lastError)}</dd>
              </div>
            )}
          </dl>
        )}

        {problem && (
          <p
            role="alert"
            className="mt-3 rounded-[8px] border border-warn/30 bg-warn-soft px-3 py-2 text-[13.5px] text-warn"
          >
            {problem}
          </p>
        )}
        {notice && <p className="mt-3 text-[13.5px] text-gold">{notice}</p>}

        <div className="mt-4 flex flex-col gap-2">
          {status === 'connected' || status === 'error' ? (
            <Button
              block
              leading={<RefreshCw className="size-4" />}
              loading={busy === 'sync'}
              disabled={busy !== null}
              onClick={() => run('sync')}
            >
              Sincronizar ahora
            </Button>
          ) : (
            <Button
              block
              loading={busy === 'connect'}
              disabled={busy !== null}
              onClick={() => run('connect')}
            >
              {status === 'reauth_required' ? 'Reconectar Google Health' : 'Conectar Google Health'}
            </Button>
          )}
          {c &&
            (confirmOff ? (
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="secondary"
                  onClick={() => setConfirmOff(false)}
                  disabled={busy !== null}
                >
                  Cancelar
                </Button>
                <Button
                  variant="danger"
                  loading={busy === 'disconnect'}
                  disabled={busy !== null}
                  onClick={() => run('disconnect')}
                >
                  Desconectar
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                leading={<Unplug className="size-4" />}
                onClick={() => setConfirmOff(true)}
                disabled={busy !== null}
              >
                Desconectar
              </Button>
            ))}
        </div>
      </section>

      <section className="mt-6">
        <SectionTitle>La verdad sobre la conexión</SectionTitle>
        <div className="flex flex-col gap-3 text-[14px] leading-relaxed text-ink-2">
          <p>
            La Fitbit Air no tiene pantalla: sus datos van a la app Google Health. Para leerlos
            desde fuera, Google ofrece la Google Health API, que sustituye a la Fitbit Web API (esa
            se apaga el 30 de octubre de 2026).
          </p>
          <p>
            Ahora mismo Google <strong className="text-ink">no admite proyectos nuevos</strong> en
            esa API. Forja ya tiene la conexión hecha: cuando Google abra el acceso, se configura
            una vez y el sueño, la FC en reposo, la HRV y los pasos llegarán solos.
          </p>
          <a
            href={DOCS_URL}
            target="_blank"
            rel="noreferrer"
            className="spec tap-link inline-flex items-center gap-1.5 self-start text-gold"
          >
            Pasos para configurarla <ExternalLink className="size-3.5" />
          </a>
        </div>
      </section>

      <section className="mt-6">
        <SectionTitle>Mientras tanto</SectionTitle>
        <p className="text-[14px] leading-relaxed text-ink-2">
          Cada mañana abre Google Health y copia en el check-in diario cuatro números: horas de
          sueño, FC en reposo, HRV y pasos de ayer. Son 20 segundos y alimentan la preparación de
          «Hoy» y las gráficas de recuperación.
        </p>
        <Link to="/body?v=recovery" className="spec tap-link mt-3 inline-block text-gold">
          Ver recuperación
        </Link>
      </section>
    </>
  )
}
