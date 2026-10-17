import type { CSSProperties } from 'react'
import { cn } from '../../lib/utils'
import { PLAN, STEPS, WITNESSES } from './lifecycle'

/**
 * The evidence on bug #24, drawn rather than photographed: a checkout page with a consent banner
 * sitting over the Pay button. The markup is in the page's own coordinates, so the box and the
 * arrow land on the banner and the button wherever the shot is scaled to.
 */
function Evidence({ phase }: { phase: 'before' | 'drawing' | 'done' | 'wiped' }) {
  return (
    <div className="lp-shot">
      <div className="absolute inset-0 flex flex-col p-[4.5%] text-[0px]">
        <div className="flex items-center justify-between">
          <span className="lp-shot-line block h-[3px] w-[14%]" />
          <span className="lp-shot-line block h-[3px] w-[10%]" />
        </div>
        <span className="lp-shot-ink mt-[7%] block h-[9px] w-[42%]" />
        <div className="mt-[7%] space-y-[4%]">
          {[62, 48, 55, 51].map((w) => (
            <div key={w} className="flex items-center gap-[4%]">
              <span className="lp-shot-line block aspect-square w-[14%] rounded-sm" />
              <span className="lp-shot-line block h-[5px]" style={{ width: `${w}%` }} />
            </div>
          ))}
        </div>
        <div className="mt-auto space-y-[4%] pb-[2%]">
          <div className="flex items-center justify-between">
            <span className="lp-shot-line block h-[4px] w-[30%]" />
            <span className="lp-shot-line block h-[4px] w-[18%]" />
          </div>
          <div className="flex items-center justify-between">
            <span className="lp-shot-ink block h-[6px] w-[22%]" />
            <span className="lp-shot-ink block h-[6px] w-[16%]" />
          </div>
          {/* The Pay now button: the thing the banner is covering. */}
          <span className="lp-shot-ink block h-[9%] w-full rounded-[3px]" />
        </div>
      </div>
      {/* The consent banner, laid over the bottom of the page. */}
      <div className="absolute inset-x-[3%] bottom-[3%] rounded-[3px] bg-[#141414] p-[3.5%] shadow-lg">
        <span className="block h-[4px] w-[70%] rounded-xs bg-white/55" />
        <span className="mt-[4%] block h-[4px] w-[52%] rounded-xs bg-white/30" />
        <div className="mt-[7%] flex gap-[4%]">
          <span className="block h-[12px] w-[26%] rounded-[3px] bg-white/85" />
          <span className="block h-[12px] w-[22%] rounded-[3px] bg-white/20" />
        </div>
      </div>
      <svg
        viewBox="0 0 390 650"
        preserveAspectRatio="none"
        aria-hidden="true"
        data-phase={phase}
        className="lp-ink pointer-events-none absolute inset-0 size-full"
      >
        <path
          pathLength={1}
          strokeWidth={7}
          d="M20 468C120 460 270 464 372 466C376 510 374 566 371 602C250 608 110 606 22 601C17 560 15 508 19 464"
        />
        <path
          pathLength={1}
          strokeWidth={7}
          d="M322 392C306 430 274 464 236 494M236 494L265 490M236 494L241 466"
        />
      </svg>
    </div>
  )
}

/** A row in a teammate's list, a second after the bug was filed. */
function Witness({ who, device, at, shown }: (typeof WITNESSES)[number] & { shown: boolean }) {
  return (
    <li
      className={cn(
        'flex items-baseline gap-3 border-t border-line py-2.5 transition-opacity duration-300',
        shown ? 'lp-land opacity-100' : 'opacity-25',
      )}
    >
      <span aria-hidden="true" className="lp-ticks translate-y-0.5">
        <i />
        <i />
        <i />
        <i />
      </span>
      <span className="text-sm">{who}</span>
      <span className="lp-small">{device}</span>
      <span className="lp-data ml-auto text-ink-3">{shown ? at : '—'}</span>
    </li>
  )
}

