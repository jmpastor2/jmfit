import { clsx } from 'clsx'
import { useState, type ReactNode } from 'react'
import { LineChart } from '@/components/charts/LineChart'
import { CountUp } from '@/components/kpi/CountUp'
import { Kpi } from '@/components/kpi/Kpi'
import { Meter } from '@/components/kpi/Meter'
import { Chip } from '@/components/ui/primitives'
import { formatNumber, STRAIN_MAX, strainTarget } from '@/domain/training'
import { BAND_COLOR, BAND_LABEL, BAND_TEXT, hm, lastNight, shortDay, stateAdvice } from './format'
import { useHealthDays, useMe, useWorkouts } from '@/data/hooks'
import { localDateKey, sleepNeedMin } from '@/domain/training'
import { useOtherActivities } from '@/features/train/useActivities'
import { RecoveryStrainChart } from './RecoveryStrainChart'
import { FitnessSection, JournalSection, ZonesBar } from './StateExtras'
import { bedtimeTonight, clockText, saveWakeAt, savedWakeAt, sleepHabits } from './sleep'
import { weekReport, type WeekNumbers } from './week'
import { recentMean, recoveryBand, type DayState } from './state'
import { useDayStates } from './useDayStates'

/**
 * «Estado», the band's side of the app (Cuerpo tab): recovery says how ready the body is,
 * strain how much it was asked today, sleep how much of what it needed it got; then the week,
 * fitness markers, four weeks of history and the habits journal. Renders nothing without band
 * data (Cuerpo then shows the check-in recovery).
 */
export function StateView() {
  const states = useDayStates(28)
  return states ? <State states={states} /> : null
}

