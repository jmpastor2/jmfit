import { ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MUSCLE_LABEL } from '@/content/exercises'
import { STRENGTH_LEVEL_LABEL, strengthLevel, type Sex } from '@/content/standards'
import { VOLUME_LANDMARKS, volumeZone, type VolumeZone } from '@/content/landmarks'
import { LineChart, shortDate } from '@/components/charts/LineChart'
import { Delta } from '@/components/kpi/Kpi'
import { Meter } from '@/components/kpi/Meter'
import { Spark } from '@/components/kpi/Spark'
import { Ticks } from '@/components/kpi/Ticks'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { EmptyState, SectionTitle, Segmented, Skeleton } from '@/components/ui/primitives'
import { useMe, useScans, useSets, useWorkouts } from '@/data/hooks'
import {
  bestsByExercise,
  formatNumber,
  trainingDays,
  weeklyTrend,
  type ExerciseBests,
} from '@/domain/training'
import type { Exercise, LoggedSet, Muscle, PersonalRecord } from '@/domain/types'
import { useExerciseLookup } from '@/features/exercise/lookup'
import { latestBodyweight, mainLifts, prTimeline } from '@/features/exercise/stats'
import { RepMaxTable } from './RepMaxTable'
import { muscleSets, strengthRow, type WeekView } from './progressStats'

type View = 'strength' | 'volume' | 'records'

const MUSCLES: Muscle[] = [
  'biceps',
  'triceps',
  'chest',
  'back',
  'traps',
  'front_delts',
  'side_delts',
  'rear_delts',
  'forearms',
  'quads',
  'hamstrings',
  'glutes',
  'adductors',
  'calves',
  'abs',
  'lower_back',
]
const ARMS: ReadonlySet<Muscle> = new Set<Muscle>(['biceps', 'triceps'])

export function ProgressPage() {
  const [view, setView] = useState<View>('strength')
  const nav = useNavigate()
  const setsQ = useSets()
  const workoutsQ = useWorkouts()
  const sets = setsQ.data
  const loading = setsQ.isPending || workoutsQ.isPending

  return (
    <>
      <PageHeader large eyebrow="Tu evolución" title="Progreso" />
      <Segmented<View>
        value={view}
        onChange={setView}
        options={[
          { value: 'strength', label: 'Fuerza' },
          { value: 'volume', label: 'Volumen' },
          { value: 'records', label: 'Récords' },
        ]}
      />
      <div className="mt-5">
        {loading ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : !sets?.length ? (
          <EmptyState
            title="Sin series todavía"
            description="Registra tu primera sesión y aquí verás tu fuerza, tu volumen por músculo y tus récords."
            action={<Button onClick={() => nav('/train')}>Ir a entrenar</Button>}
          />
        ) : view === 'strength' ? (
          <StrengthView sets={sets} />
        ) : view === 'volume' ? (
          <VolumeView sets={sets} />
        ) : (
          <RecordsView sets={sets} />
        )}
      </div>
    </>
  )
}

/* ───────────── Fuerza ───────────── */

