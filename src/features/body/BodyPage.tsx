import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import { Segmented } from '@/components/ui/primitives'
import { CompositionView } from './CompositionView'
import { RecoveryView } from './RecoveryView'

type View = 'composition' | 'recovery'

/** «Cuerpo»: Boditrax composition and wearable/check-in recovery. `?v=recovery` opens the second. */
export function BodyPage() {
  const [params, setParams] = useSearchParams()
  const view: View = params.get('v') === 'recovery' ? 'recovery' : 'composition'
  return (
    <>
      <PageHeader
        large
        title="Cuerpo"
        eyebrow={view === 'composition' ? 'Boditrax' : 'Recuperación'}
      />
      <Segmented
        className="mb-5"
        value={view}
        onChange={(v) => setParams(v === 'recovery' ? { v } : {}, { replace: true })}
        options={[
          { value: 'composition', label: 'Composición' },
          { value: 'recovery', label: 'Recuperación' },
        ]}
      />
      {view === 'composition' ? <CompositionView /> : <RecoveryView />}
    </>
  )
}
