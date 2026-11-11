import { useQueryClient } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Meter } from '@/components/kpi/Meter'
import { useHealthDays, useMe, useUid } from '@/data/hooks'
import { formatNumber } from '@/domain/training'
import { syncGoogleHealth } from '@/lib/googleHealth'
import { requireSupabase } from '@/lib/supabase'
import { foodSummary, type FoodDay } from './nutrition'

/**
 * Food logged in Google Health against the targets: today so far, yesterday and the week. The
 * band syncs at 08:00; «Actualizar» brings in what was logged since. Hidden until food appears.
 */
export function FoodBlock({ now, bodyweight }: { now: Date; bodyweight: number | null }) {
  const me = useMe()
  const uid = useUid()
  const qc = useQueryClient()
  const days = useHealthDays().data
  const [syncing, setSyncing] = useState(false)
  const s = useMemo(
    () =>
      foodSummary(days ?? [], now, { kcal: me.targetKcal, protein: me.targetProtein }, bodyweight),
    [days, now, me.targetKcal, me.targetProtein, bodyweight],
  )
  if (!s) return null

  const refresh = async () => {
    setSyncing(true)
    try {
      await syncGoogleHealth(requireSupabase())
      await qc.invalidateQueries({ queryKey: ['health', uid] })
    } catch {
      /* the block keeps what it had; Ajustes → Salud shows the connection error */
    } finally {
      setSyncing(false)
    }
  }

  const shortProtein =
    s.week?.protein != null && s.proteinTarget != null && s.week.protein < s.proteinTarget * 0.9
      ? s.proteinTarget - s.week.protein
      : null

  return (
    <section className="border-t border-line py-5">
      <div className="mb-3 flex min-h-11 items-center justify-between gap-3">
        <h2 className="spec text-ink-2">Comida</h2>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={syncing}
          className="spec tap-link flex items-center gap-1 text-gold disabled:text-muted"
        >
          <RefreshCw className={syncing ? 'size-3.5 animate-spin' : 'size-3.5'} aria-hidden />
          Actualizar
        </button>
      </div>
      <FoodRow
        label="Hoy"
        day={s.today}
        kcalTarget={s.kcalTarget}
        proteinTarget={s.proteinTarget}
      />
      <FoodRow
        label="Ayer"
        day={s.yesterday}
        kcalTarget={s.kcalTarget}
        proteinTarget={s.proteinTarget}
      />
      {s.week && (
        <p className="mt-3 text-[13px] text-ink-2">
          Media de {s.week.days} {s.week.days === 1 ? 'día' : 'días'} con registro:{' '}
          <span className="readout text-[15px] font-semibold text-ink">
            {formatNumber(s.week.kcal)}
          </span>{' '}
          kcal
          {s.week.protein != null && (
            <>
              {' · '}
              <span className="readout text-[15px] font-semibold text-ink">{s.week.protein}</span> g
              de proteína
            </>
          )}
        </p>
      )}
      {shortProtein != null && (
        <p className="mt-2 border-l-2 border-warn pl-3 text-[13px] leading-snug">
          Te faltan unos {shortProtein} g de proteína al día para tu objetivo: con lo que pierdes de
          masa magra, es lo primero que subir.
        </p>
      )}
      <p className="mt-2 text-[12px] text-muted">
        De lo que apuntas en Google Health.
        {s.proteinTarget != null &&
          (s.proteinEstimated
            ? ` Proteína objetivo: ${s.proteinTarget} g (1,8 g por kg; cámbiala en Ajustes).`
            : '')}
        {s.kcalTarget == null && ' Pon tus calorías objetivo en Ajustes para compararlas.'}
      </p>
    </section>
  )
}

function FoodRow({
  label,
  day,
  kcalTarget,
  proteinTarget,
}: {
  label: string
  day: FoodDay | null
  kcalTarget: number | null
  proteinTarget: number | null
}) {
  return (
    <div className="mb-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[14px]">{label}</span>
        <span className="text-[13px] text-muted">
          {day ? (
            <>
              <span className="readout text-[17px] font-semibold text-ink">
                {formatNumber(day.kcal)}
              </span>
              {kcalTarget ? ` / ${formatNumber(kcalTarget)}` : ''} kcal
              {day.protein != null && (
                <>
                  {' · '}
                  <span className="readout text-[17px] font-semibold text-ink">
                    {Math.round(day.protein)}
                  </span>
                  {proteinTarget ? ` / ${proteinTarget}` : ''} g prot.
                </>
              )}
            </>
          ) : (
            'sin registrar'
          )}
        </span>
      </div>
      {day && proteinTarget != null && day.protein != null && (
        <Meter
          className="mt-1.5"
          value={day.protein}
          max={proteinTarget}
          height={4}
          label={`${label}: ${Math.round(day.protein)} de ${proteinTarget} g de proteína`}
        />
      )}
    </div>
  )
}