function StrengthView({ sets }: { sets: LoggedSet[] }) {
  const lookup = useExerciseLookup()
  const workouts = useWorkouts().data
  const scans = useScans().data
  const me = useMe()
  const sex: Sex | null = me.sex === 'M' ? 'male' : me.sex === 'F' ? 'female' : null
  const [now] = useState(() => new Date())
  const bw = useMemo(() => latestBodyweight(scans ?? [], workouts ?? []), [scans, workouts])
  const rows = useMemo(
    () =>
      mainLifts(sets, lookup).map((l) =>
        Object.assign(strengthRow(l.exercise.id, sets, now), {
          exercise: l.exercise,
          sessions: l.sessions,
        }),
      ),
    [sets, lookup, now],
  )

  if (!rows.length) {
    return (
      <EmptyState
        title="Sin levantamientos principales"
        description="Aquí salen los ejercicios compuestos (press, sentadilla, remo, peso muerto…) en cuanto registres series con peso y repeticiones."
      />
    )
  }

  return (
    <>
      <p className="mb-2 px-1 text-[13px] text-muted">
        1RM estimado: la mejor serie de las últimas 4 semanas. La flecha compara con hace 8 semanas.
        {bw
          ? ` Nivel (tablas de Strength Level) relativo a ${formatNumber(bw.value, 1)} kg de peso corporal (${shortDate(bw.date)}).`
          : ' Sin peso corporal: registra un escáner para ver tu nivel.'}
        {bw && !sex && ' Indica tu sexo en Ajustes para ver tu nivel.'}
      </p>
      <ul className="divide-y divide-line">
        {rows.map((r) => {
          const value = r.current ?? r.best?.value ?? null
          const delta = r.current != null && r.before != null ? r.current - r.before : null
          const level =
            value != null && bw && sex ? strengthLevel(r.exercise.id, value, bw.value, sex) : null
          return (
            <li key={r.exercise.id}>
              <Link
                to={`/exercise/${r.exercise.id}`}
                className="flex min-h-[64px] items-center gap-3 py-3 active:bg-panel-2"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-medium leading-snug">
                    {r.exercise.name}
                  </span>
                  <span className="block text-[12.5px] text-muted">
                    {level ? (
                      <>
                        <span className="text-gold">{STRENGTH_LEVEL_LABEL[level.level]}</span>
                        {` · ${formatNumber(level.ratio, 2)} × tu peso`}
                        {level.next &&
                          ` · ${STRENGTH_LEVEL_LABEL[level.next.level].toLowerCase()} a ${formatNumber(level.next.e1rm, 1)} kg`}
                      </>
                    ) : (
                      `${r.sessions} ${r.sessions === 1 ? 'sesión' : 'sesiones'}`
                    )}
                    {r.current == null && r.lastDate && ` · última vez ${shortDate(r.lastDate)}`}
                  </span>
                </span>
                <span className="hidden w-16 shrink-0 min-[360px]:block">
                  <Spark values={r.spark} height={28} />
                </span>
                <span className="flex w-[74px] shrink-0 flex-col items-end">
                  <span className="readout text-[22px] font-semibold leading-none">
                    {value != null ? formatNumber(value, 1) : '—'}
                    <span className="ml-0.5 font-sans text-[11px] text-muted">kg</span>
                  </span>
                  {delta != null ? (
                    <Delta
                      className="mt-0.5"
                      text={`${delta >= 0 ? '+' : ''}${formatNumber(delta, 1)}`}
                      direction={Math.abs(delta) < 0.05 ? 'flat' : delta > 0 ? 'up' : 'down'}
                      tone={Math.abs(delta) < 0.05 ? 'neutral' : delta > 0 ? 'good' : 'bad'}
                    />
                  ) : (
                    <span className="mt-0.5 text-[11.5px] text-muted">
                      {r.current == null ? 'sin datos recientes' : 'sin dato de hace 8 sem'}
                    </span>
                  )}
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
              </Link>
            </li>
          )
        })}
      </ul>
    </>
  )
}

/* ───────────── Volumen ───────────── */

function useExerciseMap(sets: LoggedSet[]): Record<string, Exercise> {
  const lookup = useExerciseLookup()
  return useMemo(() => {
    const out: Record<string, Exercise> = {}
    for (const s of sets) out[s.exerciseId] ??= lookup(s.exerciseId)
    return out
  }, [sets, lookup])
}

