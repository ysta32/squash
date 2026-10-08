import { ArrowUpRight, Check, Copy, Download } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { SectionHead } from '../components/landing/Section'
import { content } from '../components/marketing/content'
import type { PressShot } from '../components/marketing/content-types'
import { githubUrl } from '../components/marketing/links'
import { MK_CONTAINER, MarketingLayout } from '../components/marketing/MarketingLayout'
import { PageHero } from '../components/marketing/PageHero'
import { Reveal } from '../components/marketing/Reveal'
import { PRESS_COLORS, type PressColor } from '../components/marketing/pressColors'
import { usePageTitle } from '../components/marketing/usePageTitle'
import { LogoMark, buttonClass, proseLinkClass } from '../components/ui'
import { cn } from '../lib/utils'

const LOGOS: {
  name: string
  theme: 'light' | 'dark'
  files: { label: string; href: string }[]
}[] = [
  {
    name: 'Logo on paper',
    theme: 'light',
    files: [
      { label: 'PNG', href: '/brand/squash-logo-light.png' },
      { label: 'PNG, transparent', href: '/brand/squash-logo-light-transparent.png' },
      { label: 'Mark, SVG', href: '/brand/squash-mark-light.svg' },
    ],
  },
  {
    name: 'Logo in the darkroom',
    theme: 'dark',
    files: [
      { label: 'PNG', href: '/brand/squash-logo-dark.png' },
      { label: 'PNG, transparent', href: '/brand/squash-logo-dark-transparent.png' },
      { label: 'Mark, SVG', href: '/brand/squash-mark-dark.svg' },
    ],
  },
]

/** A lighter WebP of the same screen (public/product) to preview a press PNG, when one exists. */
function previewFor(shot: PressShot): string {
  const name = shot.file.replace(/^\/press\/|\.png$/g, '')
  const webp = name.replace(/^hero-/, 'workspace-')
  const known = ['workspace', 'capture', 'annotate', 'claude', 'palette']
  const base = webp.replace(/-(light|dark)$/, '')
  if (known.includes(base) || webp === 'mobile') return `/product/${webp}.webp`
  return shot.file
}

function megabytes(bytes: number): string {
  return bytes >= 1_000_000
    ? `${(bytes / 1_000_000).toFixed(1)} MB`
    : `${Math.round(bytes / 1000)} kB`
}

const downloadLink =
  't focus-ring inline-flex min-h-9 items-center gap-1.5 rounded-md text-sm font-medium text-accent hover:text-accent-strong max-sm:min-h-11'

function Swatch({ color }: { color: PressColor }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  async function copy() {
    window.clearTimeout(timer.current)
    try {
      await navigator.clipboard.writeText(color.hex)
      setCopied(true)
      timer.current = window.setTimeout(() => setCopied(false), 1600)
    } catch {
      // Clipboard denied: the hex stays visible to select by hand.
      setCopied(false)
    }
  }
  return (
    <li className="overflow-hidden rounded-lg border border-line bg-surface-2">
      <div
        className="flex h-28 items-end p-3"
        style={{ backgroundColor: color.hex, color: color.ink }}
      >
        <span className="specimen-label" style={{ color: color.ink }}>
          {color.token}
        </span>
      </div>
      <div className="flex flex-col items-start gap-2 p-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">{color.name}</p>
          <p className="mt-0.5 text-xs text-ink-3">{color.note}</p>
        </div>
        <button
          type="button"
          onClick={copy}
          aria-label={`Copy ${color.name} ${color.hex}`}
          className="t focus-ring -ml-2 inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2 font-mono text-xs text-ink-2 tabular-nums hover:bg-surface-3 hover:text-ink max-sm:h-11"
        >
          {copied ? (
            <Check size={14} aria-hidden="true" className="text-success" />
          ) : (
            <Copy size={14} aria-hidden="true" />
          )}
          <span aria-live="polite">{copied ? 'Copied' : color.hex}</span>
        </button>
      </div>
    </li>
  )
}

