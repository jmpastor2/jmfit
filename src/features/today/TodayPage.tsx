import { clsx } from 'clsx'
import { ChevronRight, Play, Trophy } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Delta, Kpi } from '@/components/kpi/Kpi'
import { Meter } from '@/components/kpi/Meter'
import { Ticks } from '@/components/kpi/Ticks'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Badge, Skeleton } from '@/components/ui/primitives'
import {
  useActiveProgram,
  useActiveWorkout,
  useGoals,
  useMe,
  useScans,
  useSets,
  useWorkouts,
} from '@/data/hooks'
import type { Program, WorkoutFull } from '@/data/rows'
import { formatNumber, goalProgress } from '@/domain/training'
import type { Exercise, ProgramDay, ReadinessLevel, Scan } from '@/domain/types'
import { useExerciseLookup } from '@/features/exercise/lookup'
import { dayForDate, mesoWeek, useStartWorkout } from '@/features/session/useStartWorkout'
import { DayPickerSheet } from '@/features/train/DayPickerSheet'
import {
  PR_LABEL,
  estimateMinutes,
  formatInt,
  formatLongDate,
  formatShortDate,
  prValue,
  prescription,
  signed,
  workoutMinutes,
} from '@/features/train/history'
import { useNow } from '@/lib/useNow'
import { dailyWeights, weightEntries, weightSourceLabel } from '@/features/body/weight'
import { CheckinSheet } from './CheckinSheet'
import {
  SCAN_STALE_DAYS,
  agoLabel,
  doneDayIdsThisWeek,
  finishedToday,
  goalCurrent,
  goalTitle,
  goalUnit,
  greeting,
  recentRecords,
  scanStatus,
  weekSummary,
} from './today'
import { useReadiness } from './useReadiness'
import { WeekWarnings } from './WeekWarnings'

export function TodayPage() {
  const me = useMe()
  const now = useNow()
  const { program } = useActiveProgram()
  const meso = program ? mesoWeek(program, now) : null
  const name = me.displayName.trim()

  return (
    <>
      <PageHeader
        large
        eyebrow={formatLongDate(now)}
        title={name ? `${greeting(now)}, ${name}` : greeting(now)}
        subtitle={
          program && meso
            ? `${program.name} · ${meso.deload ? 'Semana de descarga' : `Semana ${meso.week} de ${program.mesoWeeks}`}`
            : undefined
        }
      />
      <TodayWorkout program={program} now={now} />
      <ReadinessBlock />
      <WeekBlock now={now} weeklyTarget={me.weeklyTarget} program={program} />
      <RecordsBlock now={now} />
      <BodyBlock now={now} />
      <GoalsBlock now={now} />
    </>
  )
}

/* ───────────── Shared bits ───────────── */

function Block({
  title,
  link,
  children,
}: {
  title: string
  link?: { to: string; label: string }
  children: ReactNode
}) {
  return (
    <section className="border-t border-line py-5">
      <div className="mb-3 flex min-h-11 items-center justify-between gap-3">
        <h2 className="spec text-ink-2">{title}</h2>
        {link && (
          <Link to={link.to} className="spec tap-link flex items-center gap-0.5 text-gold">
            {link.label}
            <ChevronRight className="size-3.5" aria-hidden />
          </Link>
        )}
      </div>
      {children}
    </section>
  )
}

/** Last known bodyweight, from a finished session or a scan, whichever is more recent. */
function useLatestWeight() {
  const workouts = useWorkouts().data
  const scans = useScans().data
  return useMemo(
    () => dailyWeights(weightEntries(workouts ?? [], scans ?? [])).at(-1) ?? null,
    [workouts, scans],
  )
}

/** Exercise id → exercise for tonnage of bodyweight exercises. */
function useTonnageOptions() {
  const lookup = useExerciseLookup()
  const sets = useSets().data
  const bodyweight = useLatestWeight()?.value ?? null
  return useMemo(() => {
    const exercisesById: Record<string, Exercise> = {}
    for (const s of sets ?? [])
      if (!exercisesById[s.exerciseId]) exercisesById[s.exerciseId] = lookup(s.exerciseId)
    return { exercisesById, bodyweight }
  }, [lookup, sets, bodyweight])
}

/* ───────────── Entreno de hoy ───────────── */

