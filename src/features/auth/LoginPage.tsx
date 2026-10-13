import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { getSupabase } from '@/lib/supabase'
import { BrandMark } from './BrandMark'
import { useSession } from './SessionProvider'

type Mode = 'signin' | 'request'

/**
 * Sign in with the existing email and password, or ask for access: a new account waits,
 * pending, until it is approved. A reset link for a forgotten password.
 */
export function LoginPage() {
  const { status } = useSession()
  const [mode, setMode] = useState<Mode>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  if (status === 'signed_in') return <Navigate to="/" replace />

  const switchTo = (next: Mode) => {
    setMode(next)
    setError(null)
    setNotice(null)
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const sb = getSupabase()
    if (!sb) return
    setBusy(true)
    setError(null)
    setNotice(null)
    if (mode === 'signin') {
      const res = await sb.auth.signInWithPassword({ email: email.trim(), password })
      setBusy(false)
      const msg = res.error?.message
      if (msg)
        setError(msg === 'Invalid login credentials' ? 'Email o contraseña incorrectos' : msg)
      return
    }
    const res = await sb.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: window.location.origin + window.location.pathname,
        data: { display_name: name.trim() },
      },
    })
    setBusy(false)
    const msg = res.error?.message
    if (msg) {
      setError(
        /already registered|exists/i.test(msg)
          ? 'Ya hay una cuenta con ese email: entra con ella'
          : /password/i.test(msg)
            ? 'La contraseña necesita al menos 8 caracteres'
            : msg,
      )
    } else if (!res.data.session) {
      setNotice('Solicitud enviada. Confirma tu email para continuar')
    }
  }

  const reset = async () => {
    const sb = getSupabase()
    if (!sb || !email.trim()) {
      setError('Escribe tu email y vuelve a pulsar')
      return
    }
    const res = await sb.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin + window.location.pathname,
    })
    if (res.error) setError(res.error.message)
    else setNotice('Te hemos enviado un enlace para crear una contraseña nueva')
  }

  const requesting = mode === 'request'
  return (
    <div className="safe-top mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 pb-10">
      <div className="mb-12 flex flex-col items-center text-center">
        <BrandMark className="size-16" />
        <h1 className="mt-6 font-display text-[34px] font-semibold uppercase tracking-[0.32em] text-ink">
          Forja
        </h1>
        <p className="mt-2 text-[12px] uppercase tracking-[0.28em] text-signal">
          Entrena con datos
        </p>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-4">
        {requesting && (
          <div>
            <h2 className="font-display text-[22px] font-semibold uppercase tracking-[0.06em]">
              Solicitar acceso
            </h2>
            <p className="mt-1 text-[13.5px] leading-snug text-muted">
              Forja es privada: tu cuenta quedará pendiente hasta que la aprueben.
            </p>
          </div>
        )}
        {requesting && (
          <Field label="Nombre">
            {(id) => (
              <Input
                id={id}
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            )}
          </Field>
        )}
        <Field label="Email">
          {(id) => (
            <Input
              id={id}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          )}
        </Field>
        <Field label="Contraseña" hint={requesting ? 'Mínimo 8 caracteres' : undefined}>
          {(id) => (
            <Input
              id={id}
              type="password"
              autoComplete={requesting ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={requesting ? 8 : undefined}
              required
            />
          )}
        </Field>
        {error && <p className="text-[13px] text-danger">{error}</p>}
        {notice && <p className="text-[13px] text-signal">{notice}</p>}
        <Button type="submit" size="lg" block loading={busy} className="mt-2">
          {requesting ? 'Enviar solicitud' : 'Entrar'}
        </Button>
        {!requesting && (
          <button type="button" onClick={reset} className="spec tap-link self-center">
            He olvidado la contraseña
          </button>
        )}
      </form>
      <button
        type="button"
        onClick={() => switchTo(requesting ? 'signin' : 'request')}
        className="tap-link mt-10 self-center text-[14px]"
      >
        <span className="text-muted">
          {requesting ? '¿Ya tienes cuenta? ' : '¿No tienes acceso? '}
        </span>
        <span className="font-semibold text-ink">{requesting ? 'Entrar' : 'Solicitar acceso'}</span>
      </button>
    </div>
  )
}
