import { clsx } from 'clsx'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { Sheet } from '@/components/ui/Sheet'
import { formatNumber } from '@/domain/training'
import type { Exercise, LoggedSet } from '@/domain/types'

const parse = (s: string): number | null => {
  const n = Number(s.replace(',', '.'))
  return s.trim() !== '' && Number.isFinite(n) ? n : null
}

/**
 * Fix a set already marked during the session (wrong weight, a rep miscounted) or remove it.
 * Records and the next recommendations follow the corrected values.
 */
export function EditSetSheet({
  set,
  exercise,
  label,
  onClose,
  onSave,
  onDelete,
}: {
  set: LoggedSet | null
  exercise: Exercise
  label: string
  onClose: () => void
  onSave: (next: LoggedSet) => Promise<void>
  onDelete: (set: LoggedSet) => Promise<void>
}) {
  return (
    <Sheet
      open={set !== null}
      onClose={onClose}
      title={`Editar serie ${label}`}
      description={exercise.name}
    >
      {set && (
        <EditForm
          key={set.id}
          set={set}
          exercise={exercise}
          onClose={onClose}
          onSave={onSave}
          onDelete={onDelete}
        />
      )}
    </Sheet>
  )
}

function EditForm({
  set,
  exercise,
  onClose,
  onSave,
  onDelete,
}: {
  set: LoggedSet
  exercise: Exercise
  onClose: () => void
  onSave: (next: LoggedSet) => Promise<void>
  onDelete: (set: LoggedSet) => Promise<void>
}) {
  const [weight, setWeight] = useState(set.weight == null ? '' : formatNumber(set.weight))
  const [reps, setReps] = useState(set.reps == null ? '' : String(set.reps))
  const [rir, setRir] = useState<number | null>(set.rir)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const w = parse(weight)
  const r = parse(reps)
  const timed = Boolean(exercise.timed)
  const warm = set.kind === 'warmup'
  const invalid = r == null || r < 0 || (!timed && !exercise.bodyweight && w == null)

  const save = async () => {
    setBusy(true)
    try {
      await onSave({
        ...set,
        weight: timed ? null : w,
        reps: r == null ? null : Math.round(r),
        rir: timed || warm ? null : rir,
      })
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 pb-2">
      <div className={clsx('grid gap-3', timed ? 'grid-cols-1' : 'grid-cols-2')}>
        {!timed && (
          <Field label={exercise.bodyweight ? 'Lastre' : 'Peso'}>
            {(id) => (
              <Input
                id={id}
                inputMode="decimal"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                suffix="kg"
              />
            )}
          </Field>
        )}
        <Field label={timed ? 'Segundos' : 'Repeticiones'}>
          {(id) => (
            <Input
              id={id}
              inputMode="numeric"
              value={reps}
              onChange={(e) => setReps(e.target.value)}
              suffix={timed ? 's' : undefined}
            />
          )}
        </Field>
      </div>
      {!timed && !warm && (
        <div>
          <span className="spec mb-1.5 block">Reps en recámara</span>
          <div className="grid grid-cols-5 gap-1.5">
            {[0, 1, 2, 3, 4].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRir(rir === n ? null : n)}
                className={clsx(
                  'readout h-11 rounded-[6px] border text-[18px] font-semibold',
                  rir === n
                    ? 'border-gold bg-gold text-signal-ink'
                    : 'border-line bg-panel-2 text-ink-2',
                )}
              >
                {n === 4 ? '4+' : n}
              </button>
            ))}
          </div>
        </div>
      )}
      <Button block size="lg" loading={busy} disabled={invalid} onClick={() => void save()}>
        Guardar cambios
      </Button>
      <Button
        variant={confirmDelete ? 'danger' : 'ghost'}
        block
        disabled={busy}
        onClick={async () => {
          if (!confirmDelete) {
            setConfirmDelete(true)
            return
          }
          setBusy(true)
          try {
            await onDelete(set)
            onClose()
          } finally {
            setBusy(false)
          }
        }}
      >
        {confirmDelete ? 'Pulsa otra vez para borrarla' : 'Borrar serie'}
      </Button>
    </div>
  )
}
