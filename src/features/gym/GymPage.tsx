import { Dumbbell, Plus, Printer, QrCode, Share2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Sheet'
import { useToast } from '@/components/ui/Toast'
import { EmptyState, Skeleton } from '@/components/ui/primitives'
import { useMachines } from '@/data/hooks'
import type { GymMachine } from '@/data/rows'
import { useExerciseLookup } from '@/features/exercise/lookup'
import { fileSlug, machineUrl, parseSettings } from './machine'
import { MachineSheet } from './MachineSheet'
import { shareOrDownloadSvg, svgDataUrl, useQrSvgs } from './qr'

const urlOf = (id: string) => machineUrl(id, window.location)

export function GymPage() {
  const q = useMachines()
  const machines = useMemo(() => q.data ?? [], [q.data])
  const lookup = useExerciseLookup()
  const [editing, setEditing] = useState<{ machine: GymMachine | null; n: number } | null>(null)
  const [qrFor, setQrFor] = useState<GymMachine | null>(null)
  const [printing, setPrinting] = useState(false)
  const open = (machine: GymMachine | null) => setEditing({ machine, n: Date.now() })

  return (
    <>
      <PageHeader
        back="/more"
        title="Mi gimnasio"
        subtitle="Fitness Park"
        action={
          <Button
            size="sm"
            variant="soft"
            leading={<Plus className="size-4" />}
            onClick={() => open(null)}
          >
            Añadir
          </Button>
        }
      />
      <p className="mb-5 text-[13.5px] leading-snug text-muted">
        Fitness Park no deja leer los datos de sus máquinas. El atajo es un QR por máquina: lo
        escaneas con la cámara y se abre su ejercicio con tus ajustes.
      </p>

      {q.isPending ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-14 rounded-[8px]" />
          <Skeleton className="h-14 rounded-[8px]" />
        </div>
      ) : q.isError ? (
        <p className="py-8 text-center text-[14px] text-danger">
          No se pudieron cargar las máquinas.
        </p>
      ) : !machines.length ? (
        <EmptyState
          icon={<Dumbbell className="size-6" />}
          title="Aún no has guardado máquinas"
          description="Añade las que usas: marca, ejercicio y cómo las ajustas (asiento, respaldo…). Así no lo vuelves a buscar."
          action={
            <Button leading={<Plus className="size-4" />} onClick={() => open(null)}>
              Añadir máquina
            </Button>
          }
        />
      ) : (
        <>
          <ul className="divide-y divide-line border-y border-line">
            {machines.map((m) => {
              const ex = lookup(m.exerciseId)
              const settings = parseSettings(m.seatSetting)
              return (
                <li key={m.id} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => open(m)}
                    className="min-h-[60px] min-w-0 flex-1 py-2.5 text-left active:bg-panel-2"
                  >
                    <span className="block break-words text-[15px] font-medium">{m.label}</span>
                    <span className="block text-[12.5px] text-muted">
                      {[m.brand, ex.name].filter(Boolean).join(' · ')}
                    </span>
                    {settings.length > 0 && (
                      <span className="mt-0.5 block text-[12.5px] text-ink-2">
                        {settings
                          .map((s) => (s.name ? `${s.name} ${s.value}` : s.value))
                          .join(' · ')}
                      </span>
                    )}
                  </button>
                  <Link
                    to={`/m/${m.id}`}
                    className="spec grid h-11 shrink-0 place-items-center px-2 text-gold"
                    aria-label={`Abrir ${m.label}`}
                  >
                    Abrir
                  </Link>
                  <button
                    type="button"
                    aria-label={`QR de ${m.label}`}
                    onClick={() => setQrFor(m)}
                    className="grid size-11 shrink-0 place-items-center rounded-full text-ink-2 active:bg-panel-2"
                  >
                    <QrCode className="size-5" />
                  </button>
                </li>
              )
            })}
          </ul>
          <Button
            className="mt-5"
            block
            variant="secondary"
            leading={<Printer className="size-4" />}
            onClick={() => setPrinting(true)}
          >
            Imprimir todas las etiquetas
          </Button>
          <p className="mt-2 text-[12px] text-muted">
            Pegar etiquetas en las máquinas requiere permiso del club. Alternativa: una tarjeta o
            llavero con tus QR.
          </p>
        </>
      )}

      {editing && (
        <MachineSheet
          key={editing.n}
          open
          machine={editing.machine}
          onClose={() => setEditing(null)}
        />
      )}
      <QrSheet machine={qrFor} onClose={() => setQrFor(null)} />
      {printing && <PrintLabels machines={machines} onClose={() => setPrinting(false)} />}
    </>
  )
}

