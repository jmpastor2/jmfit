import { clsx } from 'clsx'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea } from '@/components/ui/Field'
import { Sheet } from '@/components/ui/Sheet'
import { useToast } from '@/components/ui/Toast'
import { useTrainingActions } from '@/data/hooks'
import type { WorkoutFull } from '@/data/rows'
import { formatNumber } from '@/domain/training'
import type { LoggedSet } from '@/domain/types'
import { restTimer } from './restTimer'

const RPE_HINT: Record<number, string> = {
  5: 'Suave',
  6: 'Cómoda',
  7: 'Exigente',
  8: 'Dura',
  9: 'Muy dura',
  10: 'Al límite',
}

/** Close the session: how hard it felt, bodyweight, a note. An empty session can be discarded. */
export interface PendingExercise {
  key: string
  name: string
  /** What one tap would log («3 × 60 kg × 10»), or null when there is no weight to copy. */
  summary: string | null
  onLog: () => Promise<void>
}

export function FinishSheet({
  open,
  onClose,
  workout,
  logged,
  pending = [],
}: {
  open: boolean
  onClose: () => void
  workout: WorkoutFull
  logged: LoggedSet[]
  /** Planned exercises with no work set logged: done but not written down, or skipped. */
  pending?: PendingExercise[]
}) {
  const nav = useNavigate()
  const { toast } = useToast()
  const { saveWorkout, deleteWorkout } = useTrainingActions()
  const [rpe, setRpe] = useState<number | null>(null)
  // Empty on purpose: a weight copied from the last session made the body-weight trend flat.
  const [bw, setBw] = useState('')
  const [notes, setNotes] = useState(workout.notes ?? '')
  const [busy, setBusy] = useState(false)
  const workSets = logged.filter((s) => s.kind !== 'warmup').length

  const finish = async () => {
    setBusy(true)
    const weight = Number(bw.replace(',', '.'))
    restTimer.stop()
    const ended = { ...workout }
    ended.endedAt = new Date().toISOString()
    ended.sessionRpe = rpe
    // Only a weight typed today is stored; nothing typed means not weighed.
    ended.bodyweight = bw.trim() && Number.isFinite(weight) && weight > 0 ? weight : null
    ended.notes = notes.trim() || null
    // The cache is updated synchronously inside saveWorkout, so the summary opens on a closed session.
    const saving = saveWorkout(ended)
    nav(`/session/${workout.id}/summary`, { replace: true })
    try {
      await saving
    } catch {
      toast('Se guardará al recuperar la conexión', 'warn')
    }
  }

  const discard = async () => {
    restTimer.stop()
    nav('/', { replace: true })
    await deleteWorkout(workout.id)
    toast('Sesión descartada')
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Terminar entreno"
      description={`${workSets} series de trabajo registradas`}
      footer={
        <div className="flex flex-col gap-2 pb-1">
          <Button block size="lg" loading={busy} disabled={!workSets} onClick={finish}>
            Guardar sesión
          </Button>
          {!workSets && (
            <Button variant="ghost" block onClick={discard}>
              Descartar sesión vacía
            </Button>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        {pending.length > 0 && (
          <section>
            <h3 className="spec mb-1 text-warn">Sin registrar</h3>
            <p className="mb-2 text-[12.5px] text-muted">
              Si los hiciste, apúntalos de un toque; si no, quedan como saltados.
            </p>
            <ul className="divide-y divide-line border-y border-line">
              {pending.map((p) => (
                <li key={p.key} className="flex min-h-12 items-center justify-between gap-3 py-1">
                  <span className="min-w-0 text-[14.5px]">{p.name}</span>
                  {p.summary ? (
                    <button
                      type="button"
                      onClick={() => void p.onLog()}
                      className="shrink-0 rounded-[8px] border border-gold/60 px-3 py-2 text-[12.5px] font-semibold text-gold"
                    >
                      Lo hice · {p.summary}
                    </button>
                  ) : (
                    <span className="shrink-0 text-[12px] text-muted">Ábrelo para apuntarlo</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <span className="spec">Esfuerzo de la sesión</span>
            <span className="text-[13px] text-gold">{rpe ? RPE_HINT[rpe] : ''}</span>
          </div>
          <div className="grid grid-cols-6 gap-1.5">
            {[5, 6, 7, 8, 9, 10].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRpe(n)}
                className={clsx(
                  'readout h-12 rounded-[6px] border text-[20px] font-semibold',
                  rpe === n
                    ? 'border-gold bg-gold text-signal-ink'
                    : 'border-line bg-panel-2 text-ink-2',
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <Field
          label="Peso corporal hoy"
          hint={
            workout.bodyweight != null
              ? `Si te has pesado. El último fue ${formatNumber(workout.bodyweight)} kg.`
              : 'Si te has pesado: alimenta la tendencia de peso en Cuerpo.'
          }
        >
          {(id) => (
            <Input
              id={id}
              inputMode="decimal"
              value={bw}
              onChange={(e) => setBw(e.target.value)}
              placeholder={workout.bodyweight != null ? formatNumber(workout.bodyweight) : ''}
              suffix="kg"
            />
          )}
        </Field>
        <Field label="Notas">
          {(id) => (
            <Textarea
              id={id}
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Molestias, máquina ocupada, sensaciones…"
            />
          )}
        </Field>
      </div>
    </Sheet>
  )
}
