import { clsx } from 'clsx'
import { Kpi } from '@/components/kpi/Kpi'
import { Meter } from '@/components/kpi/Meter'
import { Chip } from '@/components/ui/primitives'
import { queued, useJournal, useMe, useSaveJournal } from '@/data/hooks'
import { addLocalDays, formatNumber, localDateKey } from '@/domain/training'
import type { ZoneMinutes } from '@/domain/types'
import { useNow } from '@/lib/useNow'
import { WHO_ACTIVE_MIN, loadBalance, vo2Level, weekActiveMinutes } from './fitness'
import { JOURNAL_TAGS, MIN_DAYS, journalImpact } from './journal'
import type { DayState } from './state'

const ZONES = [
  { key: 'light', label: 'Ligera', color: 'var(--panel-3)' },
  { key: 'moderate', label: 'Moderada', color: 'var(--gold-dark)' },
  { key: 'vigorous', label: 'Intensa', color: 'var(--gold)' },
  { key: 'peak', label: 'Máxima', color: 'var(--gold-light)' },
] as const

/** Minutes in each heart rate zone as one stacked bar, light to peak. */
export function ZonesBar({ zones, title }: { zones: ZoneMinutes | null; title: string }) {
  const total = ZONES.reduce((a, z) => a + (zones?.[z.key] ?? 0), 0)
  if (!zones || !total) return null
  return (
    <div className="mb-4">
      <span className="spec mb-1.5 block">{title}</span>
      <div className="flex h-3 overflow-hidden rounded-full" aria-hidden>
        {ZONES.map((z) =>
          zones[z.key] ? (
            <span
              key={z.key}
              className="bar-grow"
              style={{
                width: `${((zones[z.key] ?? 0) / total) * 100}%`,
                background: z.color,
                transformOrigin: 'left',
              }}
            />
          ) : null,
        )}
      </div>
      <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] text-ink-2">
        {ZONES.filter((z) => zones[z.key]).map((z) => (
          <span key={z.key} className="flex items-center gap-1">
            <span className="size-2 rounded-full" style={{ background: z.color }} />
            {z.label} {zones[z.key]} min
          </span>
        ))}
      </p>
    </div>
  )
}

const BALANCE_TEXT = {
  low: 'Por debajo de lo habitual: la forma se pierde si dura semanas.',
  optimal: 'En la franja buena: subes forma con el menor riesgo de lesión.',
  high: 'Subiendo rápido: vigila el sueño y no encadenes días duros.',
  danger: 'Mucho más que tu costumbre: riesgo de sobrecarga, baja una semana.',
} as const