function VolumeView({ sets }: { sets: LoggedSet[] }) {
  const byId = useExerciseMap(sets)
  const workouts = useWorkouts().data
  const scans = useScans().data
  const [now] = useState(() => new Date())
  const [week, setWeek] = useState<WeekView>('this')

  const perMuscle = useMemo(() => muscleSets(sets, byId, now, week), [sets, byId, now, week])
  const bw = useMemo(() => latestBodyweight(scans ?? [], workouts ?? []), [scans, workouts])
  const trend = useMemo(
    () => weeklyTrend(sets, 12, now, { bodyweight: bw?.value ?? null, exercisesById: byId }),
    [sets, now, bw, byId],
  )
  const days = useMemo(() => trainingDays(workouts ?? [], 56, now), [workouts, now])
  const trainedDays = days.filter(Boolean).length

  const arms = MUSCLES.filter((m) => ARMS.has(m))
  const rest = MUSCLES.filter((m) => !ARMS.has(m))
  const maxSets = Math.max(1, ...trend.map((t) => t.sets))
  const hasTrend = trend.some((t) => t.sets > 0 || t.tonnage > 0)

  return (
    <div className="flex flex-col gap-7">
      <section>
        <Segmented<WeekView>
          size="sm"
          value={week}
          onChange={setWeek}
          options={[
            { value: 'this', label: 'Esta semana' },
            { value: 'last', label: 'Anterior' },
            { value: 'avg4', label: 'Media 4 sem' },
          ]}
        />
        <p className="mt-3 px-1 text-[12.5px] text-muted">
          Series efectivas (RIR ≤ 4); un músculo secundario cuenta media serie. Franja: de MEV a MAV
          (volumen productivo). Marca: MRV (lo máximo recuperable).
        </p>

        <SectionTitle>Brazos · tu especialización</SectionTitle>
        <ul className="flex flex-col gap-4 rounded-[10px] border border-gold-dark/60 px-3 py-3.5">
          {arms.map((m) => (
            <MuscleMeter key={m} muscle={m} value={perMuscle[m] ?? 0} strong />
          ))}
        </ul>

        <SectionTitle>Resto de músculos</SectionTitle>
        <ul className="flex flex-col gap-4 px-1">
          {rest.map((m) => (
            <MuscleMeter key={m} muscle={m} value={perMuscle[m] ?? 0} />
          ))}
        </ul>
      </section>

      <section>
        <SectionTitle>Últimas 12 semanas</SectionTitle>
        {hasTrend ? (
          <>
            <LineChart
              points={trend.map((t) => ({ x: t.weekStart, y: t.tonnage }))}
              unit="kg"
              height={120}
              format={(n) => formatNumber(Math.round(n))}
              label="Tonelaje por semana, últimas 12 semanas"
            />
            <p className="mt-2 px-1 text-[12.5px] text-muted">
              Tonelaje (kg × reps de las series de trabajo) por semana, de lunes a domingo.
            </p>
            <div className="mt-4">
              <div className="spec mb-2">Series efectivas por semana</div>
              <div
                className="flex h-16 items-end gap-[3px]"
                role="img"
                aria-label={`Series por semana: ${trend.map((t) => t.sets).join(', ')}`}
              >
                {trend.map((t, i) => (
                  <span
                    key={t.weekStart}
                    className="flex-1 rounded-[2px]"
                    style={{
                      height: `${Math.max(4, (t.sets / maxSets) * 100)}%`,
                      background:
                        i === trend.length - 1
                          ? 'var(--gold)'
                          : t.sets
                            ? 'color-mix(in oklab, var(--gold) 45%, var(--panel-3))'
                            : 'var(--panel-3)',
                    }}
                  />
                ))}
              </div>
              <div className="mt-1.5 flex justify-between text-[11px] text-muted">
                <span>{shortDate(trend[0]!.weekStart)}</span>
                <span>
                  Esta semana: <span className="readout text-ink">{trend.at(-1)!.sets}</span> series
                </span>
              </div>
            </div>
          </>
        ) : (
          <p className="px-1 text-[13.5px] text-muted">Sin series en las últimas 12 semanas.</p>
        )}
      </section>

      <section>
        <SectionTitle>Frecuencia · 56 días</SectionTitle>
        <Ticks
          cells={days.map((d) => (d ? 'full' : 'none'))}
          height={22}
          label={`${trainedDays} días entrenados en las últimas 8 semanas`}
        />
        <p className="mt-2 px-1 text-[12.5px] text-muted">
          <span className="readout text-[15px] text-ink">{trainedDays}</span> días entrenados en 8
          semanas · media {formatNumber(trainedDays / 8, 1)} por semana. Hoy es la última barra.
        </p>
      </section>
    </div>
  )
}

