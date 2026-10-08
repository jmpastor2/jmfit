import { BellRing } from 'lucide-react'
import { useState } from 'react'
import { Switch } from '@/components/ui/primitives'
import { useToast } from '@/components/ui/Toast'
import { disablePush, enablePush, PushError, pushEnabledHere, pushSupport } from '@/lib/push'

const ERRORS: Record<string, string> = {
  denied: 'Has bloqueado las notificaciones: actívalas en Ajustes del iPhone → Forja',
  'no-sw': 'Abre la app instalada para activar los avisos',
  'no-key': 'Los avisos no están configurados',
  server: 'No se pudo guardar el aviso; prueba otra vez',
}

/**
 * «Avisarme al acabar el descanso» with the phone locked. Compact form for the rest panel
 * (one tap, hidden once on), full row for Ajustes.
 */
export function RestPushToggle({ compact = false }: { compact?: boolean }) {
  const { toast } = useToast()
  const support = pushSupport()
  const [on, setOn] = useState(pushEnabledHere)
  const [busy, setBusy] = useState(false)

  const toggle = async (next: boolean) => {
    setBusy(true)
    try {
      if (next) await enablePush()
      else await disablePush()
      setOn(next)
      if (next) toast('Te avisaremos al acabar cada descanso', 'success')
    } catch (e) {
      toast(e instanceof PushError ? (ERRORS[e.code] ?? e.message) : 'No se pudo activar', 'warn')
    } finally {
      setBusy(false)
    }
  }

  if (compact) {
    if (on || support !== 'ok') return null
    return (
      <button
        type="button"
        disabled={busy}
        onClick={() => void toggle(true)}
        className="mx-auto mt-2 flex max-w-2xl items-center gap-2 px-4 text-[12.5px] text-gold"
      >
        <BellRing className="size-3.5" /> Avisarme aunque bloquee el móvil
      </button>
    )
  }

  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <div className="text-[15px] font-medium">Aviso al acabar el descanso</div>
        <div className="text-[12.5px] text-muted">
          {support === 'ios-install'
            ? 'En iPhone funciona desde la app instalada (Compartir → Añadir a pantalla de inicio).'
            : support === 'unsupported'
              ? 'Este navegador no admite notificaciones.'
              : 'Notificación aunque tengas el móvil bloqueado o estés en otra app.'}
        </div>
      </div>
      <Switch
        checked={on}
        disabled={busy || support !== 'ok'}
        onChange={(v) => void toggle(v)}
        label="Aviso al acabar el descanso"
      />
    </div>
  )
}
