import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { Chapters } from '../components/landing/Chapters'
import { Depth } from '../components/landing/Depth'
import { Hero } from '../components/landing/Hero'
import { Problem } from '../components/landing/Problem'
import { Proof } from '../components/landing/Proof'
import {
  MK_CONTAINER,
  MarketingLayout,
  OpenWorkspaceLink,
} from '../components/marketing/MarketingLayout'
import { Reveal } from '../components/marketing/Reveal'
import { buttonClass } from '../components/ui'
import { cn } from '../lib/utils'
import { useTheme } from '../lib/theme'

/** Router links like `/#self-host` change only the hash; bring that section into view. */
function useHashScroll() {
  const { hash } = useLocation()
  useEffect(() => {
    if (!hash) return
    const target = document.getElementById(decodeURIComponent(hash.slice(1)))
    target?.scrollIntoView({ block: 'start' })
  }, [hash])
}

function Action() {
  return (
    <section aria-labelledby="action-heading" className="cabinet-light border-t border-line">
      <div className={cn(MK_CONTAINER, 'py-20 lg:py-32')}>
        <Reveal>
          <p className="specimen-label text-ink-3">Start</p>
          <h2
            id="action-heading"
            className="mt-3 max-w-[16ch] text-[2.75rem]/[2.9rem] font-semibold tracking-[-0.035em] text-balance sm:text-display-m lg:text-display-l 2xl:text-display-xl"
          >
            File the next bug in Squash.
          </h2>
          <p className="mt-6 max-w-[56ch] text-read text-pretty text-ink-2">
            Free on the hosted instance, with no paid tier. MIT licensed if you would rather run
            your own.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <OpenWorkspaceLink size="lg" />
            <a href="#self-host" className={buttonClass('secondary', 'lg')}>
              Self-host it
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

export default function Landing() {
  const { resolved: theme } = useTheme()
  useHashScroll()
  return (
    <MarketingLayout>
      <Hero theme={theme} />
      <Problem />
      <Chapters theme={theme} />
      <Proof />
      <Depth />
      <Action />
    </MarketingLayout>
  )
}
