import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MUSCLE_LABEL } from '@/content/exercises'
import { Sheet } from '@/components/ui/Sheet'
import type { Exercise } from '@/domain/types'
import { VideoPlayer } from './VideoPlayer'

/** Technique at the machine: the video, the cues and the usual mistakes. */
export function TechniqueSheet({
  exercise,
  open,
  onClose,
}: {
  exercise: Exercise
  open: boolean
  onClose: () => void
}) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={exercise.name}
      description={exercise.primary.map((m) => MUSCLE_LABEL[m]).join(' · ')}
      tall
    >
      <TechniqueBody exercise={exercise} />
      <Link
        to={`/exercise/${exercise.id}`}
        onClick={onClose}
        className="spec tap-link mt-6 block text-center text-gold"
      >
        Ver historial y récords
      </Link>
    </Sheet>
  )
}

export function TechniqueBody({ exercise }: { exercise: Exercise }) {
  const [which, setWhich] = useState(0)
  const video = exercise.videos[which]
  return (
    <div className="flex flex-col gap-5">
      {video ? (
        <div>
          <VideoPlayer key={video.youtubeId} video={video} />
          {exercise.videos.length > 1 && (
            <div className="mt-2 flex gap-4">
              {exercise.videos.map((v, i) => (
                <button
                  key={v.youtubeId}
                  type="button"
                  onClick={() => setWhich(i)}
                  className={i === which ? 'spec tap-link text-gold' : 'spec tap-link'}
                >
                  {v.lang === 'es' ? 'Español' : 'Inglés'} · {v.channel}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <p className="text-[13.5px] text-muted">Este ejercicio aún no tiene vídeo verificado.</p>
      )}
      {exercise.cues.length > 0 && (
        <section>
          <h3 className="spec mb-2 text-gold">Claves</h3>
          <ol className="flex flex-col gap-2">
            {exercise.cues.map((c, i) => (
              <li key={c} className="flex gap-3 text-[14.5px] leading-snug">
                <span className="readout w-5 shrink-0 text-[17px] text-gold">{i + 1}</span>
                <span>{c}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
      {exercise.mistakes.length > 0 && (
        <section>
          <h3 className="spec mb-2">Errores frecuentes</h3>
          <ul className="flex flex-col gap-2">
            {exercise.mistakes.map((m) => (
              <li key={m} className="flex gap-3 text-[14px] leading-snug text-ink-2">
                <span className="mt-[9px] h-px w-3 shrink-0 bg-warn" />
                <span>{m}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