export default function Press() {
  usePageTitle('Press kit')
  return (
    <MarketingLayout>
      <PageHero
        eyebrow={['Press kit', 'Logos', 'Colours', 'Type', 'Screenshots']}
        title="Logos, colours, type and screenshots."
      >
        <p>
          Everything you need to write about Squash or link to it. Download what you need; there is
          nothing to sign up for. The files come from the repository, so they match the app.
        </p>
      </PageHero>

      <section aria-labelledby="logos-heading" className="border-t border-line py-16 lg:py-24">
        <div className={MK_CONTAINER}>
          <Reveal>
            <SectionHead id="logos-heading" eyebrow="01 · Logo" title="The pin and the wordmark.">
              <p>
                A specimen pin, then “squash” in lowercase IBM Plex Sans. Keep at least the width of
                the pin head clear around it, do not recolour or stretch it, and use the darkroom
                version on dark backgrounds.
              </p>
            </SectionHead>
          </Reveal>
          <Reveal delay={80}>
            <ul className="mt-10 grid gap-6 md:grid-cols-2">
              {LOGOS.map((logo) => (
                <li
                  key={logo.theme}
                  className="overflow-hidden rounded-xl border border-line-2 shadow-elev-1"
                >
                  <div
                    className="flex aspect-[3/1] items-center justify-center"
                    style={{ backgroundColor: logo.theme === 'light' ? '#F5F3EE' : '#141412' }}
                  >
                    <img
                      src={`/brand/squash-logo-${logo.theme}-transparent.png`}
                      alt={`The Squash logo, ${logo.theme === 'light' ? 'ink on paper' : 'light on dark'}`}
                      width={1920}
                      height={640}
                      loading="lazy"
                      className="h-auto w-3/5"
                    />
                  </div>
                  <div className="border-t border-line bg-surface-2 p-4">
                    <p className="text-sm font-medium">{logo.name}</p>
                    <ul className="mt-2 flex flex-wrap gap-x-5">
                      {logo.files.map((file) => (
                        <li key={file.href}>
                          <a href={file.href} download className={downloadLink}>
                            <Download size={14} aria-hidden="true" />
                            {file.label}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      <section aria-labelledby="colours-heading" className="border-t border-line py-16 lg:py-24">
        <div className={MK_CONTAINER}>
          <Reveal>
            <SectionHead
              id="colours-heading"
              eyebrow="02 · Colour"
              title="Paper, ink and one green."
            >
              <p>
                Viridian is the only brand colour. Marker red is reserved for annotations drawn on
                screenshots. Hex values are the design tokens in{' '}
                <code className="font-mono text-[0.9em]">src/index.css</code>.
              </p>
            </SectionHead>
          </Reveal>
          <Reveal delay={80}>
            <ul className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4">
              {PRESS_COLORS.map((color) => (
                <Swatch key={color.name} color={color} />
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      <section aria-labelledby="type-heading" className="border-t border-line py-16 lg:py-24">
        <div className={MK_CONTAINER}>
          <Reveal>
            <SectionHead id="type-heading" eyebrow="03 · Type" title="IBM Plex, two cuts.">
              <p>Both are free under the SIL Open Font License 1.1. No other typefaces are used.</p>
            </SectionHead>
          </Reveal>
          <Reveal delay={80}>
            <ul className="mt-10 grid gap-6 md:grid-cols-2">
              {[
                {
                  name: 'IBM Plex Sans',
                  use: 'Interface, headings and reading text. Weights 400, 500 and 600.',
                  className: 'font-sans font-semibold tracking-[-0.035em]',
                },
                {
                  name: 'IBM Plex Mono',
                  use: 'Specimen labels, bug numbers, keys and code. Weights 400 and 500.',
                  className: 'font-mono font-medium tracking-[-0.02em]',
                },
              ].map((face) => (
                <li
                  key={face.name}
                  className="rounded-xl border border-line bg-surface-2 p-6 sm:p-8"
                >
                  <p aria-hidden="true" className={cn('text-[5rem]/none text-ink', face.className)}>
                    Aa
                  </p>
                  <p className={cn('mt-6 text-xl', face.className)}>{face.name}</p>
                  <p className="mt-2 text-sm text-ink-2">{face.use}</p>
                  <a href="https://github.com/IBM/plex" className={cn(downloadLink, 'mt-3')}>
                    Get it from IBM
                    <ArrowUpRight size={14} aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      <section aria-labelledby="shots-heading" className="border-t border-line py-16 lg:py-24">
        <div className={MK_CONTAINER}>
          <Reveal>
            <SectionHead
              id="shots-heading"
              eyebrow="04 · Screenshots"
              title="The real app, demo data."
            >
              <p>
                Captured from the app running on its demo workspace; the people and bugs in them are
                made up. Full-resolution PNGs, light and dark.
              </p>
            </SectionHead>
          </Reveal>
          <ul className="mt-10 grid gap-x-6 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">
            {content.press.map((shot, i) => (
              <li key={shot.file}>
                <Reveal delay={(i % 3) * 60}>
                  <a
                    href={shot.file}
                    download
                    className="t focus-ring group block overflow-hidden rounded-lg border border-line-2 bg-surface-2 shadow-elev-1 hover:shadow-elev-2"
                  >
                    <img
                      src={previewFor(shot)}
                      alt={`${shot.caption} (download the PNG)`}
                      width={shot.width}
                      height={shot.height}
                      loading="lazy"
                      decoding="async"
                      className="block aspect-[16/10] h-auto w-full bg-surface-3/50 object-contain"
                    />
                  </a>
                  <div className="mt-3 flex items-baseline justify-between gap-3">
                    <p className="text-sm font-medium">{shot.caption}</p>
                    <a href={shot.file} download className={downloadLink}>
                      <Download size={14} aria-hidden="true" />
                      <span className="sr-only">Download {shot.caption}, </span>
                      PNG
                    </a>
                  </div>
                  <p className="specimen-label mt-1 text-ink-3">
                    {shot.width}×{shot.height} · {megabytes(shot.bytes)}
                  </p>
                </Reveal>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="press-contact" className="cabinet-light border-t border-line">
        <div className={cn(MK_CONTAINER, 'grid gap-8 py-16 lg:grid-cols-12 lg:py-24')}>
          <div className="lg:col-span-7">
            <p className="specimen-label text-ink-3">05 · Facts and contact</p>
            <h2
              id="press-contact"
              className="mt-3 text-[2rem]/[2.4rem] font-semibold tracking-[-0.025em] sm:text-display-s"
            >
              Get the name right.
            </h2>
            <p className="mt-4 max-w-[56ch] text-read text-pretty text-ink-2">
              Squash, with a capital S in running text; the logo is lowercase. It is an open-source,
              real-time bug tracker for teams of 2–10 people. For anything not covered here, open an
              issue on{' '}
              <a href={`${githubUrl()}/issues`} className={proseLinkClass}>
                GitHub
              </a>
              .
            </p>
          </div>
          <div className="flex items-center gap-4 lg:col-span-4 lg:col-start-9 lg:justify-end">
            <LogoMark size={56} />
            <a href="/og/press-dark.png" download className={buttonClass('secondary', 'lg')}>
              <Download size={16} aria-hidden="true" />
              Social card
            </a>
          </div>
        </div>
      </section>
    </MarketingLayout>
  )
}