/** Fitness markers with outside references: WHO minutes, load balance, VO₂ max level. */
export function FitnessSection({ states }: { states: DayState[] }) {
  const me = useMe()
  const now = useNow()
  const active = weekActiveMinutes(states)
  const balance = loadBalance(states)
  const vo2 = states.toReversed().find((s) => s.vo2max != null)?.vo2max ?? null
  const age = me.birthDate
    ? Math.floor((now.getTime() - Date.parse(me.birthDate)) / (365.25 * 86_400_000))
    : null
  const level =
    vo2 != null && age != null && (me.sex === 'M' || me.sex === 'F')
      ? vo2Level(vo2, age, me.sex)
      : null
  if (active == null && !balance && vo2 == null) return null
  return (
    <section className="border-b border-line py-5">
      <h2 className="spec mb-1 text-gold">Forma</h2>
      <p className="mb-4 text-[12.5px] text-muted">
        Tres marcadores con referencias externas: la OMS, la ciencia del deporte y el ACSM.
      </p>
      <div className="flex flex-col gap-5">
        {active != null && (
          <Kpi
            label="Minutos activos · 7 días"
            value={active}
            unit={`/ ${WHO_ACTIVE_MIN}`}
            tone={active >= WHO_ACTIVE_MIN ? 'signal' : 'default'}
            caption="Moderados, más el doble de los intensos (equivalencia de la OMS). Mínimo recomendado: 150."
          >
            <Meter
              value={active}
              max={Math.max(WHO_ACTIVE_MIN * 2, active)}
              target={WHO_ACTIVE_MIN}
              label={`${active} de ${WHO_ACTIVE_MIN} minutos activos`}
            />
          </Kpi>
        )}
        {balance && (
          <Kpi
            label="Equilibrio de carga"
            value={formatNumber(balance.ratio, 2)}
            tone={
              balance.zone === 'optimal' ? 'signal' : balance.zone === 'low' ? 'default' : 'warn'
            }
            caption={`Carga de 7 días frente a la de 28. ${BALANCE_TEXT[balance.zone]}`}
          >
            <Meter
              value={Math.min(balance.ratio, 2)}
              max={2}
              band={[0.8, 1.3]}
              color={balance.zone === 'optimal' ? 'var(--gold)' : 'var(--warn)'}
              label={`Equilibrio de carga ${formatNumber(balance.ratio, 2)}, franja buena de 0,8 a 1,3`}
            />
          </Kpi>
        )}
        {vo2 != null && (
          <Kpi
            label="VO₂ máx"
            value={formatNumber(vo2, 1)}
            unit="ml/kg/min"
            caption={
              level
                ? `${level.level} para tu edad${level.next ? `; ${formatNumber(level.next, 0)} para subir de nivel` : ''}. Estimación de la pulsera.`
                : 'Estimación de la pulsera.'
            }
          />
        )}
      </div>
    </section>
  )
}

/**
 * The habits journal: mark what yesterday had, and, with enough days, how each habit moved the
 * next morning's recovery.
 */
export function JournalSection({ states }: { states: DayState[] }) {
  const now = useNow()
  const journal = useJournal().data
  const save = useSaveJournal()
  const yesterday = localDateKey(addLocalDays(now, -1))
  const tags = journal?.find((d) => d.date === yesterday)?.tags ?? []
  const toggle = (id: string) =>
    queued(
      save({
        date: yesterday,
        tags: tags.includes(id) ? tags.filter((t) => t !== id) : [...tags, id],
      }),
    )
  const impact = journalImpact(journal ?? [], states)
  const known = impact.filter((t) => t.diff != null)
  const days = journal?.length ?? 0
  return (
    <section className="border-b border-line py-5">
      <h2 className="spec mb-1 text-gold">Diario</h2>
      <p className="mb-3 text-[12.5px] text-muted">
        Marca lo que tuvo el día de ayer. Con unos días, Forja te dice qué te sube o te baja la
        recuperación.
      </p>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Ayer hubo">
        {JOURNAL_TAGS.map((t) => (
          <Chip key={t.id} active={tags.includes(t.id)} onClick={() => toggle(t.id)}>
            {t.label}
          </Chip>
        ))}
      </div>
      {known.length > 0 ? (
        <ul className="mt-4 divide-y divide-line">
          {known.map((t) => (
            <li key={t.tag} className="flex min-h-10 items-center justify-between gap-3 py-1.5">
              <span className="text-[13.5px]">{t.label}</span>
              <span
                className={clsx(
                  'readout text-[16px] font-semibold',
                  t.diff! > 0 ? 'text-gold' : t.diff! < 0 ? 'text-warn' : 'text-ink-2',
                )}
              >
                {t.diff! > 0 ? '+' : ''}
                {t.diff} %
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-[12.5px] text-muted">
          {days} {days === 1 ? 'día anotado' : 'días anotados'}: hacen falta al menos {MIN_DAYS}{' '}
          días con un hábito y {MIN_DAYS} sin él para medir su efecto.
        </p>
      )}
      {known.length > 0 && (
        <p className="mt-2 text-[12px] text-muted">
          Recuperación de la mañana siguiente con el hábito frente a sin él.
        </p>
      )}
    </section>
  )
}
