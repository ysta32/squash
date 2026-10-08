import type { CSSProperties } from 'react'
import { facts } from '../marketing/facts'
import type { ResolvedTheme } from '../../lib/theme'
import { cn } from '../../lib/utils'
import { MK_CONTAINER, OpenWorkspaceLink } from '../marketing/MarketingLayout'
import { TypedSpecimenLabel } from '../marketing/TypedSpecimenLabel'
import { buttonClass, SpecimenLabel } from '../ui'
import { HERO_LABEL, HERO_SHOT } from './content'
import { DrawerFrame, ShotImage } from './Frames'

export function Hero({ theme }: { theme: ResolvedTheme }) {
  return (
    <section
      aria-labelledby="hero-heading"
      className="cabinet-light relative isolate overflow-hidden"
    >
      <div
        aria-hidden="true"
        className="mk-ruled pointer-events-none absolute inset-0 -z-10 opacity-40"
      />
      <div
        className={cn(
          MK_CONTAINER,
          'grid gap-y-14 pt-14 pb-16 sm:pt-20 lg:pb-24 xl:grid-cols-12 xl:gap-x-8 xl:pt-24 xl:pb-28',
        )}
      >
        <div className="relative z-10 xl:col-span-5">
          <h1
            id="hero-heading"
            className="text-[2.75rem]/[2.9rem] font-semibold tracking-[-0.035em] text-balance sm:text-display-m lg:text-display-l"
          >
            Bug reports your cofounder actually reads.
          </h1>
          <p className="mt-6 max-w-[44ch] text-read text-pretty text-ink-2 sm:text-lg sm:leading-8">
            A bug tracker for teams of 2–10. Paste a screenshot, say what broke, press Enter: it is
            on your teammate’s screen about a second later, and Claude Code can fix it from there.
          </p>
          <TypedSpecimenLabel delay={200} lines={HERO_LABEL} className="mt-8" />
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <OpenWorkspaceLink size="lg" />
            <a href="#self-host" className={buttonClass('secondary', 'lg')}>
              Self-host it
            </a>
          </div>
          <SpecimenLabel
            segments={[facts.license, 'Self-host on Supabase', 'No trackers']}
            className="mt-6 text-ink-3"
          />
        </div>
        {/* Bleeds off the right edge: the bug list stays readable, the detail pane runs out of frame. */}
        <div className="xl:col-span-7 xl:col-start-6 xl:pt-2">
          <div
            className="mk-rise w-[175%] sm:w-[130%] lg:w-[115%] xl:w-[64vw]"
            style={{ '--mk-delay': '520ms' } as CSSProperties}
          >
            <DrawerFrame>
              <ShotImage shot={HERO_SHOT} theme={theme} lazy={false} />
            </DrawerFrame>
          </div>
        </div>
      </div>
    </section>
  )
}
