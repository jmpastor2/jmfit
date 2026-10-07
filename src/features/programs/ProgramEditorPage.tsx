import { clsx } from 'clsx'
import { ArrowDown, ArrowUp, Minus, Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useBlocker, useParams } from 'react-router-dom'
import { Meter } from '@/components/kpi/Meter'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { FloatingAction } from '@/components/ui/FloatingAction'
import { Sheet } from '@/components/ui/Sheet'
import { useToast } from '@/components/ui/Toast'
import { EmptyState, Segmented, SectionTitle, Skeleton } from '@/components/ui/primitives'
import { MUSCLE_LABEL } from '@/content/exercises'
import { useMe, useProgramActions, usePrograms } from '@/data/hooks'
import type { Program } from '@/data/rows'
import { formatNumber } from '@/domain/training'
import type { Muscle, ProgramDay, Slot } from '@/domain/types'
import { ExercisePicker } from '@/features/exercise/ExercisePicker'
import { useExerciseLookup } from '@/features/exercise/lookup'
import { newId, slotFor } from '@/features/session/model'
import { formatPrescription, formatRest, WEEKDAY_LONG } from './labels'
import { MUSCLE_ORDER, VOLUME_RANGES } from './landmarkRanges'
import {
  emptyDay,
  MESO_MAX,
  MESO_MIN,
  move,
  REST_OPTIONS,
  sameProgram,
  SUPERSET_LETTERS,
  validateProgram,
  validateSlot,
} from './programModel'
import { programVolume, volumeRows, type VolumeRow } from './programVolume'

/** Edit one program: details, days, exercises and the weekly volume they add up to. */
export function ProgramEditorPage() {
  const { programId } = useParams()
  const programs = usePrograms()
  const program = programs.data?.find((p) => p.id === programId)

  if (programs.isPending) {
    return (
      <>
        <PageHeader title="Programa" back="/programs" />
        <Skeleton className="h-40 rounded-[10px]" />
      </>
    )
  }
  if (!program) {
    return (
      <>
        <PageHeader title="Programa" back="/programs" />
        <EmptyState
          title="Programa no encontrado"
          description="Puede que se borrara en otro dispositivo. Vuelve a Programas y elige o crea uno."
        />
      </>
    )
  }
  return <Editor key={program.id} initial={program} />
}