function TodayWorkout({ program, now }: { program: Program | null; now: Date }) {
  const nav = useNavigate()
  const active = useActiveWorkout()
  const workoutsQ = useWorkouts()
  const start = useStartWorkout()
  const lookup = useExerciseLookup()
  const [picking, setPicking] = useState(false)
  const workouts = workoutsQ.data

  const doneIds = useMemo(
    () => (program && workouts ? doneDayIdsThisWeek(workouts, program, now) : new Set<string>()),
    [program, workouts, now],
  )
  const done = useMemo(() => (workouts ? finishedToday(workouts, now) : null), [workouts, now])

  if (workoutsQ.isPending) {
    return (
      <div className="mb-5 flex flex-col gap-3">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  const startDay = (day: ProgramDay) => void start({ ...(program ? { program } : {}), day })
  const free = () => void start({ name: 'Entreno libre' })
  const picker = program && (
    <DayPickerSheet
      open={picking}
      onClose={() => setPicking(false)}
      program={program}
      onPick={startDay}
    />
  )

  if (active) {
    return (
      <Hero label="En curso" tone="gold">
        <HeroTitle>{active.name}</HeroTitle>
        <p className="mt-1 text-[13px] text-muted">
          Empezaste a las{' '}
          {new Date(active.startedAt).toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
        <Button
          block
          size="lg"
          className="mt-4"
          leading={<Play className="size-5" />}
          onClick={() => nav('/session')}
        >
          Continuar
        </Button>
      </Hero>
    )
  }

  if (!program) {
    return (
      <Hero label="Entreno de hoy">
        <HeroTitle>Sin programa activo</HeroTitle>
        <p className="mt-1 text-[14px] text-ink-2">
          Elige un programa y cada día sabrás qué toca, con qué peso y cuánto descansar.
        </p>
        <Button block size="lg" className="mt-4" onClick={() => nav('/programs')}>
          Elegir programa
        </Button>
        <Button variant="ghost" block className="mt-2" onClick={free}>
          Entreno libre
        </Button>
      </Hero>
    )
  }

  const day = dayForDate(program, doneIds, now)

  // A program session already finished today closes the day; a free one leaves the plan up.
  if (done && (done.programId === program.id || !day)) {
    return (
      <Hero label="Hecho hoy">
        <DoneToday workout={done} />
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => setPicking(true)}>
            Otro día
          </Button>
          <Button variant="secondary" onClick={free}>
            Entreno libre
          </Button>
        </div>
        {picker}
      </Hero>
    )
  }

  if (!day) {
    return (
      <Hero label="Entreno de hoy">
        <HeroTitle>Hoy toca descanso</HeroTitle>
        <p className="mt-1 text-[14px] text-ink-2">
          El músculo crece mientras descansas. Camina, come bien y duerme.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => setPicking(true)}>
            Entrenar igualmente
          </Button>
          <Button variant="secondary" onClick={free}>
            Entreno libre
          </Button>
        </div>
        {picker}
      </Hero>
    )
  }

  const meso = mesoWeek(program, now)
  const totalSets = day.slots.reduce((t, s) => t + s.sets, 0)
  return (
    <Hero
      label="Entreno de hoy"
      tone="gold"
      aside={meso.deload ? <Badge tone="brand">Descarga</Badge> : undefined}
    >
      <HeroTitle>{day.name}</HeroTitle>
      {day.focus && <p className="mt-0.5 text-[13.5px] text-ink-2">{day.focus}</p>}
      {day.slots.length ? (
        <ul className="mt-3 divide-y divide-line">
          {day.slots.map((s) => (
            <li key={s.id} className="flex min-h-10 items-center justify-between gap-3 py-1.5">
              <span className="min-w-0 break-words text-[14px]">{lookup(s.exerciseId).name}</span>
              <span className="readout shrink-0 text-[16px] font-semibold text-ink-2">
                {prescription(s)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-[13.5px] text-muted">
          Este día no tiene ejercicios: añádelos en el programa.
        </p>
      )}
      <p className="mt-3 text-[12.5px] text-muted">
        ≈ {estimateMinutes(day.slots)} min · {totalSets} series
        {meso.deload ? ' · semana de descarga: menos series y más margen' : ''}
      </p>
      <Button
        block
        size="lg"
        className="mt-4"
        leading={<Play className="size-5" />}
        disabled={!day.slots.length}
        onClick={() => startDay(day)}
      >
        Empezar entreno
      </Button>
      {program.days.length > 1 && (
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="spec tap-link mx-auto mt-2 block min-h-11 text-muted"
        >
          Hacer otro día
        </button>
      )}
      {picker}
    </Hero>
  )
}

function DoneToday({ workout }: { workout: WorkoutFull }) {
  const sets = useSets().data
  const work = useMemo(
    () => (sets ?? []).filter((s) => s.workoutId === workout.id && s.kind !== 'warmup').length,
    [sets, workout.id],
  )
  const min = workoutMinutes(workout)
  return (
    <Link to={`/workout/${workout.id}`} className="flex items-center gap-3">
      <span className="min-w-0 flex-1">
        <HeroTitle>{workout.name}</HeroTitle>
        <span className="mt-1 block text-[13px] text-muted">
          {min != null ? `${min} min · ` : ''}
          {work} series · buen trabajo, ahora a recuperar
        </span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden />
    </Link>
  )
}

function Hero({
  label,
  tone,
  aside,
  children,
}: {
  label: string
  tone?: 'gold'
  aside?: ReactNode
  children: ReactNode
}) {
  return (
    <section className={clsx('card fade-up mb-5 p-4', tone === 'gold' && 'border-gold-dark')}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className={clsx('spec', tone === 'gold' && 'text-gold')}>{label}</span>
        {aside}
      </div>
      {children}
    </section>
  )
}

function HeroTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="break-words font-display text-[28px] font-semibold uppercase leading-[1.05] tracking-[0.04em]">
      {children}
    </h2>
  )
}

/* ───────────── Preparación ───────────── */

const LEVEL_TEXT: Record<ReadinessLevel, string> = {
  push: 'Listo para apretar',
  normal: 'Día normal',
  easy: 'Día suave',
  unknown: 'Sin datos',
}

function ReadinessBlock() {
  const r = useReadiness()
  const [open, setOpen] = useState(false)
  // Nothing to show yet: one line and the button, not an empty dial.
  if (r.level === 'unknown') {
    return (
      <section className="flex items-center justify-between gap-3 border-t border-line py-4">
        <span className="min-w-0">
          <span className="spec block text-ink-2">¿Cómo llegas hoy?</span>
          <span className="block text-[13px] text-muted">
            Energía y sueño: el plan decide si sube o mantiene pesos.
          </span>
        </span>
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
          Check-in
        </Button>
        <CheckinSheet open={open} onClose={() => setOpen(false)} />
      </section>
    )
  }
  const color = r.level === 'easy' ? 'var(--warn)' : 'var(--gold)'
  return (
    <Block title="Preparación">
      <Kpi
        label={LEVEL_TEXT[r.level]}
        value={r.score ?? '—'}
        unit={r.score != null ? '/ 100' : undefined}
        tone={r.level === 'easy' ? 'warn' : r.level === 'push' ? 'signal' : 'default'}
        caption={
          r.level === 'easy'
            ? 'Hoy el plan no sube pesos y deja una repetición más en recámara.'
            : r.level === 'push'
              ? 'Buen día para intentar subir.'
              : 'Sigue el plan tal cual.'
        }
      >
        {r.score != null && (
          <Meter value={r.score} max={100} color={color} label={`Preparación ${r.score} de 100`} />
        )}
      </Kpi>
      {r.factors.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-ink-2">
          {r.factors.map((f) => (
            <li key={f}>· {f}</li>
          ))}
        </ul>
      )}
      <Button variant="secondary" size="sm" className="mt-4" onClick={() => setOpen(true)}>
        {r.hasCheckin ? 'Editar check-in' : 'Check-in de hoy'}
      </Button>
      <CheckinSheet open={open} onClose={() => setOpen(false)} />
    </Block>
  )
}

/* ───────────── Esta semana ───────────── */

const WEEK_LETTERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

function WeekBlock({
  now,
  weeklyTarget,
  program,
}: {
  now: Date
  weeklyTarget: number
  program: Program | null
}) {
  const workouts = useWorkouts().data
  const sets = useSets().data
  const opts = useTonnageOptions()
  const w = useMemo(
    () => weekSummary(workouts ?? [], sets ?? [], now, opts),
    [workouts, sets, now, opts],
  )
  const missing = weeklyTarget - w.sessions
  // Days left in the week, today included unless already trained.
  const daysLeft = 7 - w.todayIndex - (w.days[w.todayIndex] ? 1 : 0)
  const setsDiff = w.sets - w.prevSets
  const tonDiff = w.tonnage - w.prevTonnage
  return (
    <Block title="Esta semana" link={{ to: '/evolution', label: 'Evolución' }}>
      <Kpi
        label="Sesiones"
        value={w.sessions}
        unit={`de ${weeklyTarget}`}
        tone={w.sessions >= weeklyTarget ? 'signal' : 'default'}
        caption={
          missing <= 0
            ? 'Objetivo semanal cumplido.'
            : `Te ${missing === 1 ? 'falta 1 sesión' : `faltan ${missing} sesiones`} para tu objetivo${
                missing > daysLeft && daysLeft > 0
                  ? `; ${daysLeft === 1 ? 'queda 1 día' : `quedan ${daysLeft} días`}.`
                  : '.'
              }`
        }
      >
        <Ticks
          cells={w.days.map((d) => (d ? 'full' : 'none'))}
          todayIndex={w.todayIndex}
          label={`${w.sessions} sesiones esta semana`}
        />
        <div className="mt-1 flex gap-[3px]" aria-hidden>
          {WEEK_LETTERS.map((l, i) => (
            <span
              key={l}
              className={clsx(
                'flex-1 text-center text-[11px]',
                i === w.todayIndex ? 'text-ink' : 'text-muted',
              )}
            >
              {l}
            </span>
          ))}
        </div>
      </Kpi>
      <div className="mt-5 grid grid-cols-2 gap-4">
        <Kpi
          size="sm"
          label="Series efectivas"
          value={w.sets}
          aside={
            w.sets || w.prevSets ? (
              <Delta
                text={signed(setsDiff, String)}
                direction={setsDiff > 0 ? 'up' : setsDiff < 0 ? 'down' : 'flat'}
                tone="neutral"
              />
            ) : undefined
          }
        />
        <Kpi
          size="sm"
          label="Tonelaje"
          value={formatInt(w.tonnage)}
          unit="kg"
          aside={
            w.tonnage || w.prevTonnage ? (
              <Delta
                text={signed(Math.round(tonDiff), formatInt)}
                direction={tonDiff > 0 ? 'up' : tonDiff < 0 ? 'down' : 'flat'}
                tone="neutral"
              />
            ) : undefined
          }
        />
      </div>
      <p className="mt-2 text-[12px] text-muted">
        Cambio frente a la semana pasada a estas alturas.
      </p>
      <WeekWarnings now={now} program={program} />
    </Block>
  )
}

/* ───────────── Récords recientes ───────────── */

function RecordsBlock({ now }: { now: Date }) {
  const sets = useSets().data
  const lookup = useExerciseLookup()
  const prs = useMemo(() => recentRecords(sets ?? [], now, 14), [sets, now])
  return (
    <Block title="Récords · 14 días">
      {prs.length ? (
        <ul className="divide-y divide-line">
          {prs.slice(0, 6).map((pr) => (
            <li key={`${pr.exerciseId}-${pr.kind}`}>
              <Link
                to={`/exercise/${pr.exerciseId}`}
                className="flex min-h-[52px] items-center gap-3 py-2"
              >
                <Trophy className="size-4 shrink-0 text-gold" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-[14.5px] font-medium">
                    {lookup(pr.exerciseId).name}
                  </span>
                  <span className="block text-[12.5px] text-muted">
                    {PR_LABEL[pr.kind]} · {formatShortDate(pr.date, now)}
                  </span>
                </span>
                <span className="readout shrink-0 text-[18px] font-semibold text-gold">
                  {prValue(pr, (n) => formatNumber(n))}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13.5px] text-muted">
          Sin récords en las dos últimas semanas. Completa el rango de repeticiones y el plan te
          subirá el peso.
        </p>
      )}
    </Block>
  )
}

/* ───────────── Cuerpo ───────────── */

function BodyBlock({ now }: { now: Date }) {
  const scans = useScans()
  const st = useMemo(() => scanStatus(scans.data ?? [], now), [scans.data, now])
  const latest = useLatestWeight()
  // A weight typed after a session that is newer than the last scan replaces the scan's.
  const newer =
    latest && latest.source === 'workout' && (!st || latest.date > st.last.date) ? latest : null
  if (scans.isPending) return null
  return (
    <Block title="Cuerpo" link={{ to: '/body', label: 'Ver' }}>
      {st ? (
        <>
          <div className="grid grid-cols-3 gap-3">
            {newer ? (
              <Kpi
                size="sm"
                label="Peso"
                value={formatNumber(newer.value, 1)}
                unit="kg"
                caption={weightSourceLabel(newer, now)}
              />
            ) : (
              <ScanKpi
                label="Peso"
                unit="kg"
                scan={st.last}
                prev={st.previous}
                pick={(s) => s.peso}
                good="none"
              />
            )}
            <ScanKpi
              label="Grasa"
              unit="%"
              scan={st.last}
              prev={st.previous}
              pick={(s) => s.grasa}
              good="down"
            />
            <ScanKpi
              label="Músculo"
              unit="kg"
              scan={st.last}
              prev={st.previous}
              pick={(s) => s.musculo}
              good="up"
            />
          </div>
          <p className="mt-2 text-[12px] text-muted">
            Boditrax {agoLabel(st.daysAgo)}
            {st.previous ? ` · cambio frente al ${formatShortDate(st.previous.date, now)}` : ''}
          </p>
          {st.daysAgo > SCAN_STALE_DAYS && (
            <p className="mt-3 border-l-2 border-warn pl-3 text-[13.5px] text-warn">
              Toca escáner: el último fue hace {st.daysAgo} días.
            </p>
          )}
        </>
      ) : newer ? (
        <>
          <Kpi
            size="sm"
            label="Peso"
            value={formatNumber(newer.value, 1)}
            unit="kg"
            caption={weightSourceLabel(newer, now)}
          />
          <p className="mt-3 text-[13.5px] text-muted">
            Sin escáneres todavía. Añade tu último Boditrax en Cuerpo para seguir grasa y músculo.
          </p>
        </>
      ) : (
        <p className="text-[13.5px] text-muted">
          Sin escáneres todavía. Añade tu último Boditrax en Cuerpo para seguir peso, grasa y
          músculo.
        </p>
      )}
    </Block>
  )
}

function ScanKpi({
  label,
  unit,
  scan,
  prev,
  pick,
  good,
}: {
  label: string
  unit: string
  scan: Scan
  prev: Scan | null
  pick: (s: Scan) => number | null
  good: 'up' | 'down' | 'none'
}) {
  const v = pick(scan)
  const p = prev ? pick(prev) : null
  const diff = v != null && p != null ? Math.round((v - p) * 10) / 10 : null
  const direction = diff == null || diff === 0 ? 'flat' : diff > 0 ? 'up' : 'down'
  const tone =
    good === 'none' || diff == null || diff === 0
      ? 'neutral'
      : (good === 'up') === diff > 0
        ? 'good'
        : 'bad'
  return (
    <Kpi
      size="sm"
      label={label}
      value={v == null ? '—' : formatNumber(v, 1)}
      unit={v == null ? undefined : unit}
      caption={
        diff != null ? (
          <Delta text={signed(diff, (n) => formatNumber(n, 1))} direction={direction} tone={tone} />
        ) : undefined
      }
    />
  )
}

/* ───────────── Objetivos ───────────── */

function GoalsBlock({ now }: { now: Date }) {
  const goals = useGoals()
  const sets = useSets().data
  const scans = useScans().data
  const workouts = useWorkouts().data
  const lookup = useExerciseLookup()
  const sessionsThisWeek = useMemo(
    () => weekSummary(workouts ?? [], [], now).sessions,
    [workouts, now],
  )
  const active = useMemo(
    () => (goals.data ?? []).filter((g) => !g.achievedAt).slice(0, 2),
    [goals.data],
  )
  const rows = useMemo(
    () =>
      active.map((g) => {
        const current = goalCurrent(g, { sets: sets ?? [], scans: scans ?? [], sessionsThisWeek })
        return { goal: g, current, progress: goalProgress(g, current) }
      }),
    [active, sets, scans, sessionsThisWeek],
  )
  // Without active goals the suggestions live in «Esta semana» (WeekWarnings).
  if (goals.isPending || !rows.length) return null
  return (
    <Block title="Objetivos" link={{ to: '/goals', label: 'Todos' }}>
      <ul className="flex flex-col gap-4">
        {rows.map(({ goal, current, progress }) => (
          <li key={goal.id}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 break-words text-[14.5px] font-medium">
                {goalTitle(goal, goal.exerciseId ? lookup(goal.exerciseId).name : null, (n) =>
                  formatNumber(n),
                )}
              </span>
              <span className="readout shrink-0 text-[16px] font-semibold text-ink-2">
                {progress != null ? `${Math.round(progress * 100)} %` : '—'}
              </span>
            </div>
            {progress != null && <Meter value={progress} className="mt-2" />}
            <p className="mt-1 text-[12px] text-muted">
              {current != null
                ? `Ahora: ${formatNumber(current, 1)} ${goalUnit(goal)}`
                : 'Sin datos para medirlo todavía.'}
              {goal.deadline ? ` · fecha límite ${formatShortDate(goal.deadline, now)}` : ''}
            </p>
          </li>
        ))}
      </ul>
    </Block>
  )
}