const ZONE: Record<VolumeZone, { text: string; cls: string }> = {
  over_mrv: { text: 'por encima de MRV', cls: 'text-danger' },
  high: { text: 'alto, sobre MAV', cls: 'text-warn' },
  optimal: { text: 'óptimo', cls: 'text-gold' },
  productive: { text: 'productivo', cls: 'text-ink-2' },
  maintenance: { text: 'mantenimiento', cls: 'text-muted' },
  below_mv: { text: 'por debajo del mínimo', cls: 'text-muted' },
}

function MuscleMeter({
  muscle,
  value,
  strong,
}: {
  muscle: Muscle
  value: number
  strong?: boolean
}) {
  const lm = VOLUME_LANDMARKS[muscle]
  const zone = ZONE[volumeZone(muscle, value)]
  return (
    <li>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span
          className={strong ? 'text-[15px] font-semibold' : 'text-[14px] font-medium text-ink-2'}
        >
          {MUSCLE_LABEL[muscle]}
        </span>
        <span className="text-right text-[12.5px] text-muted">
          <span className="readout mr-1 text-[17px] font-semibold text-ink">
            {formatNumber(value, 1)}
          </span>
          series <span className={zone.cls}>· {zone.text}</span>
        </span>
      </div>
      <Meter
        value={value}
        max={Math.max(lm.mrv * 1.15, value)}
        band={[lm.mev, lm.mav[1]]}
        target={lm.mrv}
        color={strong ? 'var(--gold)' : 'var(--ink-2)'}
      />
      <div className="mt-1 text-[11px] text-muted">
        MEV {formatNumber(lm.mev)} · MAV {formatNumber(lm.mav[0])}–{formatNumber(lm.mav[1])} · MRV{' '}
        {formatNumber(lm.mrv)}
        {lm.approximate && ' · aproximado'}
      </div>
    </li>
  )
}

/* ───────────── Récords ───────────── */

const PR_RANK: Record<PersonalRecord['kind'], number> = { e1rm: 0, weight: 1, reps: 2, volume: 3 }