function State({ states }: { states: DayState[] }) {
  const today = states.at(-1)!
  const night = lastNight(states)
  const band = recoveryBand(today.recovery)
  const target = strainTarget(today.recovery)
  const last14 = states.slice(-14)
  const before = states.slice(0, -1)
  const hrv7 = recentMean(before, (s) => s.hrv, 7, 1)
  const rhr7 = recentMean(before, (s) => s.restingHr, 7)
  const strain7 = recentMean(before, (s) => s.strain, 7, 1)
  const week = weekNumbers(states)
  const me = useMe()
  const workouts = useWorkouts().data
  const sports = useOtherActivities()
  const health = useHealthDays().data
  const habits = sleepHabits(states)
  const [wakeAt, setWakeAt] = useState(savedWakeAt)
  const bed = bedtimeTonight(states, sleepNeedMin(today.strain), wakeAt)
  const chooseWake = (m: number | null) => {
    setWakeAt(m)
    saveWakeAt(m)
  }
  const proteinTarget = me.targetProtein
  const report = weekReport({
    states,
    gymDates: (workouts ?? [])
      .filter((w) => w.endedAt)
      .map((w) => localDateKey(new Date(w.startedAt))),
    sportDates: sports.map((a) => localDateKey(new Date(a.startedAt))),
    food: (health ?? []).map((d) => ({ date: d.date, kcal: d.kcalIn, protein: d.proteinG })),
    proteinTarget,
  })
  const hrvPoints = states.flatMap((s) => (s.hrv != null ? [{ x: s.date, y: s.hrv }] : []))
  const rhrPoints = states.flatMap((s) =>
    s.restingHr != null ? [{ x: s.date, y: s.restingHr }] : [],
  )

  return (
    <>
      {/* The three numbers of the day. */}
      <section className="border-b border-line pb-5">
        <div className="grid grid-cols-3 gap-3">
          <Hero
            label="Recuperación"
            value={today.recovery}
            unit="%"
            className={band ? BAND_TEXT[band] : 'text-muted'}
            note={band ? BAND_LABEL[band] : 'sin datos'}
          />
          <Hero
            label="Carga"
            value={today.strain}
            digits={1}
            unit={`/${STRAIN_MAX}`}
            note={target ? `obj. ${target.min}–${target.max}` : 'hoy'}
          />
          <Hero
            label="Sueño"
            value={night?.sleepScore ?? null}
            unit="%"
            className={night?.partialNight ? 'text-muted' : undefined}
            note={night?.sleepMin != null ? `${hm(night.sleepMin)} h` : 'sin datos'}
          />
        </div>
        {/* Recovery as a gauge with its three bands. */}
        <div className="mt-4">
          <Meter
            value={today.recovery ?? 0}
            max={100}
            band={[33, 67]}
            color={band ? BAND_COLOR[band] : 'var(--panel-3)'}
            height={8}
            label={`Recuperación ${today.recovery ?? 'sin datos'} %`}
          />
          <div className="mt-1 flex justify-between text-[11px] text-muted" aria-hidden>
            <span>Baja</span>
            <span>Media</span>
            <span>Alta</span>
          </div>
        </div>
        <p className="mt-4 text-[14.5px] leading-snug">{stateAdvice(today, target)}</p>
      </section>

      {report && <WeekSection now={report.now} before={report.before} tips={report.tips} />}

      <FitnessSection states={states} />

      <Section
        title="Cuatro semanas"
        caption="Cada barra es la carga de un día; la línea, cómo amaneciste recuperado."
      >
        <RecoveryStrainChart states={states} />
        <div className="mt-4 grid grid-cols-4 gap-2 border-t border-line pt-4">
          <Kpi
            size="sm"
            label="Recup."
            value={week.recovery ?? '—'}
            unit={week.recovery != null ? '%' : undefined}
          />
          <Kpi
            size="sm"
            label="Carga"
            value={week.strain != null ? formatNumber(week.strain, 1) : '—'}
          />
          <Kpi
            size="sm"
            label="Sueño"
            value={week.sleep != null ? hm(week.sleep) : '—'}
            unit={week.sleep != null ? 'h' : undefined}
          />
          <Kpi
            size="sm"
            label="Pasos"
            value={week.steps != null ? `${formatNumber(week.steps / 1000, 1)}k` : '—'}
          />
        </div>
        <p className="mt-2 text-[12px] text-muted">Medias de los últimos 7 días.</p>
      </Section>

      <Section
        title="Recuperación"
        caption="VFC, pulso en reposo y sueño frente a tus últimas semanas."
      >
        {today.recoveryFactors.length > 0 && (
          <ul className="mb-3 flex flex-col gap-1 text-[13.5px] text-ink-2">
            {today.recoveryFactors.map((f) => (
              <li key={f}>· {f}</li>
            ))}
          </ul>
        )}
        <div className="mb-4 grid grid-cols-2 gap-4">
          <Kpi
            size="sm"
            label="VFC (HRV)"
            value={today.hrv != null ? formatNumber(today.hrv, 1) : '—'}
            unit="ms"
            caption={hrv7 != null ? `Media 7 días: ${formatNumber(hrv7, 1)} ms` : undefined}
          />
          <Kpi
            size="sm"
            label="Pulso en reposo"
            value={today.restingHr ?? '—'}
            unit="ppm"
            caption={rhr7 != null ? `Media 7 días: ${rhr7} ppm` : undefined}
          />
        </div>
        {hrvPoints.length >= 3 && (
          <div className="mb-4">
            <span className="spec mb-1 block">VFC · 4 semanas (más alta, mejor)</span>
            <LineChart
              points={hrvPoints}
              height={120}
              unit="ms"
              formatX={shortDay}
              label="Variabilidad de la frecuencia cardiaca en las últimas cuatro semanas"
            />
          </div>
        )}
        {rhrPoints.length >= 3 && (
          <div>
            <span className="spec mb-1 block">Pulso en reposo · 4 semanas (más bajo, mejor)</span>
            <LineChart
              points={rhrPoints}
              height={120}
              unit="ppm"
              color="var(--ink-2)"
              format={(n) => String(Math.round(n))}
              formatX={shortDay}
              label="Pulso en reposo en las últimas cuatro semanas"
            />
          </div>
        )}
      </Section>

      <Section
        title="Carga"
        caption="Esfuerzo del día de 0 a 21: sesiones por su pulso, series efectivas de Forja y pasos."
      >
        {target && (
          <div className="mb-3">
            <div className="mb-1 flex items-baseline justify-between text-[13px]">
              <span className="text-ink-2">
                Objetivo hoy: {target.min}–{target.max}
              </span>
              <span className="text-muted">llevas {formatNumber(today.strain, 1)}</span>
            </div>
            <Meter
              value={today.strain}
              max={STRAIN_MAX}
              band={[target.min, target.max]}
              color="var(--gold)"
              label={`Carga ${formatNumber(today.strain, 1)} de ${STRAIN_MAX}, objetivo ${target.min} a ${target.max}`}
            />
          </div>
        )}
        <ZonesBar zones={today.zones} title="Pulso por zonas · hoy" />
        {today.strainParts.length > 0 ? (
          <ul className="mb-4 divide-y divide-line">
            {today.strainParts.map((p) => (
              <li
                key={p.label}
                className="flex min-h-10 items-center justify-between gap-3 py-1.5 text-[13.5px]"
              >
                <span>{p.label}</span>
                <span className="readout text-[15px] font-semibold text-ink-2">
                  {Math.round(p.load)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-4 text-[13px] text-muted">Hoy aún no hay actividad registrada.</p>
        )}
        <Bars
          states={last14}
          value={(s) => s.strain}
          max={STRAIN_MAX}
          color={() => 'var(--gold)'}
          label={(s) => formatNumber(s.strain, 1)}
        />
        {strain7 != null && (
          <p className="mt-2 text-[12.5px] text-muted">
            Media de los últimos 7 días: {formatNumber(strain7, 1)}
          </p>
        )}
      </Section>

      <Section
        title="Sueño"
        caption="Horas dormidas frente a las que necesitabas (más tras un día de carga alta)."
      >
        {night?.sleepMin != null ? (
          <>
            <div className="mb-3 grid grid-cols-2 gap-4">
              <Kpi size="sm" label="Dormiste" value={hm(night.sleepMin)} unit="h" />
              <Kpi size="sm" label="Necesitabas" value={hm(night.sleepNeedMin)} unit="h" />
            </div>
            {night.deepMin != null && night.remMin != null && (
              <Stages deep={night.deepMin} rem={night.remMin} total={night.sleepMin} />
            )}
            {night.partialNight && (
              <p className="mb-3 border-l-2 border-warn pl-3 text-[13px] leading-snug">
                Solo {hm(night.sleepMin)} h registradas. Si dormiste más, la pulsera no registró
                toda la noche: llévala al dormir para que la recuperación sea fiable.
              </p>
            )}
          </>
        ) : (
          <p className="mb-3 text-[13px] text-muted">Aún no hay noches registradas.</p>
        )}
        {bed && (
          <div className="mb-4 rounded-[8px] border border-gold/40 bg-signal-soft p-3">
            <span className="spec block text-gold">Esta noche</span>
            <span className="readout mt-1 block text-[32px] font-semibold leading-none">
              {clockText(bed.bed)}
            </span>
            <span className="mt-1.5 block text-[13px] leading-snug text-ink-2">
              A la cama para dormir {hm(bed.needMin)} h y levantarte a las {clockText(bed.wake)}
              {wakeAt == null ? ' (tu hora habitual)' : ''}
              {bed.debtMin > 0 ? `, recuperando parte de las ${hm(bed.debtMin)} h que debes` : ''}.
            </span>
            <div
              className="mt-3 flex flex-wrap items-center gap-1.5"
              role="group"
              aria-label="Mañana me levanto a las"
            >
              <span className="mr-1 text-[12px] text-muted">Me levanto a las</span>
              <Chip active={wakeAt == null} onClick={() => chooseWake(null)}>
                {habits ? `Habitual ${clockText(habits.wake)}` : 'Habitual'}
              </Chip>
              {[6, 7, 8, 9].map((h) => (
                <Chip key={h} active={wakeAt === h * 60} onClick={() => chooseWake(h * 60)}>
                  {h}:00
                </Chip>
              ))}
            </div>
          </div>
        )}
        {habits && (
          <div className="mb-4 grid grid-cols-2 gap-4">
            <Kpi
              size="sm"
              label="Regularidad"
              value={
                <span className={habits.consistency < 50 ? 'text-warn' : undefined}>
                  {habits.consistency}
                </span>
              }
              unit="%"
              caption={`Horario ±${hm(habits.spreadMin)} h de una noche a otra`}
            />
            <Kpi
              size="sm"
              label="Horario habitual"
              value={`${clockText(habits.bed)}–${clockText(habits.wake)}`}
              caption={`${habits.nights} noches completas`}
            />
          </div>
        )}
        <Bars
          states={last14}
          value={(s) => s.sleepMin}
          max={600}
          color={(s) => (s.partialNight ? 'var(--panel-3)' : 'var(--ink-2)')}
          label={(s) => (s.sleepMin != null ? `${hm(s.sleepMin)} h` : 'sin datos')}
          guide={450}
        />
        <p className="mt-2 text-[12.5px] text-muted">
          La línea marca 7:30 h. En gris, noches registradas a medias.
        </p>
      </Section>

      <JournalSection states={states} />

      <p className="py-5 text-[12px] leading-snug text-muted">
        Cálculo propio de Forja con los datos de Google Health, inspirado en WHOOP: la carga usa los
        minutos en cada zona de pulso (o el TRIMP de Banister sin zonas); la recuperación compara
        VFC, pulso en reposo y sueño con tus 4 últimas semanas. Orientativo, no es un dato médico.
      </p>
    </>
  )
}

/** Seven-day averages of the summary row (today included while it has data). */
function weekNumbers(states: readonly DayState[]) {
  const last = states.slice(-7)
  return {
    recovery: recentMean(last, (s) => s.recovery, 7),
    strain: recentMean(last, (s) => s.strain, 7, 1),
    sleep: recentMean(last, (s) => (s.partialNight ? null : s.sleepMin), 7),
    steps: recentMean(last, (s) => s.steps, 7),
  }
}

function Hero({
  label,
  value,
  unit,
  note,
  digits = 0,
  className,
}: {
  label: string
  value: number | null
  unit: string
  note: string
  digits?: number
  className?: string | undefined
}) {
  const f = 10 ** digits
  return (
    <div className="min-w-0">
      <span className="spec block">{label}</span>
      <span className={clsx('readout block text-[40px] font-semibold leading-none', className)}>
        {value == null ? (
          '—'
        ) : (
          <CountUp value={Math.round(value * f)} format={(n) => formatNumber(n / f, digits)} />
        )}
        {value != null && (
          <span className="ml-0.5 font-sans text-[12px] font-medium text-muted">{unit}</span>
        )}
      </span>
      <span className="mt-1 block text-[12px] text-muted">{note}</span>
    </div>
  )
}

function Section({
  title,
  caption,
  children,
}: {
  title: string
  caption: string
  children: ReactNode
}) {
  return (
    <section className="border-b border-line py-5">
      <h2 className="spec mb-1 text-gold">{title}</h2>
      <p className="mb-3 text-[12.5px] text-muted">{caption}</p>
      {children}
    </section>
  )
}

/** One bar per day, today last and outlined; each bar's value is in its label. */
function Bars({
  states,
  value,
  max,
  color,
  label,
  guide,
}: {
  states: readonly DayState[]
  value: (s: DayState) => number | null
  max: number
  color: (s: DayState) => string
  label: (s: DayState) => string
  guide?: number
}) {
  return (
    <div>
      <div className="relative flex h-20 items-end gap-[3px]" role="list">
        {states.map((s, i) => {
          const v = value(s)
          return (
            <div
              key={s.date}
              role="listitem"
              aria-label={`${shortDay(s.date)}: ${label(s)}`}
              className={clsx(
                'bar-grow flex-1 rounded-t-[2px]',
                i === states.length - 1 && 'outline outline-1 outline-gold/60',
              )}
              style={{
                height: `${v == null ? 3 : Math.max(3, Math.min(100, (v / max) * 100))}%`,
                background: v == null ? 'var(--panel-2)' : color(s),
              }}
            />
          )
        })}
        {guide != null && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 border-t border-dashed border-gold/50"
            style={{ bottom: `${(guide / max) * 100}%` }}
          />
        )}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-muted" aria-hidden>
        <span>hace 2 semanas</span>
        <span>hoy</span>
      </div>
    </div>
  )
}

function Stages({ deep, rem, total }: { deep: number; rem: number; total: number }) {
  const light = Math.max(0, total - deep - rem)
  const pct = (x: number) => `${(x / total) * 100}%`
  return (
    <div className="mb-3">
      <div className="flex h-2.5 overflow-hidden rounded-full" aria-hidden>
        <span style={{ width: pct(deep), background: 'var(--gold)' }} />
        <span style={{ width: pct(rem), background: 'var(--gold-light)' }} />
        <span style={{ width: pct(light), background: 'var(--panel-3)' }} />
      </div>
      <p className="mt-1.5 text-[12.5px] text-ink-2">
        Profundo {hm(deep)} · REM {hm(rem)} · ligero {hm(light)}
      </p>
    </div>
  )
}

/** Last seven days against the seven before, and what would help most. */
function WeekSection({
  now,
  before,
  tips,
}: {
  now: WeekNumbers
  before: WeekNumbers | null
  tips: string[]
}) {
  const rows: { label: string; now: string; before: string | null; better: boolean | null }[] = [
    row('Recuperación', now.recovery, before?.recovery, (v) => `${v} %`, true),
    row('Carga media', now.strain, before?.strain, (v) => formatNumber(v, 1), null),
    row('Sueño (noches completas)', now.sleep, before?.sleep, (v) => `${hm(v)} h`, true),
    row('Regularidad del sueño', now.consistency, before?.consistency, (v) => `${v} %`, true),
    row('Pasos al día', now.steps, before?.steps, (v) => formatNumber(v), true),
    row('Sesiones de fuerza', now.gym, before?.gym, String, true),
    row('Deporte (pulsera)', now.sports, before?.sports, String, null),
    row('Proteína al día', now.protein, before?.protein, (v) => `${v} g`, true),
  ].filter((r) => r.now !== '—' || r.before != null)
  return (
    <Section title="Tu semana" caption="Los últimos 7 días frente a los 7 anteriores.">
      <ul className="divide-y divide-line">
        {rows.map((r) => (
          <li key={r.label} className="flex min-h-10 items-center justify-between gap-3 py-1.5">
            <span className="text-[13.5px]">{r.label}</span>
            <span className="flex items-baseline gap-2">
              {r.before != null && <span className="text-[12px] text-muted">{r.before} →</span>}
              <span
                className={clsx(
                  'readout text-[16px] font-semibold',
                  r.better === true ? 'text-gold' : r.better === false ? 'text-warn' : 'text-ink',
                )}
              >
                {r.now}
              </span>
            </span>
          </li>
        ))}
      </ul>
      {tips.length > 0 && (
        <ol className="mt-4 flex flex-col gap-2">
          {tips.map((t, i) => (
            <li key={t} className="flex gap-3 text-[14px] leading-snug">
              <span className="readout w-4 shrink-0 text-[17px] text-gold">{i + 1}</span>
              <span>{t}</span>
            </li>
          ))}
        </ol>
      )}
    </Section>
  )
}

/** A report row: the figure now, the one before, and whether it moved the good way. */
function row(
  label: string,
  now: number | null,
  before: number | null | undefined,
  fmt: (v: number) => string,
  higherIsBetter: boolean | null,
) {
  const moved = now != null && before != null && now !== before
  return {
    label,
    now: now == null ? '—' : fmt(now),
    before: before == null ? null : fmt(before),
    better: !moved || higherIsBetter == null ? null : now! > before! === higherIsBetter,
  }
}
