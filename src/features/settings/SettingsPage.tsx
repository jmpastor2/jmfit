import { X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'
import { SectionTitle, ToggleRow } from '@/components/ui/primitives'
import { useMe, useUpdateProfile } from '@/data/hooks'
import { formatNumber, localDateKey } from '@/domain/training'
import type { Experience, Goal } from '@/domain/types'
import { EXPERIENCE_LABEL, GOAL_LABEL, GOAL_ORDER } from '@/features/programs/labels'
import { useNow } from '@/lib/useNow'
import {
  addPlate,
  formFromProfile,
  macroKcal,
  readNumber,
  validate,
  type SettingsForm,
} from './form'

const EXPERIENCES: Experience[] = ['novice', 'intermediate', 'advanced']

export function SettingsPage() {
  const me = useMe()
  const update = useUpdateProfile()
  const { toast } = useToast()
  const [form, setForm] = useState<SettingsForm>(() => formFromProfile(me))
  const [plateText, setPlateText] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const today = localDateKey(useNow(3_600_000))
  const { patch, errors } = validate(form, today)
  const err = (k: keyof SettingsForm) => (submitted ? errors[k] : undefined)
  const set = <K extends keyof SettingsForm>(k: K, v: SettingsForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }))
  const dirty = JSON.stringify(form) !== JSON.stringify(formFromProfile(me))

  const save = async () => {
    setSubmitted(true)
    if (!patch) {
      toast('Revisa los campos marcados', 'warn')
      return
    }
    try {
      await update.mutateAsync(patch)
      toast('Ajustes guardados', 'success')
      setSubmitted(false)
    } catch (e) {
      toast(`No se pudo guardar: ${(e as Error).message}`, 'error')
    }
  }

  const kcalFromMacros = macroKcal(
    numOrNull(form.targetProtein),
    numOrNull(form.targetCarbs),
    numOrNull(form.targetFat),
  )

  const text = (
    k: keyof SettingsForm,
    label: string,
    extra: Partial<Parameters<typeof Input>[0]> = {},
  ) => (
    <Field label={label} error={err(k)}>
      {(id, describedBy) => (
        <Input
          id={id}
          aria-describedby={describedBy}
          value={form[k] as string}
          invalid={Boolean(err(k))}
          onChange={(e) => set(k, e.target.value as never)}
          className="text-[16px]"
          {...extra}
        />
      )}
    </Field>
  )

  return (
    <>
      <PageHeader back="/more" title="Ajustes" />
      <div className="flex flex-col gap-7 pb-24">
        <Group title="Perfil">
          {text('displayName', 'Nombre', { autoComplete: 'name' })}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Sexo">
              {(id) => (
                <Select
                  id={id}
                  value={form.sex}
                  onChange={(e) => set('sex', e.target.value as SettingsForm['sex'])}
                >
                  <option value="">Sin indicar</option>
                  <option value="M">Hombre</option>
                  <option value="F">Mujer</option>
                  <option value="O">Otro</option>
                </Select>
              )}
            </Field>
            {text('heightCm', 'Altura', { inputMode: 'decimal', suffix: 'cm' })}
          </div>
          {text('birthDate', 'Fecha de nacimiento', { type: 'date', max: today })}
        </Group>

        <Group title="Entrenamiento">
          <Field label="Nivel">
            {(id) => (
              <Select
                id={id}
                value={form.experience}
                onChange={(e) => set('experience', e.target.value as Experience)}
              >
                {EXPERIENCES.map((x) => (
                  <option key={x} value={x}>
                    {EXPERIENCE_LABEL[x]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Objetivo">
            {(id) => (
              <Select
                id={id}
                value={form.trainingGoal}
                onChange={(e) => set('trainingGoal', e.target.value as Goal)}
              >
                {GOAL_ORDER.map((g) => (
                  <option key={g} value={g}>
                    {GOAL_LABEL[g]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Sesiones por semana (objetivo)" error={err('weeklyTarget')}>
            {(id) => (
              <Select
                id={id}
                value={form.weeklyTarget}
                onChange={(e) => set('weeklyTarget', e.target.value)}
              >
                {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                  <option key={n} value={String(n)}>
                    {n}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </Group>

        <Group title="Material">
          {text('barKg', 'Barra', { inputMode: 'decimal', suffix: 'kg' })}
          <div>
            <span className="mb-1.5 block text-[13px] font-medium text-ink-2">
              Discos disponibles (kg cada uno)
            </span>
            <ul className="flex flex-wrap gap-2">
              {form.platesKg.map((p) => (
                <li key={p}>
                  <button
                    type="button"
                    aria-label={`Quitar disco de ${formatNumber(p)} kg`}
                    onClick={() =>
                      set(
                        'platesKg',
                        form.platesKg.filter((x) => x !== p),
                      )
                    }
                    className="flex h-11 items-center gap-1.5 rounded-full border border-line bg-panel-2 pl-3.5 pr-2.5"
                  >
                    <span className="readout text-[17px] font-semibold">{formatNumber(p)}</span>
                    <X className="size-3.5 text-muted" />
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex gap-2">
              <Input
                aria-label="Peso del disco a añadir"
                inputMode="decimal"
                placeholder="1,25"
                value={plateText}
                onChange={(e) => setPlateText(e.target.value)}
                suffix="kg"
                className="text-[16px]"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    set('platesKg', addPlate(form.platesKg, plateText))
                    setPlateText('')
                  }
                }}
              />
              <Button
                variant="secondary"
                onClick={() => {
                  set('platesKg', addPlate(form.platesKg, plateText))
                  setPlateText('')
                }}
              >
                Añadir
              </Button>
            </div>
            {err('platesKg') && <p className="mt-1 text-[12.5px] text-danger">{err('platesKg')}</p>}
            <p className="mt-1 text-[12.5px] text-muted">
              Sirve para decirte qué discos poner en cada lado.
            </p>
          </div>
        </Group>

        <Group title="Descanso">
          <ToggleRow
            checked={form.restSound}
            onChange={(v) => set('restSound', v)}
            label="Sonido al acabar el descanso"
            hint="Además de la vibración."
          />
        </Group>

        <Group title="Macros objetivo">
          <div className="grid grid-cols-2 gap-3">
            {text('targetKcal', 'Calorías', { inputMode: 'numeric', suffix: 'kcal' })}
            {text('targetProtein', 'Proteína', { inputMode: 'numeric', suffix: 'g' })}
            {text('targetCarbs', 'Hidratos', { inputMode: 'numeric', suffix: 'g' })}
            {text('targetFat', 'Grasas', { inputMode: 'numeric', suffix: 'g' })}
          </div>
          {kcalFromMacros !== null && (
            <p className="text-[12.5px] text-muted">
              Los macros suman {Math.round(kcalFromMacros)} kcal (4 por g de proteína e hidratos, 9
              por g de grasa).
            </p>
          )}
        </Group>
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(max(env(safe-area-inset-bottom),10px)+86px)] z-30">
        <div className="mx-auto max-w-2xl px-4">
          <Button
            block
            className="pointer-events-auto shadow-lg"
            onClick={save}
            disabled={!dirty}
            loading={update.isPending}
          >
            {dirty ? 'Guardar cambios' : 'Guardado'}
          </Button>
        </div>
      </div>
    </>
  )
}

function numOrNull(text: string): number | null {
  const n = readNumber(text)
  return n === null || Number.isNaN(n) ? null : n
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <SectionTitle>{title}</SectionTitle>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  )
}
