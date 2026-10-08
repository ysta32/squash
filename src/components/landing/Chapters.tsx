import type { ResolvedTheme } from '../../lib/theme'
import { cn } from '../../lib/utils'
import { MK_CONTAINER } from '../marketing/MarketingLayout'
import { Reveal } from '../marketing/Reveal'
import { CaptureDemo } from './CaptureDemo'
import { CHAPTERS, type Chapter } from './content'
import { DrawerFrame, MarkerStroke, ShotImage } from './Frames'
import { Band, SectionHead } from './Section'

function ChapterRow({
  chapter,
  flip,
  theme,
}: {
  chapter: Chapter
  flip: boolean
  theme: ResolvedTheme
}) {
  const headingId = `chapter-${chapter.id}`
  return (
    <article
      aria-labelledby={headingId}
      className="grid items-start gap-10 border-t border-line pt-12 lg:grid-cols-12 lg:gap-8 lg:pt-16"
    >
      <Reveal className={cn('lg:col-span-5', flip ? 'lg:order-2 lg:col-start-8' : 'lg:pr-8')}>
        <p className="specimen-label text-ink-3">
          <span className="text-accent">{chapter.number}</span> · {chapter.name}
        </p>
        <h3
          id={headingId}
          className="mt-3 text-2xl font-semibold tracking-[-0.02em] text-balance lg:text-[2.25rem]/[2.6rem]"
        >
          {chapter.title}
        </h3>
        <p className="mt-4 max-w-[56ch] text-read text-pretty text-ink-2">{chapter.body}</p>
        <ul className="mt-8 border-b border-line">
          {chapter.facts.map((fact) => (
            <li key={fact} className="border-t border-line py-2.5 text-sm text-ink-2">
              {fact}
            </li>
          ))}
        </ul>
      </Reveal>
      <Reveal delay={80} className={cn('lg:col-span-7', flip && 'lg:order-1')}>
        <figure>
          <DrawerFrame>
            <ShotImage shot={chapter.shot} theme={theme} />
            <MarkerStroke shot={chapter.shot} marker={chapter.marker} />
          </DrawerFrame>
          <figcaption className="specimen-label mt-3 flex items-center gap-2 text-ink-3">
            <span aria-hidden="true" className="h-0.5 w-4 rounded-xs bg-markup" />
            Marked: {chapter.marker.label}
          </figcaption>
        </figure>
        {chapter.id === 'capture' && (
          <div className="mt-12 max-w-xl lg:mt-16">
            <p className="specimen-label mb-3 text-ink-3">Try it · a working capture bar</p>
            <CaptureDemo />
          </div>
        )}
      </Reveal>
    </article>
  )
}

export function Chapters({ theme }: { theme: ResolvedTheme }) {
  return (
    <Band id="features" labelledBy="features-heading">
      <div className={MK_CONTAINER}>
        <Reveal>
          <SectionHead id="features-heading" eyebrow="How it works" title="Capture, mark up, fix.">
            <p>
              Three steps, one screen. Each picture below is the real app with the demo workspace.
            </p>
          </SectionHead>
        </Reveal>
        <div className="mt-12 space-y-16 lg:mt-16 lg:space-y-28">
          {CHAPTERS.map((chapter, i) => (
            <ChapterRow key={chapter.id} chapter={chapter} flip={i % 2 === 1} theme={theme} />
          ))}
        </div>
      </div>
    </Band>
  )
}