/** The panel beside the evidence: what the workspace is showing at this point in the bug's life. */
function Panel({ step, local }: { step: number; local: number }) {
  if (step === 0) {
    return (
      <dl className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-4">
        {[
          ['Page', '/checkout'],
          ['Device', 'iOS Safari, 390×844'],
          ['Filed by', 'J. Ellis'],
          ['Images', '1 screenshot, 284 KB'],
        ].map(([term, value]) => (
          <div key={term} className="col-span-2 grid grid-cols-subgrid border-t border-line py-2.5">
            <dt className="lp-small">{term}</dt>
            <dd className="lp-data text-ink">{value}</dd>
          </div>
        ))}
      </dl>
    )
  }
  if (step === 1) {
    return (
      <div>
        <div className="flex gap-1.5">
          {[
            ['A', 'Arrow'],
            ['B', 'Box'],
            ['P', 'Pen'],
          ].map(([key, name], i) => (
            <span
              key={key}
              className={cn(
                'inline-flex items-center gap-2 rounded-sm border px-2.5 py-1.5 font-mono text-xs',
                i === 1 || (i === 0 && local > 0.55)
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-line-2 text-ink-3',
              )}
            >
              <b className="font-semibold">{key}</b>
              {name}
            </span>
          ))}
        </div>
        <p className="mt-5 border-t border-line pt-4 text-sm leading-6 text-ink-2">
          Drawn on the screenshot before it was filed: a box around the consent banner, and an arrow
          to the Pay now button underneath it.
        </p>
        <p className="lp-small mt-3">⌘Z undoes. Esc asks before throwing work away.</p>
      </div>
    )
  }
  if (step === 2) {
    return (
      <ul className="border-b border-line">
        {WITNESSES.map((w, i) => (
          <Witness key={w.who} {...w} shown={local > (i + 0.5) / (WITNESSES.length + 1)} />
        ))}
      </ul>
    )
  }
  if (step === 3) {
    const done = Math.floor(local * (PLAN.length + 1))
    return (
      <div>
        <p className="lp-small">
          editing <span className="lp-data text-ink">src/checkout/ConsentBanner.tsx</span>
        </p>
        <ol className="mt-3 border-t border-line">
          {PLAN.map((item, i) => (
            <li key={item} className="flex gap-3 border-b border-line py-2.5">
              <span
                aria-hidden="true"
                className={cn(
                  'mt-1 block size-2.5 shrink-0 border transition-colors duration-300',
                  i < done ? 'border-ink bg-ink' : 'border-line-2',
                )}
              />
              <span className={cn('text-sm leading-6', i < done ? 'text-ink' : 'text-ink-3')}>
                {item}
              </span>
            </li>
          ))}
        </ol>
        <p className="lp-small mt-3">
          {Math.min(done, PLAN.length)} of {PLAN.length} steps
        </p>
      </div>
    )
  }
  return (
    <div>
      <p className="lp-h3 lp-display text-accent">Resolved 14:24 by Claude Code.</p>
      <p className="mt-4 text-sm leading-6 text-ink-2">
        Twenty-two minutes from a screenshot to a fix, with the marked-up evidence, the plan and
        every comment still attached to the record.
      </p>
      <dl className="mt-5 grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-4">
        {[
          ['Open for', '22 min'],
          ['Comments', '3, one from Claude Code'],
          ['Activity', '9 entries, written by triggers'],
        ].map(([term, value]) => (
          <div key={term} className="col-span-2 grid grid-cols-subgrid border-t border-line py-2.5">
            <dt className="lp-small">{term}</dt>
            <dd className="lp-data text-ink">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/**
 * Bug #24 as the workspace shows it, at one point in its life. The whole record is built from the
 * app's own parts — the severity ticks, the state chip, the evidence and the panel beside it — so
 * the page demonstrates the product instead of picturing it.
 */
export function Record({ step, local }: { step: number; local: number }) {
  const current = STEPS[step]
  const resolved = step === 4
  const phase =
    step < 1 ? 'before' : step === 1 ? 'drawing' : resolved && local > 0.45 ? 'wiped' : 'done'
  return (
    <div className="lp-record" style={{ '--lp-draw': local } as CSSProperties}>
      <div className="lp-record-bar">
        <span aria-hidden="true" className="lp-ticks">
          <i />
          <i />
          <i />
          <i />
        </span>
        <span className="lp-data text-ink-2">24</span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          Checkout button hidden behind cookie banner
        </span>
        <span className="lp-chip shrink-0" data-done={resolved}>
          <i />
          {current.state} {current.time}
        </span>
      </div>
      <div className="grid grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)] gap-4 p-4 sm:gap-6 sm:p-5 lg:grid-cols-[minmax(0,15.5rem)_minmax(0,1fr)]">
        <Evidence phase={phase} />
        <div aria-live="polite" className="min-w-0 lg:min-h-[20rem]">
          <Panel step={step} local={local} />
        </div>
      </div>
    </div>
  )
}
