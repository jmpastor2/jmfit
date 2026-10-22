import { Archive, ChevronRight, Pencil, Plus, RotateCcw, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Meter } from '@/components/kpi/Meter'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Sheet'
import { useToast } from '@/components/ui/Toast'
import { Chip, EmptyState, SectionTitle, Skeleton } from '@/components/ui/primitives'
import { PROGRAM_TEMPLATES } from '@/content/programs'
import { useMe, useProgramActions, usePrograms } from '@/data/hooks'
import type { Program } from '@/data/rows'
import type { Goal, ProgramTemplate } from '@/domain/types'
import { useExerciseLookup } from '@/features/exercise/lookup'
import { mesoWeek } from '@/features/session/useStartWorkout'
import {
  EXPERIENCE_LABEL,
  formatDate,
  formatPrescription,
  GOAL_LABEL,
  GOAL_ORDER,
  WEEKDAY_LONG,
} from './labels'
import { programFromTemplate, todayKey } from './programModel'
import { recommendTemplate } from './recommendTemplate'

const daysLabel = (n: number) => `${n} ${n === 1 ? 'día' : 'días'}/semana`

/** Programs: the active one, the person's others, and the template catalog. */
export function ProgramsPage() {
  const me = useMe()
  const nav = useNavigate()
  const { toast } = useToast()
  const programs = usePrograms()
  const { save, activate } = useProgramActions()
  const [goal, setGoal] = useState<Goal | null>(null)
  const [preview, setPreview] = useState<ProgramTemplate | null>(null)
  const [busy, setBusy] = useState(false)
  const [showArchived, setShowArchived] = useState(false)

  const list = programs.data ?? []
  const active = list.find((p) => p.id === me.activeProgramId) ?? null
  const others = list.filter((p) => p.id !== active?.id && !p.archived)
  const archived = list.filter((p) => p.id !== active?.id && p.archived)

  const fit = useMemo(
    () =>
      recommendTemplate(PROGRAM_TEMPLATES, {
        trainingGoal: me.trainingGoal,
        experience: me.experience,
        weeklyTarget: me.weeklyTarget,
      }),
    [me.trainingGoal, me.experience, me.weeklyTarget],
  )
  const goals = useMemo(
    () =>
      GOAL_ORDER.filter(
        (g) => PROGRAM_TEMPLATES.some((t) => t.goal.includes(g)) || g === 'maintenance',
      ),
    [],
  )
  const templates = useMemo(
    () => PROGRAM_TEMPLATES.filter((t) => !goal || t.goal.includes(goal)),
    [goal],
  )

  const run = async (what: () => Promise<void>, ok: string) => {
    setBusy(true)
    try {
      await what()
      toast(ok, 'success')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo guardar', 'error')
    } finally {
      setBusy(false)
    }
  }

  const adoptTemplate = async (t: ProgramTemplate) => {
    const p = programFromTemplate(t, todayKey(), () => crypto.randomUUID())
    setBusy(true)
    try {
      await activate(p, { quiet: true })
      setPreview(null)
      toast(`${p.name} es tu programa activo`, 'success')
      nav('/train')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo activar', 'error')
    } finally {
      setBusy(false)
    }
  }

  const createBlank = async () => {
    const p: Program = {
      id: crypto.randomUUID(),
      name: 'Mi programa',
      templateId: null,
      mesoWeeks: 5,
      startedOn: todayKey(),
      days: [],
      archived: false,
    }
    setBusy(true)
    try {
      await save(p, { quiet: true })
      nav(`/programs/${p.id}`)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo crear', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader title="Programas" back="/train" />

      {/* ───── Active program ───── */}
      {programs.isPending ? (
        <Skeleton className="h-36 rounded-[10px]" />
      ) : active ? (
        <ActiveBlock program={active} onEdit={() => nav(`/programs/${active.id}`)} />
      ) : (
        <div className="card">
          <EmptyState
            title="Sin programa activo"
            description="Elige una plantilla de abajo o crea el tuyo: Forja te dirá qué toca cada día y con qué peso."
          />
        </div>
      )}

      {/* ───── Your other programs ───── */}
      {(others.length > 0 || archived.length > 0) && (
        <section className="mt-6">
          <SectionTitle>Tus programas</SectionTitle>
          <ul className="divide-y divide-line border-y border-line">
            {others.map((p) => (
              <li key={p.id} className="py-3">
                <ProgramLine program={p} />
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="soft"
                    disabled={busy}
                    onClick={() =>
                      run(
                        () => activate({ ...p, startedOn: todayKey() }, { quiet: true }),
                        `${p.name} activado`,
                      )
                    }
                  >
                    Activar
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    leading={<Pencil className="size-4" />}
                    onClick={() => nav(`/programs/${p.id}`)}
                  >
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    leading={<Archive className="size-4" />}
                    onClick={() =>
                      run(
                        () => save({ ...p, archived: true }, { quiet: true }),
                        'Programa archivado',
                      )
                    }
                  >
                    Archivar
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          {archived.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setShowArchived((v) => !v)}
                className="mt-2 flex min-h-11 w-full items-center justify-between text-[14px] text-muted"
                aria-expanded={showArchived}
              >
                <span>Archivados ({archived.length})</span>
                <ChevronRight className={showArchived ? 'size-4 rotate-90' : 'size-4'} />
              </button>
              {showArchived && (
                <ul className="divide-y divide-line border-b border-line">
                  {archived.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                      <ProgramLine program={p} muted />
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        leading={<RotateCcw className="size-4" />}
                        onClick={() =>
                          run(
                            () => save({ ...p, archived: false }, { quiet: true }),
                            'Programa recuperado',
                          )
                        }
                      >
                        Recuperar
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
      )}

      <div className="mt-3">
        <Button
          variant="secondary"
          block
          disabled={busy}
          leading={<Plus className="size-4" />}
          onClick={createBlank}
        >
          Crear programa desde cero
        </Button>
      </div>

      {/* ───── Templates ───── */}
      <section className="mt-8">
        <SectionTitle>Plantillas</SectionTitle>

        {fit && (
          <button
            type="button"
            onClick={() => setPreview(fit.template)}
            className="card mb-4 block w-full border-signal/30 p-4 text-left active:bg-panel-2"
          >
            <span className="spec flex items-center gap-1.5 text-gold">
              <Sparkles className="size-3.5" aria-hidden /> Recomendada para ti
            </span>
            <span className="mt-1 block font-display text-[22px] font-semibold uppercase leading-tight tracking-[0.04em]">
              {fit.template.name}
            </span>
            <span className="mt-1 block text-[13.5px] text-ink-2">{fit.reason}</span>
            <TemplateMeta template={fit.template} />
          </button>
        )}

        <div className="hide-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4">
          <Chip active={goal === null} onClick={() => setGoal(null)}>
            Todas
          </Chip>
          {goals.map((g) => (
            <Chip key={g} active={goal === g} onClick={() => setGoal(goal === g ? null : g)}>
              {GOAL_LABEL[g]}
            </Chip>
          ))}
        </div>

        {templates.length ? (
          <ul className="mt-2 divide-y divide-line border-y border-line">
            {templates.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => setPreview(t)}
                  className="flex w-full items-start justify-between gap-3 py-3.5 text-left active:bg-panel-2"
                >
                  <span className="min-w-0">
                    <span className="block text-[16px] font-semibold">{t.name}</span>
                    <span className="mt-0.5 line-clamp-2 block text-[13px] text-muted">
                      {t.description}
                    </span>
                    <TemplateMeta template={t} />
                  </span>
                  <ChevronRight className="mt-1 size-4 shrink-0 text-muted" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-8 text-center text-[14px] text-muted">
            No hay plantillas para {goal ? GOAL_LABEL[goal].toLowerCase() : 'este filtro'}. Prueba
            con otro objetivo o crea tu programa desde cero.
          </p>
        )}
      </section>

      <TemplatePreview
        template={preview}
        busy={busy}
        onClose={() => setPreview(null)}
        onUse={adoptTemplate}
      />
    </>
  )
}

function ActiveBlock({ program, onEdit }: { program: Program; onEdit: () => void }) {
  const today = todayKey()
  const future = program.startedOn > today
  const { week, deload } = mesoWeek(program)
  const total = program.mesoWeeks + 1
  return (
    <section className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="spec text-gold">Programa activo</div>
          <h2 className="mt-1 break-words font-display text-[24px] font-semibold uppercase leading-tight tracking-[0.04em]">
            {program.name}
          </h2>
          <p className="mt-0.5 text-[13px] text-muted">
            {daysLabel(program.days.length)} · desde {formatDate(program.startedOn)}
          </p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          leading={<Pencil className="size-4" />}
          onClick={onEdit}
        >
          Editar
        </Button>
      </div>
      <div className="mt-4">
        {future ? (
          <p className="text-[14px] text-ink-2">Empieza el {formatDate(program.startedOn)}.</p>
        ) : (
          <>
            <div className="flex items-baseline gap-2">
              <span className="readout text-[30px] font-semibold leading-none">
                {deload ? 'Descarga' : `Semana ${week}`}
              </span>
              {!deload && <span className="text-[13px] text-muted">de {program.mesoWeeks}</span>}
            </div>
            <Meter value={week} max={total} className="mt-2" />
            <p className="mt-1.5 text-[12.5px] text-muted">
              {deload
                ? 'Semana de descarga: menos series y peso para llegar fresco al siguiente bloque.'
                : `Descarga en la semana ${total} del mesociclo.`}
            </p>
          </>
        )}
      </div>
    </section>
  )
}

function ProgramLine({ program, muted }: { program: Program; muted?: boolean }) {
  return (
    <div className="min-w-0">
      <div className={muted ? 'text-[15px] font-medium text-ink-2' : 'text-[16px] font-semibold'}>
        {program.name}
      </div>
      <div className="text-[13px] text-muted">
        {daysLabel(program.days.length)} · mesociclo de {program.mesoWeeks} semanas
      </div>
    </div>
  )
}

function TemplateMeta({ template }: { template: ProgramTemplate }) {
  return (
    <span className="spec mt-2 block text-ink-2">
      {daysLabel(template.daysPerWeek)} ·{' '}
      {template.level.map((l) => EXPERIENCE_LABEL[l]).join(' / ')} ·{' '}
      {template.goal.map((g) => GOAL_LABEL[g]).join(' / ')}
    </span>
  )
}

function TemplatePreview({
  template,
  busy,
  onClose,
  onUse,
}: {
  template: ProgramTemplate | null
  busy: boolean
  onClose: () => void
  onUse: (t: ProgramTemplate) => void
}) {
  const lookup = useExerciseLookup()
  return (
    <Sheet
      open={template !== null}
      onClose={onClose}
      title={template?.name}
      description={
        template
          ? `${daysLabel(template.daysPerWeek)} · mesociclo de ${template.mesoWeeks} semanas + descarga`
          : undefined
      }
      tall
      footer={
        template && (
          <Button block size="lg" loading={busy} onClick={() => onUse(template)}>
            Usar este programa
          </Button>
        )
      }
    >
      {template && (
        <>
          <p className="text-[14px] leading-relaxed text-ink-2">{template.description}</p>
          <TemplateMeta template={template} />
          {template.days.map((d) => (
            <section key={d.id} className="mt-5">
              <div className="flex items-baseline justify-between gap-3 border-b border-line pb-1.5">
                <h3 className="font-display text-[18px] font-semibold uppercase tracking-[0.05em]">
                  {d.name}
                </h3>
                <span className="spec shrink-0">
                  {d.weekday === null ? 'Flotante' : WEEKDAY_LONG[d.weekday]}
                </span>
              </div>
              {d.focus && <p className="mt-1 text-[12.5px] text-muted">{d.focus}</p>}
              <ol className="mt-1 divide-y divide-line">
                {d.slots.map((s) => (
                  <li key={s.id} className="flex items-baseline justify-between gap-3 py-2">
                    <span className="min-w-0 text-[14.5px]">
                      {s.superset && <span className="spec mr-1.5 text-gold">{s.superset}</span>}
                      {lookup(s.exerciseId).name}
                    </span>
                    <span className="readout shrink-0 text-[15px] text-ink-2">
                      {formatPrescription(s)}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </>
      )}
    </Sheet>
  )
}
