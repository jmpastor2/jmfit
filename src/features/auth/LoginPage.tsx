import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { getSupabase } from '@/lib/supabase'
import { BrandMark } from './BrandMark'
import { useSession } from './SessionProvider'

/** Sign in with the existing email and password; a reset link for a forgotten one. */
export function LoginPage() {
  const { status } = useSession()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  if (status === 'signed_in') return <Navigate to="/" replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const sb = getSupabase()
    if (!sb) return
    setBusy(true)
    setError(null)
    const res = await sb.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    const msg = res.error?.message
    if (msg) setError(msg === 'Invalid login credentials' ? 'Email o contraseña incorrectos' : msg)
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
        <Field label="Contraseña">
          {(id) => (
            <Input
              id={id}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          )}
        </Field>
        {error && <p className="text-[13px] text-danger">{error}</p>}
        {notice && <p className="text-[13px] text-signal">{notice}</p>}
        <Button type="submit" size="lg" block loading={busy} className="mt-2">
          Entrar
        </Button>
        <button type="button" onClick={reset} className="spec tap-link self-center">
          He olvidado la contraseña
        </button>
      </form>
    </div>
  )
}
