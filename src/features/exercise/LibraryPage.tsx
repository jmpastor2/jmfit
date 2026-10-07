import { Play } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { MUSCLE_LABEL, TRENDING } from '@/content/exercises'
import { PageHeader } from '@/components/layout/PageHeader'
import { Chip, SectionTitle } from '@/components/ui/primitives'
import { useActiveProgram } from '@/data/hooks'
import type { Exercise } from '@/domain/types'
import { ExerciseFilters, ExerciseLine, filterExercises } from './ExercisePicker'
import { useAllExercises, useExerciseLookup } from './lookup'

const thumb = (e: Exercise) =>
  e.videos[0] ? `https://i.ytimg.com/vi/${e.videos[0].youtubeId}/mqdefault.jpg` : null

/** Training videos and the exercise catalog: learn the technique, open the history. */
export function LibraryPage() {
  const all = useAllExercises()
  const lookup = useExerciseLookup()
  const { program } = useActiveProgram()
  const [q, setQ] = useState('')
  const [group, setGroup] = useState<number | null>(null)
  const [withVideo, setWithVideo] = useState(false)
  const [trendOnly, setTrendOnly] = useState(false)

  const list = useMemo(
    () =>
      filterExercises(all, q, group).filter(
        (e) => (!withVideo || e.videos.length > 0) && (!trendOnly || e.trend),
      ),
    [all, q, group, withVideo, trendOnly],
  )
  const videoCount = useMemo(() => all.filter((e) => e.videos.length > 0).length, [all])

  // Exercises of the active program that have a video, in program order.
  const learn = useMemo(() => {
    if (!program) return []
    const seen = new Set<string>()
    const out: Exercise[] = []
    for (const d of program.days) {
      for (const s of d.slots) {
        if (seen.has(s.exerciseId)) continue
        seen.add(s.exerciseId)
        const e = lookup(s.exerciseId)
        if (e.videos.length) out.push(e)
      }
    }
    return out
  }, [program, lookup])

  const filtering = q.trim() !== '' || group !== null || withVideo || trendOnly

  return (
    <>
      <PageHeader
        back
        title="Biblioteca"
        subtitle={`${all.length} ejercicios · ${videoCount} con vídeo de técnica`}
      />

      {TRENDING.length > 0 && !filtering && (
        <section className="mb-6">
          <SectionTitle>Novedades · lo que se lleva</SectionTitle>
          <p className="-mt-1 mb-3 px-1 text-[13px] text-muted">
            Variantes que han popularizado los divulgadores, con el porqué de cada una.
          </p>
          <div className="hide-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1">
            {TRENDING.map((e) => (
              <TrendCard key={e.id} exercise={e} />
            ))}
          </div>
        </section>
      )}

      {learn.length > 0 && !filtering && (
        <section className="mb-6">
          <SectionTitle>Aprende la técnica</SectionTitle>
          <p className="-mt-1 mb-3 px-1 text-[13px] text-muted">
            Los ejercicios de {program?.name ?? 'tu programa'}. Mira el vídeo antes de cargar.
          </p>
          <div className="hide-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1">
            {learn.map((e) => (
              <Link key={e.id} to={`/exercise/${e.id}`} className="w-[200px] shrink-0 snap-start">
                <Thumb exercise={e} />
                <span className="mt-1.5 block text-[14px] font-medium leading-snug">{e.name}</span>
                <span className="block text-[12px] text-muted">
                  {e.primary.map((m) => MUSCLE_LABEL[m]).join(' · ')}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* The chip row bleeds to the screen edge; clip it there so the page never scrolls sideways. */}
      <div className="-mx-4 overflow-x-clip px-4 pb-1">
        <ExerciseFilters q={q} onQ={setQ} group={group} onGroup={setGroup} />
        <div className="-mt-1 flex items-center justify-between gap-2">
          <div className="flex gap-2">
            <Chip active={trendOnly} onClick={() => setTrendOnly((v) => !v)}>
              Novedades
            </Chip>
            <Chip active={withVideo} onClick={() => setWithVideo((v) => !v)}>
              Con vídeo
            </Chip>
          </div>
          <span className="text-[12.5px] text-muted">{list.length} resultados</span>
        </div>
      </div>

      <ul className="divide-y divide-line">
        {list.map((e) => {
          const src = thumb(e)
          return (
            <li key={e.id}>
              <Link
                to={`/exercise/${e.id}`}
                className="flex min-h-[52px] items-center gap-3 py-2.5 active:bg-panel-2"
              >
                {src ? (
                  <span className="relative block aspect-video w-[88px] shrink-0 overflow-hidden rounded-[6px] border border-line bg-black">
                    <img
                      src={src}
                      alt=""
                      loading="lazy"
                      className="absolute inset-0 size-full object-cover opacity-80 grayscale-[35%]"
                    />
                  </span>
                ) : (
                  <span
                    aria-hidden
                    className="block aspect-video w-[88px] shrink-0 rounded-[6px] bg-panel-2"
                  />
                )}
                <ExerciseLine exercise={e} />
              </Link>
            </li>
          )
        })}
        {!list.length && (
          <li className="py-10 text-center text-[14px] text-muted">
            {trendOnly || withVideo
              ? 'Ningún ejercicio encaja con la búsqueda y los filtros.'
              : 'Sin resultados. Prueba con otro nombre.'}
          </li>
        )}
      </ul>
    </>
  )
}

function Thumb({ exercise }: { exercise: Exercise }) {
  const src = thumb(exercise)
  return (
    <span className="relative block aspect-video overflow-hidden rounded-[8px] border border-line bg-black">
      {src && (
        <img
          src={src}
          alt=""
          loading="lazy"
          className="absolute inset-0 size-full object-cover opacity-75 grayscale-[35%]"
        />
      )}
      <span className="absolute bottom-2 left-2 grid size-8 place-items-center rounded-full border border-gold bg-black/70 text-gold">
        <Play className="ml-0.5 size-3.5 fill-current" />
      </span>
    </span>
  )
}

/** «Novedades» card: thumbnail, name, who popularised it and why it works. */
function TrendCard({ exercise: e }: { exercise: Exercise }) {
  if (!e.trend) return null
  return (
    <Link to={`/exercise/${e.id}`} className="w-[240px] shrink-0 snap-start">
      <Thumb exercise={e} />
      <span className="mt-1.5 block text-[14px] font-medium leading-snug">{e.name}</span>
      <span className="spec mt-1 block text-gold">Popularizado por {e.trend.by}</span>
      <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-2">{e.trend.why}</span>
    </Link>
  )
}
