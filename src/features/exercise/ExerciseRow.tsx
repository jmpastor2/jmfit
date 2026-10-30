import { clsx } from 'clsx'
import { Dumbbell, Play } from 'lucide-react'
import { EQUIPMENT_LABEL, MUSCLE_LABEL } from '@/content/exercises'
import { Button } from '@/components/ui/Button'
import type { Exercise } from '@/domain/types'
import { VideoPlayer } from './VideoPlayer'

/** YouTube's 320×180 still (≈10 kB). Cached by the service worker, so it also shows offline. */
export const thumbUrl = (e: Exercise) =>
  e.videos[0] ? `https://i.ytimg.com/vi/${e.videos[0].youtubeId}/mqdefault.jpg` : null

/** Small still of the technique video, or a plain tile for an exercise without one. */
export function ExerciseThumb({ exercise, className }: { exercise: Exercise; className?: string }) {
  const src = thumbUrl(exercise)
  return (
    <span
      className={clsx(
        'relative grid aspect-video shrink-0 place-items-center overflow-hidden rounded-[6px] border border-line bg-panel-2',
        className,
      )}
    >
      {src ? (
        <>
          <img
            src={src}
            alt=""
            loading="lazy"
            decoding="async"
            crossOrigin="anonymous"
            className="absolute inset-0 size-full object-cover opacity-80 grayscale-[35%]"
          />
          <Play className="relative size-3.5 fill-gold text-gold drop-shadow" aria-hidden />
        </>
      ) : (
        <Dumbbell className="size-4 text-muted" aria-hidden />
      )}
    </span>
  )
}

export function ExerciseLine({ exercise, detail }: { exercise: Exercise; detail?: string }) {
  return (
    <span className="min-w-0">
      <span className="block text-[15px] font-medium leading-snug">{exercise.name}</span>
      <span className="block text-[12.5px] text-muted">
        {detail ??
          [
            ...exercise.primary.map((m) => MUSCLE_LABEL[m]),
            EQUIPMENT_LABEL[exercise.equipment],
          ].join(' · ')}
      </span>
    </span>
  )
}

/**
 * One exercise in a list. Tapping the still opens a preview right there (video and key
 * cues) without leaving the list or picking it; tapping the name does the row's action.
 */
export function ExerciseRow({
  exercise,
  detail,
  open,
  onPreview,
  onSelect,
  selectLabel,
}: {
  exercise: Exercise
  /** Second line instead of the muscles (e.g. why it is suggested). */
  detail?: string
  open: boolean
  onPreview: () => void
  onSelect: () => void
  /** The action button inside the preview. */
  selectLabel: string
}) {
  const video = exercise.videos[0]
  const cues = exercise.cues.slice(0, 3)
  const previewable = Boolean(video) || cues.length > 0
  return (
    <li>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onPreview}
          disabled={!previewable}
          aria-expanded={open}
          aria-label={`Vista previa: ${exercise.name}`}
          className="-my-px py-2.5 active:opacity-70"
        >
          <ExerciseThumb exercise={exercise} className={clsx('w-[72px]', open && 'border-gold')} />
        </button>
        <button
          type="button"
          onClick={onSelect}
          className="flex min-h-[60px] min-w-0 flex-1 items-center text-left active:opacity-70"
        >
          <ExerciseLine exercise={exercise} {...(detail ? { detail } : {})} />
        </button>
      </div>
      {open && (
        <div className="flex flex-col gap-3 pb-4 pt-1">
          {video && <VideoPlayer key={video.youtubeId} video={video} />}
          {cues.length > 0 && (
            <ol className="flex flex-col gap-1.5">
              {cues.map((c, i) => (
                <li key={c} className="flex gap-2.5 text-[13.5px] leading-snug">
                  <span className="readout w-4 shrink-0 text-[15px] text-gold">{i + 1}</span>
                  <span>{c}</span>
                </li>
              ))}
            </ol>
          )}
          <Button block onClick={onSelect}>
            {selectLabel}
          </Button>
        </div>
      )}
    </li>
  )
}
