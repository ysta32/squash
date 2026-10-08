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
      <div className={cn(MK_CONTAINER, 'pt-14 pb-16 sm:pt-20 lg:pb-24 xl:pt-24 xl:pb-28')}>
        {/* Copy on top, the full product frame below it: the headline and the pitch sit side by side
            from 1280px, so the screenshot can take the whole grid width and no control is cut. */}
        <div className="grid gap-y-6 xl:grid-cols-12 xl:items-end xl:gap-x-8">
          <h1
            id="hero-heading"
            className="text-[2.75rem]/[2.9rem] font-semibold tracking-[-0.035em] text-balance sm:text-display-m lg:text-display-l xl:col-span-7"
          >
            Bug reports your cofounder actually reads.
          </h1>
          <div className="xl:col-span-5 xl:pb-2">
            <p className="max-w-[44ch] text-read text-pretty text-ink-2 sm:text-lg sm:leading-8 2xl:text-[1.2857rem] 2xl:leading-[2.1429rem]">
              A bug tracker for teams of 2–10. Paste a screenshot, say what broke, press Enter: it
              is on your teammate’s screen about a second later, and Claude Code can fix it from
              there.
            </p>
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
        </div>
        {/* The whole workspace, contained in the grid at every width: list, detail and controls. */}
        <div className="mk-rise mt-14 lg:mt-20" style={{ '--mk-delay': '520ms' } as CSSProperties}>
          {/* The specimen label of the bug open in the frame, pinned above it like a drawer tag. */}
          <TypedSpecimenLabel delay={200} lines={HERO_LABEL} className="mb-4" />
          <DrawerFrame>
            <ShotImage shot={HERO_SHOT} theme={theme} lazy={false} />
          </DrawerFrame>
        </div>
      </div>
    </section>
  )
}
