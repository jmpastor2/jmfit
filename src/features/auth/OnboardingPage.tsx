import { clsx } from 'clsx'
import { Check } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Splash } from '@/components/layout/Splash'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { Segmented } from '@/components/ui/primitives'
import { useProfile, useUpdateProfile } from '@/data/hooks'
import type { Profile } from '@/data/rows'
import type { Experience, Goal } from '@/domain/types'
import { EXPERIENCE_LABEL, GOAL_LABEL, GOAL_ORDER } from '@/features/programs/labels'
import { BrandMark } from './BrandMark'
import { useSession } from './SessionProvider'

const STEPS = ['Tú', 'Nivel', 'Objetivo', 'Días'] as const

const LEVEL_TEXT: Record<Experience, string> = {
  novice:
    'Menos de un año entrenando en serio, o vuelves tras un parón largo. Subes peso casi cada semana.',
  intermediate:
    'Entre uno y cuatro años constante. Progresas, pero ya de mes en mes, no de sesión en sesión.',
  advanced:
    'Más de cuatro años bien hechos. Cada kilo cuesta y necesitas más volumen y bloques planificados.',
}

const GOAL_TEXT: Record<Goal, string> = {
  hypertrophy: 'Ganar músculo. Series de 6 a 15 repeticiones cerca del fallo.',
  strength: 'Mover más kilos en los básicos. Menos repeticiones, más descanso.',
  recomp: 'Ganar músculo y perder grasa a la vez, con calorías de mantenimiento.',
  cut: 'Perder grasa conservando el músculo y la fuerza.',
  maintenance: 'Mantener lo ganado con el mínimo tiempo en el gimnasio.',
  glutes: 'Priorizar glúteo y tren inferior sin descuidar el resto.',
}

/** First run for a new account: who you are, level, goal and days, then on to the programs. */
export function OnboardingPage() {
  const { status, user } = useSession()
  const profile = useProfile(user?.id)

  if (status === 'loading') return <Splash />
  if (status === 'signed_out' || !user) return <Navigate to="/auth" replace />
  if (profile.isPending) return <Splash />
  if (profile.isError || !profile.data)
    return <Splash error={profile.error?.message ?? 'No se pudo cargar tu perfil'} />
  if (profile.data.onboarded) return <Navigate to="/" replace />
  return <Wizard profile={profile.data} />
}

