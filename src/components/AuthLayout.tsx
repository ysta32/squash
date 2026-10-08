import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Bot } from 'lucide-react'
import { Kbd, Logo, SpecimenLabel, buttonClass } from './ui'
import { SkipLink } from './SkipLink'

// The last sentence is set in text-2 so the line reads as context next to the form's title.
const PITCH = (
  <>
    Bug reports with the screenshot, the markup and the context.{' '}
    <span className="text-ink-2">Fixed with Claude Code.</span>
  </>
)
const TITLE = 'Accept all doesn’t close the cookie banner'
const SHOT_ALT =
  'Lumen’s Plans page in Chrome on a Mac. A red marker box, pin 1, circles the cookie banner’s Accept all button.'

/**
 * The marked-up screenshot from the example bug: the capture plus Squash's own marker (a red box
 * and pin 1 around the button that does nothing). The marker stroke draws itself once, unless the
 * reader prefers reduced motion. Coordinates are in the capture's 800 x 500 CSS pixels.
 */
function SpecimenShot({ sizes, eager = false }: { sizes: string; eager?: boolean }) {
  const box = useRef<SVGRectElement>(null)

  useEffect(() => {
    const node = box.current
    if (!node || typeof node.animate !== 'function') return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const animation = node.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], {
      duration: 640,
      delay: 360,
      easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      fill: 'backwards',
    })
    return () => animation.cancel()
  }, [])

  return (
    <div className="relative overflow-hidden rounded-md ring-1 ring-line">
      <img
        src="/auth/specimen-024-760.webp"
        srcSet="/auth/specimen-024-760.webp 760w, /auth/specimen-024-1520.webp 1520w"
        sizes={sizes}
        width={800}
        height={500}
        alt={SHOT_ALT}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        // The capture is a white page; in the darkroom it is dimmed (the marker stays bright on
        // top) so it reads as a lit print on a dark desk instead of a glaring window.
        className="block aspect-[16/10] h-auto w-full dark:brightness-[0.66] dark:saturate-[0.9]"
      />
      <svg
        viewBox="0 0 800 500"
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 size-full"
      >
        <rect
          ref={box}
          x="636"
          y="436"
          width="132"
          height="60"
          rx="10"
          pathLength={1}
          strokeDasharray="1"
          fill="none"
          stroke="var(--markup)"
          strokeWidth="3.5"
          strokeLinejoin="round"
        />
        <g transform="translate(636 436)">
          <circle r="13" fill="var(--markup)" stroke="white" strokeWidth="2.5" />
          <text
            y="4.5"
            textAnchor="middle"
            fill="white"
            className="font-mono"
            fontSize="13"
            fontWeight="500"
          >
            1
          </text>
        </g>
      </svg>
    </div>
  )
}

/** The bug's specimen label: accession number, kind, severity, then who filed it and where. */
function ExampleLabel() {
  return (
    <SpecimenLabel
      boxed
      segments={[
        <span key="no" className="font-medium text-ink">
          No. 031
        </span>,
        'Bug',
        <span key="sev" className="text-sev-high">
          High
        </span>,
      ]}
      detail={['Coll. J. Ellis', 'Lumen', 'Chrome', 'macOS']}
    />
  )
}

/**
 * The desktop right-hand panel: lamp-lit paper (with a faint lamp in the darkroom too), a mono
 * eyebrow, one display line, then the exhibit. Hidden below 1024px.
 */
export function AuthPanel({
  label,
  eyebrow,
  title,
  children,
}: {
  label: string
  eyebrow: string
  title: ReactNode
  children: ReactNode
}) {
  return (
    <aside
      aria-label={label}
      className="relative hidden min-w-0 flex-col justify-center overflow-hidden border-l border-line cabinet-light lg:flex"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 hidden bg-[radial-gradient(90%_70%_at_0%_0%,color-mix(in_oklab,var(--text-1)_7%,transparent),transparent_72%)] dark:block"
      />
      {/* One centred stack, at most 760px of exhibit: the display line and the exhibit share a
          left edge, centred vertically like the form beside it. */}
      <div className="relative mx-auto w-full max-w-[calc(54.2857rem+6rem)] px-12 py-16">
        <p className="specimen-label text-ink-3">{eyebrow}</p>
        <p className="mt-4 max-w-[30ch] text-2xl font-medium text-balance text-ink xl:text-[2.2857rem] xl:leading-[2.7143rem]">
          {title}
        </p>
        <div className="mt-10">{children}</div>
      </div>
    </aside>
  )
}

/**
 * The default panel: one display line saying what Squash is, then an example bug laid out in
 * Squash's own detail chrome (specimen label, marked-up capture, captured context and the Send to
 * Claude action). Static on purpose: nothing here is interactive.
 */
