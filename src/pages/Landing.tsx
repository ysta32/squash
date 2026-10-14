import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { Depth } from '../components/landing/Depth'
import { Hero } from '../components/landing/Hero'
import { Problem } from '../components/landing/Problem'
import { Proof } from '../components/landing/Proof'
import { Stage } from '../components/landing/Stage'
import { HERO_SHOT } from '../components/landing/content'
import { ShotImage } from '../components/landing/Frames'
import { Band, EntryHead } from '../components/landing/Section'
import '../components/landing/lp.css'
import {
  MK_CONTAINER,
  MarketingLayout,
  OpenWorkspaceLink,
} from '../components/marketing/MarketingLayout'
import { Reveal } from '../components/marketing/Reveal'
import { buttonClass } from '../components/ui'
import { cn } from '../lib/utils'

/** Router links like `/#self-host` change only the hash; bring that section into view. */
function useHashScroll() {
  const { hash } = useLocation()
  useEffect(() => {
    if (!hash) return
    const target = document.getElementById(decodeURIComponent(hash.slice(1)))
    target?.scrollIntoView({ block: 'start' })
  }, [hash])
}

/** The drafting guides the whole page is set against, running the height of the window. */
function Guides() {
  return (
    <div aria-hidden="true" className="lp-guides">
      <div>
        <span />
        <span />
        <span />
        <span />
      </div>
    </div>
  )
}

/** The workspace bug #24 was living in the whole time, at full width. */
function Workspace() {
  return (
    <Band labelledBy="workspace-heading">
      <div className={MK_CONTAINER}>
        <Reveal>
          <EntryHead
            id="workspace-heading"
            mark="the room it happened in"
            title="A list, a record, and nothing else to learn."
          >
            <p>
              Bugs on the left, the open one on the right, one input above both. Every view is a
              URL, every action has a key, and the whole thing works on a phone.
            </p>
          </EntryHead>
        </Reveal>
        <Reveal delay={80}>
          <figure className="mt-12">
            <div className="overflow-hidden rounded-md border border-line-2 shadow-elev-3">
              <ShotImage shot={HERO_SHOT} theme="dark" />
            </div>
            <figcaption className="lp-mono mt-4">
              the demo workspace, bug 24 open with claude code working through the fix
            </figcaption>
          </figure>
        </Reveal>
      </div>
    </Band>
  )
}

function Action() {
  return (
    <Band labelledBy="action-heading">
      <div className={cn(MK_CONTAINER)}>
        <Reveal>
          <h2 id="action-heading" className="lp-display lp-h1 max-w-[12ch]">
            File the next one here.
          </h2>
          <p className="lp-read mt-8">
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
    </Band>
  )
}

/**
 * The home page is the product with the lights on: the page's own world is the workspace's, the
 * status line at the bottom of the window is the app's, and the middle of the page is bug #24
 * living its whole life under the scroll.
 */
export default function Landing() {
  useHashScroll()
  return (
    <MarketingLayout surface="lp">
      <Guides />
      <div className="lp-above">
        <Hero />
        <Problem />
        <Stage />
        <Workspace />
        <Proof />
        <Depth />
        <Action />
      </div>
    </MarketingLayout>
  )
}