function QrSheet({ machine, onClose }: { machine: GymMachine | null; onClose: () => void }) {
  const url = machine ? urlOf(machine.id) : ''
  const svgs = useQrSvgs(url ? [url] : [])
  const svg = svgs[url]
  const { toast } = useToast()
  const share = async () => {
    if (!machine || !svg) return
    const r = await shareOrDownloadSvg(svg, `forja-${fileSlug(machine.label)}.svg`, machine.label)
    if (r === 'downloaded') toast('QR descargado', 'success')
  }
  return (
    <Sheet
      open={machine !== null}
      onClose={onClose}
      title={machine?.label}
      description={machine?.brand ?? undefined}
      footer={
        <Button block leading={<Share2 className="size-4" />} onClick={share} disabled={!svg}>
          Compartir o descargar
        </Button>
      }
    >
      <div className="flex flex-col items-center gap-3 pb-2">
        <div className="grid aspect-square w-full max-w-[260px] place-items-center rounded-[10px] bg-white p-2">
          {svg ? (
            <img
              src={svgDataUrl(svg)}
              alt={`QR que abre ${machine?.label ?? 'la máquina'} en Forja`}
              className="size-full"
            />
          ) : (
            <Skeleton className="size-full" />
          )}
        </div>
        <p className="break-all text-center text-[12px] text-muted">{url}</p>
      </div>
    </Sheet>
  )
}

/**
 * Full-screen sheet of labels (QR + name) that prints alone: the print CSS hides the app and
 * shows only this portal.
 */
function PrintLabels({ machines, onClose }: { machines: GymMachine[]; onClose: () => void }) {
  const urls = useMemo(() => machines.map((m) => urlOf(m.id)), [machines])
  const svgs = useQrSvgs(urls)
  const ready = urls.every((u) => svgs[u])
  return createPortal(
    <div id="forja-print" className="fixed inset-0 z-[200] overflow-y-auto bg-white text-black">
      <style>{`
        @media print {
          @page { margin: 12mm; }
          body > *:not(#forja-print) { display: none !important; }
          #forja-print { position: static !important; overflow: visible !important; }
          #forja-print .no-print { display: none !important; }
          html, body { background: #fff !important; }
        }
        #forja-print .label { break-inside: avoid; page-break-inside: avoid; }
      `}</style>
      <div className="no-print safe-top sticky top-0 flex items-center gap-2 border-b border-black/10 bg-white px-4 pb-3">
        <p className="min-w-0 flex-1 text-[13px] text-black/70">
          {machines.length} etiquetas. Recorta por las líneas.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="h-11 rounded-[8px] px-4 text-[14px] font-semibold text-black/70"
        >
          Cerrar
        </button>
        <button
          type="button"
          disabled={!ready}
          onClick={() => window.print()}
          className="h-11 rounded-[8px] bg-black px-4 text-[14px] font-semibold text-white disabled:opacity-40"
        >
          Imprimir
        </button>
      </div>
      <div className="grid grid-cols-2 gap-0 p-4 sm:grid-cols-3 print:grid-cols-3 print:p-0">
        {machines.map((m, i) => {
          const svg = svgs[urls[i]!]
          return (
            <div
              key={m.id}
              className="label flex flex-col items-center border border-dashed border-black/30 p-3 text-center"
            >
              {svg ? (
                <img src={svgDataUrl(svg)} alt="" className="aspect-square w-full max-w-[160px]" />
              ) : (
                <div className="aspect-square w-full max-w-[160px] bg-black/5" />
              )}
              <span className="mt-1 break-words text-[14px] font-semibold leading-tight">
                {m.label}
              </span>
              {m.brand && <span className="text-[11px] text-black/60">{m.brand}</span>}
              <span className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-black/50">
                Forja
              </span>
            </div>
          )
        })}
      </div>
    </div>,
    document.body,
  )
}
