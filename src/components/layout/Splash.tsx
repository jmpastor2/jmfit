import { BrandMark } from '@/features/auth/BrandMark'
import { Button } from '../ui/Button'

export function Splash({ error }: { error?: string }) {
  return (
    <div className="grid min-h-dvh place-items-center px-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <BrandMark className="size-16" />
        <div>
          <div className="font-display text-[26px] font-semibold uppercase tracking-[0.3em]">
            Forja
          </div>
          <div className="spec text-signal">Entrena con datos</div>
        </div>
        {error ? (
          <>
            <p className="max-w-xs text-[13px] text-danger">{error}</p>
            <Button variant="secondary" onClick={() => window.location.reload()}>
              Reintentar
            </Button>
          </>
        ) : (
          <div
            role="status"
            aria-label="Cargando"
            className="mt-2 size-5 animate-spin rounded-full border-2 border-signal border-t-transparent"
          />
        )}
      </div>
    </div>
  )
}