function Editor({ initial }: { initial: Program }) {
  const me = useMe()
  const { toast } = useToast()
  const { save, activate } = useProgramActions()
  const lookup = useExerciseLookup()
  const [saved, setSaved] = useState(initial)
  const [draft, setDraft] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [dayEdit, setDayEdit] = useState<string | null>(null)
  const [slotEdit, setSlotEdit] = useState<{ dayId: string; slotId: string } | null>(null)
  const [pickFor, setPickFor] = useState<{ dayId: string; slotId?: string } | null>(null)

  const isActive = me.activeProgramId === draft.id
  const dirty = !sameProgram(draft, saved)
  const issues = useMemo(() => validateProgram(draft), [draft])
  const badIds = useMemo(() => new Set(issues.map((i) => i.at)), [issues])
  const programIssues = issues.filter((i) => i.at === 'program')

  const rows = useMemo(
    () => volumeRows(programVolume(draft.days, lookup), VOLUME_RANGES, MUSCLE_ORDER),
    [draft.days, lookup],
  )

  // Leaving with unsaved changes: in-app navigation asks, closing the tab warns.
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && currentLocation.pathname !== nextLocation.pathname,
  )
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const patch = (p: Partial<Program>) => setDraft((d) => ({ ...d, ...p }))
  const patchDay = (dayId: string, p: Partial<ProgramDay>) =>
    setDraft((d) => ({ ...d, days: d.days.map((x) => (x.id === dayId ? { ...x, ...p } : x)) }))
  const patchSlot = (dayId: string, slotId: string, p: Partial<Slot>) =>
    setDraft((d) => ({
      ...d,
      days: d.days.map((x) =>
        x.id === dayId
          ? { ...x, slots: x.slots.map((s) => (s.id === slotId ? { ...s, ...p } : s)) }
          : x,
      ),
    }))
  const setSlots = (dayId: string, f: (slots: Slot[]) => Slot[]) =>
    setDraft((d) => ({
      ...d,
      days: d.days.map((x) => (x.id === dayId ? { ...x, slots: f(x.slots) } : x)),
    }))

  const doSave = async (): Promise<boolean> => {
    if (issues.length) {
      toast(issues[0]!.message, 'warn')
      return false
    }
    const clean = { ...draft, name: draft.name.trim() }
    setBusy(true)
    try {
      await save(clean)
      setDraft(clean)
      setSaved(clean)
      toast('Programa guardado', 'success')
      return true
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo guardar', 'error')
      return false
    } finally {
      setBusy(false)
    }
  }

  const doActivate = async () => {
    if (issues.length) {
      toast(issues[0]!.message, 'warn')
      return
    }
    const next = { ...draft, name: draft.name.trim(), archived: false }
    setBusy(true)
    try {
      await activate(next)
      setDraft(next)
      setSaved(next)
      toast(`${next.name} es tu programa activo`, 'success')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo activar', 'error')
    } finally {
      setBusy(false)
    }
  }

  const toggleArchive = async () => {
    const next = { ...saved, archived: !saved.archived }
    setBusy(true)
    try {
      await save(next)
      setSaved(next)
      setDraft((d) => ({ ...d, archived: next.archived }))
      toast(next.archived ? 'Programa archivado' : 'Programa recuperado', 'success')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo guardar', 'error')
    } finally {
      setBusy(false)
    }
  }

  const addDay = () => {
    const day = emptyDay(newId(), draft.days.length)
    patch({ days: [...draft.days, day] })
    setDayEdit(day.id)
  }

  const editingDay = draft.days.find((d) => d.id === dayEdit) ?? null
  const editingSlotDay = slotEdit ? draft.days.find((d) => d.id === slotEdit.dayId) : undefined
  const editingSlot = editingSlotDay?.slots.find((s) => s.id === slotEdit?.slotId) ?? null

  return (
    <>
      <PageHeader
        title={draft.name.trim() || 'Programa'}
        back="/programs"
        subtitle={
          isActive ? 'Programa activo' : draft.archived ? 'Archivado' : 'Guardado, sin activar'
        }
      />

      {/* ───── Details ───── */}
      <section className="flex flex-col gap-4">
        <Field label="Nombre" error={draft.name.trim() ? undefined : 'Ponle un nombre al programa'}>
          {(id, d) => (
            <Input
              id={id}
              aria-describedby={d}
              value={draft.name}
              invalid={!draft.name.trim()}
              maxLength={60}
              onChange={(e) => patch({ name: e.target.value })}
            />
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Mesociclo" hint="Más 1 semana de descarga">
            {(id, d) => (
              <Select
                id={id}
                aria-describedby={d}
                value={draft.mesoWeeks}
                onChange={(e) => patch({ mesoWeeks: Number(e.target.value) })}
              >
                {Array.from({ length: MESO_MAX - MESO_MIN + 1 }, (_, i) => MESO_MIN + i).map(
                  (n) => (
                    <option key={n} value={n}>
                      {n} semanas
                    </option>
                  ),
                )}
              </Select>
            )}
          </Field>
          <Field label="Empieza el">
            {(id) => (
              <Input
                id={id}
                type="date"
                value={draft.startedOn}
                invalid={programIssues.some((i) => i.message.includes('fecha'))}
                onChange={(e) => patch({ startedOn: e.target.value })}
              />
            )}
          </Field>
        </div>
        <div className="flex flex-wrap gap-2">
          {!isActive && (
            <Button size="sm" variant="soft" disabled={busy} onClick={doActivate}>
              {dirty ? 'Guardar y activar' : 'Activar'}
            </Button>
          )}
          {!isActive && (
            <Button size="sm" variant="ghost" disabled={busy} onClick={toggleArchive}>
              {saved.archived ? 'Recuperar' : 'Archivar'}
            </Button>
          )}
        </div>
      </section>

      {/* ───── Days ───── */}
      <section className="mt-6">
        <SectionTitle
          action={
            <span className="spec text-muted">
              {draft.days.length} {draft.days.length === 1 ? 'día' : 'días'}
            </span>
          }
        >
          Días
        </SectionTitle>
        {!draft.days.length && (
          <p className="pb-4 text-[14px] text-muted">
            Sin días todavía. Añade uno por cada sesión de la semana (p. ej. Empuje, Tirón, Pierna).
          </p>
        )}
        <div className="flex flex-col gap-3">
          {draft.days.map((day, di) => (
            <article key={day.id} className="card p-4">
              <header className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="spec">
                    {day.weekday === null ? 'Flotante' : WEEKDAY_LONG[day.weekday]}
                  </div>
                  <h3
                    className={clsx(
                      'break-words font-display text-[20px] font-semibold uppercase leading-tight tracking-[0.05em]',
                      !day.name.trim() && 'text-danger',
                    )}
                  >
                    {day.name.trim() || 'Sin nombre'}
                  </h3>
                  {day.focus && <p className="text-[12.5px] text-muted">{day.focus}</p>}
                </div>
                <div className="flex shrink-0">
                  <IconButton
                    label={`Subir ${day.name}`}
                    disabled={di === 0}
                    onClick={() => patch({ days: move(draft.days, di, -1) })}
                  >
                    <ArrowUp className="size-4" />
                  </IconButton>
                  <IconButton
                    label={`Bajar ${day.name}`}
                    disabled={di === draft.days.length - 1}
                    onClick={() => patch({ days: move(draft.days, di, 1) })}
                  >
                    <ArrowDown className="size-4" />
                  </IconButton>
                  <IconButton label={`Editar ${day.name}`} onClick={() => setDayEdit(day.id)}>
                    <Pencil className="size-4" />
                  </IconButton>
                </div>
              </header>

              <ol className="mt-2 divide-y divide-line border-t border-line">
                {day.slots.map((s) => {
                  const bad = badIds.has(s.id)
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => setSlotEdit({ dayId: day.id, slotId: s.id })}
                        className="flex min-h-[52px] w-full items-center justify-between gap-3 py-2 text-left active:bg-panel-2"
                      >
                        <span className="min-w-0">
                          <span className="block text-[14.5px] font-medium">
                            {s.superset && (
                              <span className="spec mr-1.5 text-gold">{s.superset}</span>
                            )}
                            {lookup(s.exerciseId).name}
                          </span>
                          {s.note && (
                            <span className="block truncate text-[12px] text-muted">{s.note}</span>
                          )}
                        </span>
                        <span
                          className={clsx(
                            'readout shrink-0 text-[15px]',
                            bad ? 'text-danger' : 'text-ink-2',
                          )}
                        >
                          {formatPrescription(s)}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ol>
              <Button
                size="sm"
                variant="ghost"
                className="mt-1 -ml-2"
                leading={<Plus className="size-4" />}
                onClick={() => setPickFor({ dayId: day.id })}
              >
                Añadir ejercicio
              </Button>
            </article>
          ))}
        </div>
        <Button
          variant="secondary"
          block
          className="mt-3"
          leading={<Plus className="size-4" />}
          onClick={addDay}
        >
          Añadir día
        </Button>
      </section>

      {/* ───── Weekly volume ───── */}
      <VolumeSection rows={rows} />

      {issues.length > 0 && (
        <div
          className="mt-6 rounded-[8px] border border-danger/30 bg-danger-soft p-3 text-[13px] text-danger"
          role="alert"
        >
          {issues.length === 1
            ? 'Falta corregir 1 cosa'
            : `Faltan por corregir ${issues.length} cosas`}
          : {[...new Set(issues.map((i) => i.message))].join(' · ')}
        </div>
      )}

      {dirty && (
        <FloatingAction>
          <Button
            className="pointer-events-auto shadow-lg"
            size="lg"
            loading={busy}
            disabled={issues.length > 0}
            onClick={() => void doSave()}
          >
            Guardar
          </Button>
        </FloatingAction>
      )}

      {/* ───── Sheets ───── */}
      <DaySheet
        day={editingDay}
        canDelete
        onClose={() => setDayEdit(null)}
        onChange={(p) => editingDay && patchDay(editingDay.id, p)}
        onDelete={() => {
          if (!editingDay) return
          patch({ days: draft.days.filter((d) => d.id !== editingDay.id) })
          setDayEdit(null)
        }}
      />

      <SlotSheet
        slot={editingSlot}
        index={editingSlotDay && editingSlot ? editingSlotDay.slots.indexOf(editingSlot) : 0}
        count={editingSlotDay?.slots.length ?? 0}
        exerciseName={editingSlot ? lookup(editingSlot.exerciseId).name : ''}
        onClose={() => setSlotEdit(null)}
        onChange={(p) => slotEdit && patchSlot(slotEdit.dayId, slotEdit.slotId, p)}
        onMove={(delta) => {
          if (!slotEdit || !editingSlotDay || !editingSlot) return
          const i = editingSlotDay.slots.indexOf(editingSlot)
          setSlots(slotEdit.dayId, (slots) => move(slots, i, delta))
        }}
        onSwap={() => slotEdit && setPickFor(slotEdit)}
        onDelete={() => {
          if (!slotEdit) return
          setSlots(slotEdit.dayId, (slots) => slots.filter((s) => s.id !== slotEdit.slotId))
          setSlotEdit(null)
        }}
      />

      <ExercisePicker
        open={pickFor !== null}
        onClose={() => setPickFor(null)}
        title={pickFor?.slotId ? 'Cambiar ejercicio' : 'Añadir ejercicio'}
        {...(editingSlot && pickFor?.slotId ? { suggestFor: lookup(editingSlot.exerciseId) } : {})}
        onPick={(e) => {
          if (!pickFor) return
          if (pickFor.slotId) {
            patchSlot(pickFor.dayId, pickFor.slotId, { exerciseId: e.id, restSec: e.restSec })
          } else {
            setSlots(pickFor.dayId, (slots) => [...slots, slotFor(e)])
          }
        }}
      />

      <Sheet
        open={blocker.state === 'blocked'}
        onClose={() => blocker.reset?.()}
        title="Tienes cambios sin guardar"
        description="Si sales ahora, se pierden."
        footer={
          <div className="flex flex-col gap-2">
            <Button
              block
              loading={busy}
              disabled={issues.length > 0}
              onClick={async () => {
                if (await doSave()) blocker.proceed?.()
              }}
            >
              Guardar y salir
            </Button>
            <Button block variant="danger" onClick={() => blocker.proceed?.()}>
              Salir sin guardar
            </Button>
            <Button block variant="ghost" onClick={() => blocker.reset?.()}>
              Seguir editando
            </Button>
          </div>
        }
      >
        {issues.length > 0 && (
          <p className="text-[13px] text-danger">
            Para guardar, corrige antes: {[...new Set(issues.map((i) => i.message))].join(' · ')}
          </p>
        )}
      </Sheet>

      {/* Keeps the last block clear of the floating button. */}
      <div className="h-16" aria-hidden />
    </>
  )
}

/* ───────────── Volume ───────────── */

const STATUS_TEXT = {
  low: 'Corto',
  ok: 'En rango',
  high: 'Por encima',
  over: 'Demasiado',
} as const

function VolumeSection({ rows }: { rows: VolumeRow[] }) {
  if (!rows.length) {
    return (
      <section className="mt-6">
        <SectionTitle>Volumen semanal</SectionTitle>
        <p className="text-[14px] text-muted">
          Añade ejercicios y verás aquí las series efectivas por músculo frente a su rango útil.
        </p>
      </section>
    )
  }
  const low = rows.filter((r) => r.status === 'low').length
  const high = rows.filter((r) => r.status === 'high' || r.status === 'over').length
  return (
    <section className="mt-6">
      <SectionTitle>Volumen semanal</SectionTitle>
      <p className="mb-2 px-1 text-[12.5px] text-muted">
        Series efectivas por semana si haces cada día una vez (principal 1, secundario 0,5). La
        franja es el rango útil, de MEV a MAV.
        {low > 0 || high > 0
          ? ` ${low ? `${low} ${low === 1 ? 'músculo se queda corto' : 'músculos se quedan cortos'}` : ''}${low && high ? ' y ' : ' '}${high ? `${high} ${high === 1 ? 'se pasa' : 'se pasan'}` : ''}.`
          : ' Todo en rango.'}
      </p>
      <ul className="divide-y divide-line border-y border-line">
        {rows.map((r) => {
          const max = Math.max(r.range ? (r.range.mrv ?? r.range.mav * 1.25) : 0, r.sets, 1)
          const tone =
            r.status === 'low' || r.status === 'high'
              ? 'var(--warn)'
              : r.status === 'over'
                ? 'var(--danger)'
                : 'var(--signal)'
          return (
            <li key={r.muscle} className="py-2.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[14px] font-medium">{MUSCLE_LABEL[r.muscle as Muscle]}</span>
                <span className="flex items-baseline gap-2">
                  {r.status && (
                    <span
                      className={clsx(
                        'spec',
                        r.status === 'ok'
                          ? 'text-gold'
                          : r.status === 'over'
                            ? 'text-danger'
                            : 'text-warn',
                      )}
                    >
                      {STATUS_TEXT[r.status]}
                    </span>
                  )}
                  <span className="readout text-[18px] font-semibold">
                    {formatNumber(r.sets, 1)}
                  </span>
                  <span className="text-[12px] text-muted">
                    {r.range
                      ? `/ ${formatNumber(r.range.mev)}–${formatNumber(r.range.mav)}`
                      : 'series'}
                  </span>
                </span>
              </div>
              <Meter
                value={r.sets}
                max={max}
                {...(r.range ? { band: [r.range.mev, r.range.mav] as const } : {})}
                color={tone}
                className="mt-1.5"
              />
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/* ───────────── Day sheet ───────────── */

function DaySheet({
  day,
  canDelete,
  onClose,
  onChange,
  onDelete,
}: {
  day: ProgramDay | null
  canDelete: boolean
  onClose: () => void
  onChange: (p: Partial<ProgramDay>) => void
  onDelete: () => void
}) {
  const [confirm, setConfirm] = useState(false)
  const close = () => {
    setConfirm(false)
    onClose()
  }
  return (
    <Sheet
      open={day !== null}
      onClose={close}
      title="Editar día"
      footer={
        <Button block size="lg" disabled={!day?.name.trim()} onClick={close}>
          Hecho
        </Button>
      }
    >
      {day && (
        <div className="flex flex-col gap-4">
          <Field label="Nombre" error={day.name.trim() ? undefined : 'El día necesita un nombre'}>
            {(id) => (
              <Input
                id={id}
                data-autofocus
                value={day.name}
                maxLength={40}
                invalid={!day.name.trim()}
                placeholder="Empuje, Pierna A…"
                onChange={(e) => onChange({ name: e.target.value })}
              />
            )}
          </Field>
          <Field label="Foco" hint="Qué trabaja, en una línea">
            {(id, d) => (
              <Input
                id={id}
                aria-describedby={d}
                value={day.focus}
                maxLength={60}
                placeholder="Pecho · Hombro · Tríceps"
                onChange={(e) => onChange({ focus: e.target.value })}
              />
            )}
          </Field>
          <Field
            label="Día de la semana"
            hint="Flotante: se hace el siguiente que toque, sin día fijo."
          >
            {(id, d) => (
              <Select
                id={id}
                aria-describedby={d}
                value={day.weekday ?? ''}
                onChange={(e) =>
                  onChange({ weekday: e.target.value === '' ? null : Number(e.target.value) })
                }
              >
                <option value="">Flotante</option>
                {WEEKDAY_LONG.map((w, i) => (
                  <option key={w} value={i}>
                    {w}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {canDelete && (
            <Button
              variant="danger"
              block
              leading={<Trash2 className="size-4" />}
              onClick={() => (confirm ? (setConfirm(false), onDelete()) : setConfirm(true))}
            >
              {confirm ? `Confirmar: borrar ${day.name || 'día'}` : 'Borrar día'}
            </Button>
          )}
        </div>
      )}
    </Sheet>
  )
}

/* ───────────── Slot sheet ───────────── */

function SlotSheet({
  slot,
  index,
  count,
  exerciseName,
  onClose,
  onChange,
  onMove,
  onSwap,
  onDelete,
}: {
  slot: Slot | null
  index: number
  count: number
  exerciseName: string
  onClose: () => void
  onChange: (p: Partial<Slot>) => void
  onMove: (delta: number) => void
  onSwap: () => void
  onDelete: () => void
}) {
  const errors = slot ? validateSlot(slot) : []
  const restChoices =
    slot && !REST_OPTIONS.includes(slot.restSec)
      ? [...REST_OPTIONS, slot.restSec].toSorted((a, b) => a - b)
      : REST_OPTIONS
  return (
    <Sheet
      open={slot !== null}
      onClose={onClose}
      title={exerciseName}
      {...(slot ? { description: formatPrescription(slot) } : {})}
      tall
      footer={
        <Button block size="lg" disabled={errors.length > 0} onClick={onClose}>
          Hecho
        </Button>
      }
    >
      {slot && (
        <div className="flex flex-col gap-4">
          <Button variant="secondary" block onClick={onSwap}>
            Cambiar ejercicio
          </Button>

          <div className="grid grid-cols-2 gap-x-3 gap-y-4">
            <Stepper
              label="Series"
              value={slot.sets}
              min={1}
              max={10}
              onChange={(sets) => onChange({ sets })}
            />
            <Stepper
              label="RIR"
              value={slot.rir}
              min={0}
              max={5}
              onChange={(rir) => onChange({ rir })}
            />
            <Stepper
              label="Reps mín."
              value={slot.repMin}
              min={1}
              max={50}
              invalid={slot.repMin > slot.repMax}
              onChange={(repMin) => onChange({ repMin })}
            />
            <Stepper
              label="Reps máx."
              value={slot.repMax}
              min={1}
              max={50}
              invalid={slot.repMin > slot.repMax}
              onChange={(repMax) => onChange({ repMax })}
            />
          </div>
          {errors.length > 0 && (
            <p role="alert" className="text-[13px] text-danger">
              {errors.join(' · ')}
            </p>
          )}

          <Field label="Descanso">
            {(id) => (
              <Select
                id={id}
                value={slot.restSec}
                onChange={(e) => onChange({ restSec: Number(e.target.value) })}
              >
                {restChoices.map((s) => (
                  <option key={s} value={s}>
                    {formatRest(s)}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <div>
            <div className="mb-1.5 text-[13px] font-medium text-ink-2">Superserie</div>
            <Segmented
              value={slot.superset ?? 'none'}
              onChange={(v) => onChange({ superset: v === 'none' ? undefined : v })}
              options={[
                { value: 'none', label: 'Ninguna' },
                ...SUPERSET_LETTERS.map((l) => ({ value: l as string, label: l })),
              ]}
            />
            <p className="mt-1 text-[12.5px] text-muted">
              Misma letra = se hacen seguidos, sin descanso entre ellos.
            </p>
          </div>

          <Field label="Nota">
            {(id) => (
              <Textarea
                id={id}
                value={slot.note ?? ''}
                maxLength={200}
                placeholder="Agarre, ajuste del asiento, tempo…"
                onChange={(e) => onChange({ note: e.target.value || undefined })}
              />
            )}
          </Field>

          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              disabled={index === 0}
              leading={<ArrowUp className="size-4" />}
              onClick={() => onMove(-1)}
            >
              Subir
            </Button>
            <Button
              variant="secondary"
              className="flex-1"
              disabled={index >= count - 1}
              leading={<ArrowDown className="size-4" />}
              onClick={() => onMove(1)}
            >
              Bajar
            </Button>
          </div>
          <Button variant="danger" block leading={<Trash2 className="size-4" />} onClick={onDelete}>
            Quitar ejercicio
          </Button>
        </div>
      )}
    </Sheet>
  )
}

/* ───────────── Small controls ───────────── */

function Stepper({
  label,
  value,
  min,
  max,
  invalid,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  invalid?: boolean
  onChange: (v: number) => void
}) {
  return (
    <div>
      <div className="mb-1.5 text-[13px] font-medium text-ink-2">{label}</div>
      <div
        className={clsx(
          'flex h-12 items-center justify-between rounded-[8px] border bg-panel-2',
          invalid ? 'border-danger' : 'border-line',
        )}
      >
        <button
          type="button"
          aria-label={`Menos ${label.toLowerCase()}`}
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
          className="grid h-full w-12 place-items-center text-ink-2 disabled:text-muted/50"
        >
          <Minus className="size-4" />
        </button>
        <span
          className={clsx('readout text-[22px] font-semibold', invalid && 'text-danger')}
          aria-live="polite"
        >
          {value}
        </span>
        <button
          type="button"
          aria-label={`Más ${label.toLowerCase()}`}
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
          className="grid h-full w-12 place-items-center text-ink-2 disabled:text-muted/50"
        >
          <Plus className="size-4" />
        </button>
      </div>
    </div>
  )
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-11 place-items-center rounded-full text-ink-2 active:bg-panel-2 disabled:text-muted/40"
    >
      {children}
    </button>
  )
}
