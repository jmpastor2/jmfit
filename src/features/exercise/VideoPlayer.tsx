import { Play } from 'lucide-react'
import { useState } from 'react'
import type { ExerciseVideo } from '@/domain/types'

/**
 * YouTube without the weight: a still thumbnail until tapped, then the privacy-enhanced player
 * (youtube-nocookie) playing inline. Until the tap only the thumbnail image is requested.
 */
export function VideoPlayer({ video }: { video: ExerciseVideo }) {
  const [playing, setPlaying] = useState(false)
  return (
    <figure>
      <div className="relative aspect-video w-full overflow-hidden rounded-[8px] border border-line bg-black">
        {playing ? (
          <iframe
            className="absolute inset-0 size-full"
            src={`https://www.youtube-nocookie.com/embed/${video.youtubeId}?autoplay=1&playsinline=1&rel=0`}
            title={video.title}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="group absolute inset-0 grid place-items-center"
            aria-label={`Reproducir: ${video.title}`}
          >
            <img
              src={`https://i.ytimg.com/vi/${video.youtubeId}/hqdefault.jpg`}
              alt=""
              loading="lazy"
              className="absolute inset-0 size-full object-cover opacity-70 grayscale-[35%] transition group-active:opacity-50"
            />
            <span className="relative grid size-14 place-items-center rounded-full border border-gold bg-black/70 text-gold">
              <Play className="ml-0.5 size-6 fill-current" />
            </span>
          </button>
        )}
      </div>
      <figcaption className="mt-2 text-[12.5px] leading-snug text-muted">
        {video.title} · <span className="text-ink-2">{video.channel}</span>
      </figcaption>
    </figure>
  )
}
