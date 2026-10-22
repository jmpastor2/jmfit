import { ChevronRight, X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea } from '@/components/ui/Field'
import { Sheet } from '@/components/ui/Sheet'
import { useToast } from '@/components/ui/Toast'
import { Chip } from '@/components/ui/primitives'
import { useMachineActions } from '@/data/hooks'
import type { GymMachine } from '@/data/rows'
import { ExerciseLine, ExercisePicker } from '@/features/exercise/ExercisePicker'
import { useExerciseLookup } from '@/features/exercise/lookup'
import { newId } from '@/features/session/model'
import {
  BRAND_LINES,
  modelsFor,
  parseSettings,
  serializeSettings,
  SETTING_NAMES,
  type MachineSetting,
} from './machine'

/** Create (machine = null) or edit a machine. Mount it with a `key` so each opening starts fresh. */
export function MachineSheet({
  open,
  machine,
  onClose,
}: {
  open: boolean
  machine: GymMachine | null
  onClose: () => void
}) {
  const { save, remove } = useMachineActions()
  const lookup = useExerciseLookup()
  const { toast } = useToast()
  const [label, setLabel] = useState(machine?.label ?? '')
  const [brand, setBrand] = useState(machine?.brand ?? '')
  const [exerciseId, setExerciseId] = useState(machine?.exerciseId ?? '')
  const [settings, setSettings] = useState<MachineSetting[]>(() => {
    const s = parseSettings(machine?.seatSetting)
    return s.length ? s : [{ name: 'Asiento', value: '' }]
  })
  const [notes, setNotes] = useState(machine?.notes ?? '')
  const [picking, setPicking] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)

  const exercise = exerciseId ? lookup(exerciseId) : null
  const models = modelsFor(brand)
  const canSave = label.trim().length > 0 && Boolean(exerciseId)

  const submit = async () => {
    if (!canSave) return
    setBusy(true)
    try {
      await save(
        {
          id: machine?.id ?? newId(),
          label: label.trim(),
          brand: brand.trim() || null,
          exerciseId,
          seatSetting: serializeSettings(settings),
          notes: notes.trim() || null,
        },
        { quiet: true },
      )
      toast(machine ? 'Máquina actualizada' : 'Máquina añadida', 'success')
      onClose()
    } catch (e) {
      toast(`No se pudo guardar: ${(e as Error).message}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  const del = async () => {
    if (!machine) return
    setBusy(true)
    try {
      await remove(machine.id, { quiet: true })
      toast('Máquina borrada', 'success')
      onClose()
    } catch (e) {
      toast(`No se pudo borrar: ${(e as Error).message}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  const setSetting = (i: number, patch: Partial<MachineSetting>) =>
    setSettings((xs) => xs.map((s, j) => (j === i ? { ...s, ...patch } : s)))
  const unused = SETTING_NAMES.filter((n) => !settings.some((s) => s.name === n))

  return (
    <>
      <Sheet
        open={open && !picking}
        onClose={onClose}
        title={machine ? 'Editar máquina' : 'Nueva máquina'}
        tall
        footer={
          <Button block onClick={submit} disabled={!canSave} loading={busy}>
            Guardar
          </Button>
        }
      >
        <div className="flex flex-col gap-5">
          <Field
            label="Marca y línea"
            hint="Escribe la tuya o elige una de las que hay en Fitness Park."
          >
            {(id, describedBy) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="Technogym Pure Strength"
                autoComplete="off"
                className="text-[16px]"
              />
            )}
          </Field>
          {!models.length && (
            <div className="-mt-3 flex flex-wrap gap-x-1.5">
              {BRAND_LINES.map((l) => (
                <Chip key={l.brand} active={false} onClick={() => setBrand(l.brand)}>
                  {l.brand}
                </Chip>
              ))}
            </div>
          )}
          {models.length > 0 && (
            <div className="-mt-3">
              <p className="mb-1 text-[12.5px] text-muted">
                Modelos de esta línea (comprueba el nombre en la máquina):
              </p>
              <div className="flex flex-wrap gap-x-1.5">
                {models.map((m) => (
                  <Chip key={m} active={label === m} onClick={() => setLabel(m)}>
                    {m}
                  </Chip>
                ))}
              </div>
            </div>
          )}

          <Field label="Nombre en tu gimnasio">
            {(id) => (
              <Input
                id={id}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Press hombro de discos"
                autoComplete="off"
                className="text-[16px]"
                data-autofocus
              />
            )}
          </Field>

          <div>
            <span className="mb-1.5 block text-[13px] font-medium text-ink-2">Ejercicio</span>
            <button
              type="button"
              onClick={() => setPicking(true)}
              className="flex min-h-12 w-full items-center justify-between gap-3 rounded-control border border-line bg-panel-2 px-4 py-2.5 text-left"
            >
              {exercise ? (
                <ExerciseLine exercise={exercise} />
              ) : (
                <span className="text-[15px] text-muted">Elegir ejercicio</span>
              )}
              <ChevronRight className="size-4 shrink-0 text-muted" />
            </button>
          </div>

          <div>
            <span className="mb-1.5 block text-[13px] font-medium text-ink-2">Tus ajustes</span>
            <ul className="flex flex-col gap-2">
              {settings.map((s, i) => (
                <li key={i} className="flex items-center gap-2">
                  <Input
                    aria-label="Ajuste"
                    value={s.name}
                    onChange={(e) => setSetting(i, { name: e.target.value })}
                    placeholder="Ajuste"
                    className="w-[42%] text-[16px]"
                  />
                  <Input
                    aria-label={s.name ? `Valor de ${s.name}` : 'Valor'}
                    value={s.value}
                    onChange={(e) => setSetting(i, { value: e.target.value })}
                    placeholder="4, alto, B…"
                    className="text-[16px]"
                  />
                  <button
                    type="button"
                    aria-label="Quitar ajuste"
                    onClick={() => setSettings((xs) => xs.filter((_, j) => j !== i))}
                    className="grid size-11 shrink-0 place-items-center rounded-full text-muted active:bg-panel-2"
                  >
                    <X className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-1 flex flex-wrap gap-x-1.5">
              {unused.map((n) => (
                <Chip
                  key={n}
                  active={false}
                  onClick={() => setSettings((xs) => [...xs, { name: n, value: '' }])}
                >
                  + {n}
                </Chip>
              ))}
            </div>
          </div>

          <Field label="Notas">
            {(id) => (
              <Textarea
                id={id}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Junto a las poleas, la de la izquierda…"
                className="text-[16px]"
              />
            )}
          </Field>

          {machine &&
            (confirmDelete ? (
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
                  Cancelar
                </Button>
                <Button variant="danger" onClick={del} loading={busy}>
                  Sí, borrar
                </Button>
              </div>
            ) : (
              <Button variant="ghost" onClick={() => setConfirmDelete(true)}>
                Borrar máquina
              </Button>
            ))}
        </div>
      </Sheet>
      <ExercisePicker
        open={open && picking}
        onClose={() => setPicking(false)}
        onPick={(e) => {
          setExerciseId(e.id)
          if (!label.trim()) setLabel(e.name)
        }}
        title="Ejercicio de la máquina"
      />
    </>
  )
}
