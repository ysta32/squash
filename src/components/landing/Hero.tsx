import { cn } from '../../lib/utils'
import { MK_CONTAINER, OpenWorkspaceLink } from '../marketing/MarketingLayout'
import { buttonClass } from '../ui'
import { CaptureDemo } from './CaptureDemo'

/**
 * The page opens mid-keystroke: the headline is set in the face of the box a bug is typed into,
 * at poster size, with the caret still blinking after it and the marker rule drawn under it as
 * the page settles. The capture bar below is the real one — type in it and the bug files.
 */
export function Hero() {
  return (
    <section aria-labelledby="hero-heading" className={cn(MK_CONTAINER, 'pt-12 pb-20 lg:pt-20')}>
      <p className="lp-mark">a bug tracker for teams of 2 to 10</p>

      <h1 id="hero-heading" className="lp-display lp-h1 mt-6">
        {'File it in the '}
        <br />
        {'four seconds '}
        <br />
        <span className="relative inline-block">
          you still care.
          <span aria-hidden="true" className="lp-caret" />
          {/* The marker rule under the last line, drawn the way it would be drawn by hand. */}
          <svg
            aria-hidden="true"
            viewBox="0 0 400 20"
            preserveAspectRatio="none"
            className="lp-rule absolute inset-x-0 top-[0.92em]"
          >
            <path pathLength={1} d="M5 13C110 6 250 7 395 10" />
          </svg>
        </span>
      </h1>

      <div className="mt-14 grid gap-10 lg:mt-16 lg:grid-cols-12 lg:gap-12">
        <div className="lg:col-span-5">
          <p className="lp-read">
            Paste a screenshot, say what broke, press Enter. It is on your teammate’s screen about a
            second later with the page, the device and the window size already written down — and
            Claude Code can take it from there.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <OpenWorkspaceLink size="lg" />
            <a href="#self-host" className={buttonClass('secondary', 'lg')}>
              Self-host it
            </a>
          </div>
          <p className="lp-mono mt-6 max-w-[34ch]">
            MIT licensed, free on the hosted instance, no paid tier, no trackers. Runs on your own
            Supabase project in five minutes.
          </p>
        </div>

        <div className="lg:col-span-7">
          <p className="lp-mono mb-3">
            this one is live — type what broke and press enter, it files into the list under it
          </p>
          <CaptureDemo />
        </div>
      </div>
    </section>
  )
}
