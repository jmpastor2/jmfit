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
export function FinishSheet({
  open,
  onClose,
  workout,
  logged,
}: {
  open: boolean
  onClose: () => void
  workout: WorkoutFull
  logged: LoggedSet[]
}) {
  const nav = useNavigate()
  const { toast } = useToast()
  const { saveWorkout, deleteWorkout } = useTrainingActions()
  const [rpe, setRpe] = useState<number | null>(null)
  const [bw, setBw] = useState(workout.bodyweight == null ? '' : formatNumber(workout.bodyweight))
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
    ended.bodyweight = bw.trim() && Number.isFinite(weight) ? weight : workout.bodyweight
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
        <Field label="Peso corporal hoy" hint="Opcional: afina los ejercicios con tu propio peso">
          {(id) => (
            <Input
              id={id}
              inputMode="decimal"
              value={bw}
              onChange={(e) => setBw(e.target.value)}
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
