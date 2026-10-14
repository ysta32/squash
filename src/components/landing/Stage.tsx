import { useEffect } from 'react'
import { cn } from '../../lib/utils'
import { MK_CONTAINER } from '../marketing/MarketingLayout'
import { STEPS } from './lifecycle'
import { Record } from './Record'
import { useScrub } from './useScrub'
import { useTilt } from './useTilt'

/** The page's own status line, pinned to the window: the bug's state, and the keys that move it. */
function StatusBar({
  step,
  local,
  go,
}: {
  step: number
  local: number
  go: (step: number) => void
}) {
  const current = STEPS[step]
  return (
    <div className="lp-status">
      <span
        aria-hidden="true"
        className="lp-progress"
        style={{ scale: `${(step + local) / STEPS.length} 1` }}
      />
      <span className="shrink-0 font-semibold text-ink-2">squash</span>
      <div className="flex min-w-0 gap-0.5 overflow-hidden max-md:hidden">
        {STEPS.map((s, i) => (
          <button
            key={s.key}
            type="button"
            onClick={() => go(i)}
            aria-current={i === step}
            className="lp-key focus-ring"
          >
            <b>{s.key}</b>
            {s.state}
          </button>
        ))}
      </div>
      <p className="ml-auto flex shrink-0 items-center gap-2.5 tabular-nums">
        <span className="text-ink-2">bug 24</span>
        <span className={step === 4 ? 'text-ink' : 'text-accent'}>{current.state}</span>
        <time dateTime={`2026-10-06T${current.time}`}>{current.time}</time>
      </p>
    </div>
  )
}

/**
 * The stage: one track five screens tall with bug #24 held still in the middle of the window
 * while the scroll walks it through its own life — filed, marked up, seen by the team, handed to
 * Claude Code, resolved. The scroll is continuous, so the markup is drawn by the wheel and the
 * plan ticks off under it; the five keys in the status bar jump between the same five states.
 */
export function Stage() {
  const { track, scrub, go } = useScrub(STEPS.length)
  const [stage, plane] = useTilt<HTMLDivElement>(3)
  const { step, local } = scrub

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (target?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName ?? ''))
        return
      const index = STEPS.findIndex((s) => s.key === event.key.toLowerCase())
      if (index < 0) return
      event.preventDefault()
      go(index)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go])

  return (
    <>
      <StatusBar step={step} local={local} go={go} />
      <section
        id="features"
        aria-labelledby="stage-heading"
        ref={track}
        className="lp-track border-t border-line"
        style={{ height: `${STEPS.length * 75}svh` }}
      >
        <div ref={stage} className="lp-sticky lp-stage3">
          <div className={cn(MK_CONTAINER, 'grid w-full gap-8 lg:grid-cols-12 lg:gap-12')}>
            <div className="min-w-0 lg:col-span-4">
              <p className="lp-mark">the life of bug 24</p>
              <h2 id="stage-heading" className="lp-display mt-4 text-[clamp(1.85rem,2.7vw,2.7rem)]">
                {STEPS[step].title}
              </h2>
              <p className="lp-read mt-5 max-w-[42ch] text-[1.0714rem]">{STEPS[step].body}</p>
              <div aria-hidden="true" className="mt-8 h-px bg-line">
                <span
                  className="block h-px bg-markup"
                  style={{ width: `${((step + local) / STEPS.length) * 100}%` }}
                />
              </div>
              <ol className="mt-4 flex gap-5">
                {STEPS.map((s, i) => (
                  <li key={s.key}>
                    <button
                      type="button"
                      onClick={() => go(i)}
                      aria-current={i === step ? 'step' : undefined}
                      className={cn(
                        'lp-data t focus-ring',
                        i === step
                          ? 'text-accent'
                          : i < step
                            ? 'text-ink-2 hover:text-ink'
                            : 'text-ink-3 hover:text-ink',
                      )}
                    >
                      <span className="sr-only">Step </span>
                      {String(i + 1).padStart(2, '0')}
                      <span className="sr-only">: {s.state}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
            <div ref={plane} className="lp-plane min-w-0 lg:col-span-8">
              <Record step={step} local={local} />
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
