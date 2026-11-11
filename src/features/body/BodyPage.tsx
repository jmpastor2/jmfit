import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import { Segmented } from '@/components/ui/primitives'
import { StateView } from '@/features/state/StatePage'
import { useDayStates } from '@/features/state/useDayStates'
import { CompositionView } from './CompositionView'
import { RecoveryView } from './RecoveryView'

type View = 'state' | 'composition'

/**
 * «Cuerpo», the body's side of the app next to Entrenar: «Estado» (recovery, strain and sleep
 * from the band; the check-in recovery without one) and Boditrax composition. `?v=composition`
 * opens the second.
 */
export function BodyPage() {
  const [params, setParams] = useSearchParams()
  const view: View = params.get('v') === 'composition' ? 'composition' : 'state'
  const band = useDayStates(28) != null
  return (
    <>
      <PageHeader
        large
        title="Cuerpo"
        eyebrow={view === 'composition' ? 'Boditrax' : band ? 'Pulsera · hoy' : 'Recuperación'}
      />
      <Segmented
        className="mb-5"
        value={view}
        onChange={(v) => setParams(v === 'composition' ? { v } : {}, { replace: true })}
        options={[
          { value: 'state', label: 'Estado' },
          { value: 'composition', label: 'Composición' },
        ]}
      />
      {view === 'composition' ? <CompositionView /> : band ? <StateView /> : <RecoveryView />}
    </>
  )
}
