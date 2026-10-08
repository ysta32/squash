import { Hash, User } from 'lucide-react'
import { cn } from '../../lib/utils'
import { MK_CONTAINER } from '../marketing/MarketingLayout'
import { Reveal } from '../marketing/Reveal'
import { SpecimenLabel } from '../ui'
import { FILED_FIELDS, HERO_LABEL, MISSING_FIELDS } from './content'
import { Band, SectionHead } from './Section'

/** A drawn-in-CSS phone screenshot of the demo bug: a cookie banner covering the Pay button. */
function PhoneCapture() {
  return (
    <div
      aria-hidden="true"
      className="relative h-44 w-28 shrink-0 overflow-hidden rounded-lg border border-line-2 bg-surface-2"
    >
      <div className="space-y-1.5 p-2.5">
        <div className="h-1.5 w-10 rounded-xs bg-ink/70" />
        <div className="h-1 w-16 rounded-xs bg-line-2" />
        <div className="mt-3 space-y-1 rounded-sm border border-line p-1.5">
          <div className="flex justify-between">
            <div className="h-1 w-8 rounded-xs bg-line-2" />
            <div className="h-1 w-4 rounded-xs bg-line-2" />
          </div>
          <div className="flex justify-between">
            <div className="h-1 w-10 rounded-xs bg-line-2" />
            <div className="h-1 w-4 rounded-xs bg-line-2" />
          </div>
          <div className="flex justify-between">
            <div className="h-1 w-6 rounded-xs bg-line-2" />
            <div className="h-1 w-4 rounded-xs bg-line-2" />
          </div>
        </div>
      </div>
      <div className="absolute inset-x-2.5 bottom-9 h-5 rounded-sm bg-ink" />
      <div className="absolute inset-x-0 bottom-0 flex h-14 items-center gap-1.5 bg-ink px-2 opacity-95">
        <div className="h-1 flex-1 rounded-xs bg-bg/50" />
        <div className="h-3.5 w-7 rounded-xs bg-bg" />
      </div>
    </div>
  )
}

function Ledger({
  rows,
  missing = false,
}: {
  rows: { term: string; value: string }[]
  missing?: boolean
}) {
  return (
    <dl className="mt-6 divide-y divide-line border-y border-line">
      {rows.map((row) => (
        <div key={row.term} className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-4 py-2.5">
          <dt className="specimen-label pt-0.5 text-ink-3">{row.term}</dt>
          <dd className={cn('text-sm', missing ? 'text-ink-3' : 'text-ink')}>
            {missing ? (
              // Said in words, so the empty rows read as missing facts, not as a page still loading.
              <span className="text-ink-3">Not recorded</span>
            ) : (
              row.value
            )}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export function Problem() {
  return (
    <Band labelledBy="problem-heading">
      <div className={cn(MK_CONTAINER, 'grid gap-12 lg:grid-cols-12 lg:gap-8')}>
        <Reveal className="lg:col-span-4">
          <SectionHead
            id="problem-heading"
            eyebrow="The problem"
            title="A screenshot in a chat channel is not a bug report."
          >
            <p>
              It arrives without the page, the device or the steps. By tomorrow it has scrolled
              away, and nobody can say who took it or whether it was fixed.
            </p>
          </SectionHead>
        </Reveal>

        <div className="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:col-span-8">
          <Reveal delay={80} className="bg-bg p-5 sm:p-8">
            <p className="specimen-label text-ink-3">Before · in a chat channel</p>
            <figure className="mt-5 rounded-lg border border-line bg-surface-1">
              <div className="flex items-center gap-1.5 border-b border-line px-3 py-2 text-sm font-medium text-ink-2">
                <Hash size={14} aria-hidden="true" />
                general
              </div>
              <div className="flex gap-3 p-3">
                <span
                  aria-hidden="true"
                  className="flex size-8 shrink-0 items-center justify-center rounded-md bg-surface-3 text-ink-3"
                >
                  <User size={16} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm">
                    <span className="font-medium">A teammate</span>{' '}
                    <span className="font-mono text-xs text-ink-3 tabular-nums">14:02</span>
                  </p>
                  <div className="mt-2 flex items-end gap-3">
                    <PhoneCapture />
                    <p className="font-mono text-xs break-all text-ink-3">IMG_4471.PNG</p>
                  </div>
                </div>
              </div>
              <figcaption className="sr-only">
                A chat message containing only a phone screenshot, with no description.
              </figcaption>
            </figure>
            <Ledger missing rows={MISSING_FIELDS.map((term) => ({ term, value: '' }))} />
          </Reveal>

          <Reveal delay={160} className="bg-bg p-5 sm:p-8">
            <p className="specimen-label text-accent">After · filed in Squash</p>
            <SpecimenLabel
              boxed
              as="div"
              segments={HERO_LABEL[0]}
              detail={HERO_LABEL[1].slice(0, 2)}
              className="mt-5"
            />
            <p className="mt-4 text-lg font-semibold tracking-[-0.01em] text-balance">
              Checkout button hidden behind cookie banner on iPhone
            </p>
            <Ledger rows={FILED_FIELDS.map(({ term, value }) => ({ term, value }))} />
          </Reveal>
        </div>
      </div>
    </Band>
  )
}