function RecordsView({ sets }: { sets: LoggedSet[] }) {
  const lookup = useExerciseLookup()
  const bests = useMemo(() => bestsByExercise(sets), [sets])
  const [selected, setSelected] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)

  const rows = useMemo(
    () =>
      Object.values(bests)
        .filter((b) => b.e1rm || b.maxWeight)
        .map((b) => ({ b, exercise: lookup(b.exerciseId) }))
        .toSorted(
          (x, y) =>
            (y.b.e1rm?.value ?? 0) - (x.b.e1rm?.value ?? 0) ||
            x.exercise.name.localeCompare(y.exercise.name, 'es'),
        ),
    [bests, lookup],
  )

  // One line per record-breaking set: the most telling record of that set.
  const timeline = useMemo(() => {
    const bySet = new Map<string, PersonalRecord>()
    for (const pr of prTimeline(sets)) {
      const cur = bySet.get(pr.setId)
      if (!cur || PR_RANK[pr.kind] < PR_RANK[cur.kind]) bySet.set(pr.setId, pr)
    }
    return [...bySet.values()].toReversed()
  }, [sets])

  const shownTimeline = showAll ? timeline : timeline.slice(0, 25)

  return (
    <div className="flex flex-col gap-7">
      <section>
        <SectionTitle>Por ejercicio</SectionTitle>
        <p className="-mt-1 mb-2 px-1 text-[12.5px] text-muted">
          Toca un ejercicio para ver su tabla de rep-max.
        </p>
        <ul className="divide-y divide-line">
          {rows.map(({ b, exercise }) => (
            <RecordRow
              key={b.exerciseId}
              bests={b}
              exercise={exercise}
              open={selected === b.exerciseId}
              onToggle={() => setSelected(selected === b.exerciseId ? null : b.exerciseId)}
            />
          ))}
        </ul>
      </section>

      <section>
        <SectionTitle>Historial de récords</SectionTitle>
        {timeline.length === 0 ? (
          <p className="px-1 text-[13.5px] text-muted">
            Aún no hay récords: la primera vez que haces un ejercicio es tu punto de partida.
            Supéralo en la próxima sesión.
          </p>
        ) : (
          <>
            <ul className="divide-y divide-line">
              {shownTimeline.map((pr) => (
                <li key={pr.setId + pr.kind}>
                  <Link
                    to={`/exercise/${pr.exerciseId}`}
                    className="flex min-h-[52px] items-center justify-between gap-3 py-2.5"
                  >
                    <span className="min-w-0">
                      <span className="block text-[14.5px] font-medium">
                        {lookup(pr.exerciseId).name}
                      </span>
                      <span className="block text-[12.5px] text-muted">
                        {shortDate(pr.date)} · {prText(pr)}
                      </span>
                    </span>
                    <span className="readout shrink-0 text-[18px] font-semibold text-gold-light">
                      {pr.kind === 'reps' ? pr.value : formatNumber(pr.value, 1)}
                      <span className="ml-0.5 font-sans text-[11px] text-muted">
                        {pr.kind === 'reps' ? 'reps' : 'kg'}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            {timeline.length > shownTimeline.length && (
              <Button variant="ghost" block className="mt-2" onClick={() => setShowAll(true)}>
                Ver los {timeline.length}
              </Button>
            )}
          </>
        )}
      </section>
    </div>
  )
}

function prText(pr: PersonalRecord): string {
  const prev = pr.previous != null ? ` (antes ${formatNumber(pr.previous, 1)})` : ''
  switch (pr.kind) {
    case 'e1rm':
      return `1RM estimado${prev}`
    case 'weight':
      return `peso máximo${prev}`
    case 'reps':
      return `reps con ${formatNumber(pr.atWeight ?? 0)} kg${prev}`
    case 'volume':
      return `volumen de sesión${prev}`
  }
}

function RecordRow({
  bests,
  exercise,
  open,
  onToggle,
}: {
  bests: ExerciseBests
  exercise: Exercise
  open: boolean
  onToggle: () => void
}) {
  const best = bests.bestSetVolume
  return (
    <li className="py-1">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex min-h-[52px] w-full items-center gap-3 py-2 text-left active:bg-panel-2"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[14.5px] font-medium leading-snug">{exercise.name}</span>
          <span className="block text-[12.5px] text-muted">
            {bests.maxWeight && `Máx ${formatNumber(bests.maxWeight.value)} kg`}
            {best && ` · mejor serie ${formatNumber(best.weight)}×${best.reps}`}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="readout block text-[20px] font-semibold leading-none">
            {bests.e1rm ? formatNumber(bests.e1rm.value, 1) : '—'}
            <span className="ml-0.5 font-sans text-[11px] text-muted">kg</span>
          </span>
          <span className="spec text-[10.5px]">1RM est.</span>
        </span>
      </button>
      {open && (
        <div className="pb-3">
          <RepMaxTable repPRs={bests.repPRs} />
          <Link to={`/exercise/${exercise.id}`} className="spec tap-link mt-3 block text-gold">
            Ver historial del ejercicio
          </Link>
        </div>
      )}
    </li>
  )
}