function SpecimenPanel() {
  return (
    <AuthPanel
      label="What a Squash bug report looks like"
      eyebrow="What your team files"
      title={PITCH}
    >
      <figure className="overflow-hidden rounded-xl border border-line bg-surface-2 shadow-elev-3">
        <div className="flex items-start justify-between gap-6 px-5 pt-5 pb-4">
          <div className="min-w-0">
            <ExampleLabel />
            <figcaption className="mt-3 text-lg font-semibold text-pretty text-ink">
              {TITLE}
            </figcaption>
          </div>
          <span
            aria-hidden="true"
            className={buttonClass('secondary', 'sm', 'pointer-events-none mt-0.5 bg-surface-2')}
          >
            <Bot className="size-4" strokeWidth={1.5} absoluteStrokeWidth />
            Send to Claude
            <Kbd className="ml-0.5">C</Kbd>
          </span>
        </div>
        <div className="px-5">
          <SpecimenShot sizes="(min-width: 1536px) 760px, 46vw" eager />
        </div>
        <dl className="mt-4 grid grid-cols-[auto_auto_minmax(0,1fr)] gap-x-8 border-t border-line px-5 py-3.5">
          {[
            ['Page', 'lumen.app/settings/plans'],
            ['Viewport', '1280 × 800'],
            ['Console', '1 error · banner.js'],
          ].map(([term, value]) => (
            <div key={term} className="min-w-0">
              <dt className="specimen-label text-ink-3">{term}</dt>
              <dd className="mt-0.5 truncate font-mono text-xs text-ink-2">{value}</dd>
            </div>
          ))}
        </dl>
      </figure>
    </AuthPanel>
  )
}

/** Under the form below 1024px: the same pitch and example bug, cropped to a card. */
function SpecimenCard() {
  return (
    <section aria-label="What a Squash bug report looks like" className="mt-14 lg:hidden">
      <p className="specimen-label text-ink-3">What your team files</p>
      <p className="mt-3 text-lg font-semibold text-pretty text-ink">{PITCH}</p>
      <figure className="mt-5 overflow-hidden rounded-lg border border-line bg-surface-2 shadow-elev-2">
        <div className="px-4 pt-4 pb-3">
          <ExampleLabel />
          <figcaption className="mt-2.5 text-base font-semibold text-pretty text-ink">
            {TITLE}
          </figcaption>
        </div>
        <div className="px-4 pb-4">
          <SpecimenShot sizes="(min-width: 640px) 360px, calc(100vw - 4rem)" />
        </div>
      </figure>
    </section>
  )
}

export function AuthLayout({
  eyebrow,
  title,
  description,
  children,
  footer,
  aside,
  pitch = false,
}: {
  /** Mono label above the title (step, state or context). */
  eyebrow?: ReactNode
  title: string
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  /** Desktop right-hand panel; defaults to the example bug. */
  aside?: ReactNode
  /** Below 1024px, show the product pitch and example bug under the form (sign-in, invites). */
  pitch?: boolean
}) {
  return (
    <>
      <SkipLink />
      <div className="grid min-h-dvh text-ink lg:grid-cols-[minmax(30rem,5fr)_minmax(0,7fr)] 2xl:grid-cols-[42rem_minmax(0,1fr)]">
        {/* Below 1024px the form column is centred; from 1024px it sits left of the panel. */}
        <div className="mx-auto flex w-full max-w-[29.7143rem] min-w-0 flex-col px-6 py-5 sm:px-0 sm:py-8 lg:mx-0 lg:max-w-none lg:px-16 lg:py-5">
          <Link
            to="/"
            aria-label="Squash home"
            className="t focus-ring -ml-1 inline-flex min-h-11 items-center self-start rounded-md px-1 text-ink"
          >
            <Logo size={20} />
          </Link>
          <main
            id="main"
            tabIndex={-1}
            className="w-full max-w-[25.7143rem] animate-in pt-12 pb-12 focus:outline-none sm:my-auto sm:py-16"
          >
            {eyebrow && <div className="specimen-label pb-4 text-ink-3">{eyebrow}</div>}
            <h1 className="text-2xl font-semibold text-balance">{title}</h1>
            {description && (
              <div className="mt-3 text-read text-pretty text-ink-2">{description}</div>
            )}
            <div className="mt-8">{children}</div>
            {footer && (
              <div className="mt-10 border-t border-line pt-6 text-sm text-ink-2">{footer}</div>
            )}
            {pitch && <SpecimenCard />}
          </main>
          <nav aria-label="Legal" className="mt-auto flex items-center gap-4 text-xs text-ink-3">
            <Link
              to="/terms"
              className="t focus-ring inline-flex min-h-11 items-center rounded-sm hover:text-ink"
            >
              Terms
            </Link>
            <Link
              to="/privacy"
              className="t focus-ring inline-flex min-h-11 items-center rounded-sm hover:text-ink"
            >
              Privacy
            </Link>
          </nav>
        </div>
        {aside ?? <SpecimenPanel />}
      </div>
    </>
  )
}