function Wizard({ profile }: { profile: Profile }) {
  const nav = useNavigate()
  const update = useUpdateProfile()
  const [step, setStep] = useState(0)
  const [name, setName] = useState(profile.displayName ?? '')
  const [sex, setSex] = useState<'M' | 'F' | 'O' | null>(profile.sex)
  const [birth, setBirth] = useState(profile.birthDate ?? '')
  const [height, setHeight] = useState(profile.heightCm ? String(profile.heightCm) : '')
  const [experience, setExperience] = useState<Experience>(profile.experience)
  const [goal, setGoal] = useState<Goal>(profile.trainingGoal)
  const [days, setDays] = useState(profile.weeklyTarget || 4)
  const [error, setError] = useState<string | null>(null)

  const heightNum = height ? Number(height.replace(',', '.')) : null
  const heightOk = heightNum === null || (heightNum >= 120 && heightNum <= 230)
  const [today] = useState(() => new Date().toISOString().slice(0, 10))
  const birthOk = !birth || (birth >= '1920-01-01' && birth <= today)
  const step0Ok = name.trim().length > 0 && heightOk && birthOk

  const finish = async () => {
    setError(null)
    try {
      await update.mutateAsync({
        displayName: name.trim(),
        sex,
        birthDate: birth || null,
        heightCm: heightNum === null ? null : Math.round(heightNum),
        experience,
        trainingGoal: goal,
        weeklyTarget: days,
        onboarded: true,
      })
      nav('/programs', { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar. Revisa la conexión.')
    }
  }

  const next = () => (step < STEPS.length - 1 ? setStep(step + 1) : void finish())

  return (
    <div className="safe-top mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-6">
      <header className="flex items-center gap-3 pt-4">
        <BrandMark className="size-8" />
        <div className="flex flex-1 gap-1.5" aria-label={`Paso ${step + 1} de ${STEPS.length}`}>
          {STEPS.map((s, i) => (
            <span
              key={s}
              className={clsx('h-1 flex-1 rounded-full', i <= step ? 'bg-gold' : 'bg-panel-3')}
            />
          ))}
        </div>
        <span className="spec">
          {step + 1}/{STEPS.length}
        </span>
      </header>

      <main className="flex-1 pt-8">
        {step === 0 && (
          <Step
            title="Empecemos por ti"
            lead="Lo justo para ajustar los cálculos y los estándares de fuerza a ti."
          >
            <div className="flex flex-col gap-4">
              <Field label="Cómo te llamamos">
                {(id) => (
                  <Input
                    id={id}
                    value={name}
                    autoComplete="given-name"
                    maxLength={40}
                    onChange={(e) => setName(e.target.value)}
                  />
                )}
              </Field>
              <div>
                <div className="mb-1.5 text-[13px] font-medium text-ink-2">Sexo</div>
                <Segmented
                  value={sex ?? 'none'}
                  onChange={(v) => setSex(v === 'none' ? null : v)}
                  options={[
                    { value: 'M', label: 'Hombre' },
                    { value: 'F', label: 'Mujer' },
                    { value: 'O', label: 'Otro' },
                  ]}
                />
                <p className="mt-1 text-[12.5px] text-muted">
                  Ajusta los estándares de fuerza y el gasto calórico.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nacimiento" error={birthOk ? undefined : 'Fecha no válida'}>
                  {(id) => (
                    <Input
                      id={id}
                      type="date"
                      value={birth}
                      max={today}
                      invalid={!birthOk}
                      onChange={(e) => setBirth(e.target.value)}
                    />
                  )}
                </Field>
                <Field label="Altura" error={heightOk ? undefined : 'Entre 120 y 230 cm'}>
                  {(id) => (
                    <Input
                      id={id}
                      inputMode="numeric"
                      suffix="cm"
                      value={height}
                      invalid={!heightOk}
                      onChange={(e) => setHeight(e.target.value.replace(/[^\d.,]/g, ''))}
                    />
                  )}
                </Field>
              </div>
            </div>
          </Step>
        )}

        {step === 1 && (
          <Step
            title="¿Cuánto llevas entrenando?"
            lead="Decide cuánto volumen te propongo y lo rápido que subimos peso."
          >
            <Choices
              value={experience}
              onChange={setExperience}
              options={(['novice', 'intermediate', 'advanced'] as const).map((l) => ({
                value: l,
                title: EXPERIENCE_LABEL[l],
                text: LEVEL_TEXT[l],
              }))}
            />
          </Step>
        )}

        {step === 2 && (
          <Step title="¿Qué buscas?" lead="Puedes cambiarlo cuando quieras en Ajustes.">
            <Choices
              value={goal}
              onChange={setGoal}
              options={GOAL_ORDER.map((g) => ({
                value: g,
                title: GOAL_LABEL[g],
                text: GOAL_TEXT[g],
              }))}
            />
          </Step>
        )}

        {step === 3 && (
          <Step
            title="¿Cuántos días por semana?"
            lead="Los que de verdad puedes cumplir. Mejor 3 fijos que 5 a medias."
          >
            <div className="flex items-baseline justify-center gap-2 py-6">
              <span className="readout text-[72px] font-semibold leading-none text-gold-light">
                {days}
              </span>
              <span className="text-[15px] text-muted">{days === 1 ? 'día' : 'días'}</span>
            </div>
            <div className="grid grid-cols-6 gap-1.5">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={days === n}
                  aria-label={`${n} ${n === 1 ? 'día' : 'días'} por semana`}
                  onClick={() => setDays(n)}
                  className={clsx(
                    'readout h-12 rounded-[8px] border text-[20px] font-semibold',
                    days === n
                      ? 'border-gold bg-signal-soft text-gold'
                      : 'border-line bg-panel-2 text-ink-2',
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="mt-3 text-[13px] text-muted">
              {days <= 2
                ? 'Cuerpo completo: lo justo para mantener y avanzar despacio.'
                : days <= 4
                  ? 'Torso / pierna o cuerpo completo: el mejor equilibrio entre progreso y vida.'
                  : 'Rutina dividida con más volumen por músculo. Exige dormir y comer bien.'}
            </p>
          </Step>
        )}
      </main>

      {error && (
        <p role="alert" className="mb-3 text-[13px] text-danger">
          {error}
        </p>
      )}
      <footer className="safe-bottom flex gap-2">
        {step > 0 && (
          <Button variant="secondary" size="lg" onClick={() => setStep(step - 1)}>
            Atrás
          </Button>
        )}
        <Button
          size="lg"
          className="flex-1"
          disabled={step === 0 && !step0Ok}
          loading={update.isPending}
          onClick={next}
        >
          {step === STEPS.length - 1 ? 'Ver programas' : 'Seguir'}
        </Button>
      </footer>
    </div>
  )
}

function Step({ title, lead, children }: { title: string; lead: string; children: ReactNode }) {
  return (
    <section className="fade-up">
      <h1 className="font-display text-[30px] font-semibold uppercase leading-[1.05] tracking-[0.04em]">
        {title}
      </h1>
      <p className="mb-6 mt-2 text-[14px] text-muted">{lead}</p>
      {children}
    </section>
  )
}

function Choices<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; title: string; text: string }[]
}) {
  return (
    <div role="radiogroup" className="flex flex-col gap-2">
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={clsx(
              'flex min-h-[64px] w-full items-start gap-3 rounded-[10px] border px-4 py-3 text-left transition',
              on ? 'border-gold/60 bg-signal-soft' : 'border-line bg-panel',
            )}
          >
            <span className="min-w-0 flex-1">
              <span className={clsx('block text-[16px] font-semibold', on && 'text-gold-light')}>
                {o.title}
              </span>
              <span className="mt-0.5 block text-[13px] leading-snug text-muted">{o.text}</span>
            </span>
            <span
              aria-hidden
              className={clsx(
                'mt-0.5 grid size-5 shrink-0 place-items-center rounded-[5px] border',
                on ? 'border-gold bg-gold text-signal-ink' : 'border-line-strong',
              )}
            >
              {on && <Check className="size-3.5" />}
            </span>
          </button>
        )
      })}
    </div>
  )
}
