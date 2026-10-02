import { useEffect, useState } from 'react'
import { ArrowUp, Check, ImagePlus, MousePointer2, Pause, Play } from 'lucide-react'

const report = 'Checkout button overlaps footer on mobile'
const motionQuery = '(prefers-reduced-motion: reduce)'

export function LandingDemo() {
  const [reducedMotion, setReducedMotion] = useState(
    () => typeof window.matchMedia !== 'function' || window.matchMedia(motionQuery).matches,
  )
  const [paused, setPaused] = useState(false)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const media = window.matchMedia(motionQuery)
    const update = () => setReducedMotion(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (reducedMotion || paused) return
    let timers: ReturnType<typeof setTimeout>[] = []
    const cycle = () => {
      const steps = [0, 700, ...Array.from(report, (_, i) => 1400 + i * 45), 4000, 4300, 4700, 6800]
      timers = steps.map((time) => setTimeout(() => setElapsed(time), time))
      timers.push(setTimeout(cycle, 8000))
    }
    cycle()
    return () => timers.forEach(clearTimeout)
  }, [paused, reducedMotion])

  const time = reducedMotion ? 4700 : elapsed
  const pasted = time >= 700
  const submitted = time >= 4000
  const delivered = time >= 4300
  const toast = time >= 4700 && time < 6800
  const text = report.slice(0, Math.max(0, Math.floor((time - 1400) / 45) + 1))

  return (
    <section aria-label="Live collaboration demo" className="mx-auto mt-14 max-w-5xl text-left">
      <div className="mb-3 flex items-center justify-between gap-4 text-xs text-muted">
        <p>One bug. Two teammates. No meeting.</p>
        {!reducedMotion && (
          <button
            type="button"
            onClick={() => setPaused((value) => !value)}
            className="t flex items-center gap-1.5 rounded px-2 py-1 hover:bg-bg-subtle focus-visible:outline-2 focus-visible:outline-accent"
            aria-label={paused ? 'Play demo' : 'Pause demo'}
          >
            {paused ? <Play size={12} /> : <Pause size={12} />}
            {paused ? 'Play demo' : 'Pause demo'}
          </button>
        )}
      </div>
      <p className="sr-only">
        Demo: Alex pastes a screenshot, types “{report}”, and presses Enter. The report appears in a
        teammate’s list with the notification “Alex filed #14”.
      </p>
      <div
        aria-hidden="true"
        className="grid overflow-hidden rounded-xl border border-border bg-bg shadow-sm md:grid-cols-2"
      >
        <div className="border-b border-border p-5 md:border-r md:border-b-0 sm:p-7">
          <div className="mb-7 flex items-center gap-2 text-xs text-muted">
            <span className="flex size-6 items-center justify-center rounded-full bg-accent/15 font-medium text-accent">
              A
            </span>
            Alex’s workspace <span className="ml-auto">Capture</span>
          </div>
          <p className="mb-3 text-sm font-medium">Found something? Drop it here.</p>
          <div className="relative min-h-44 rounded-lg border border-border bg-bg-subtle p-4">
            <div
              className={`t mb-3 inline-flex items-center gap-2 rounded border border-border bg-bg px-2 py-1.5 text-xs ${pasted ? 'opacity-100' : 'opacity-0'}`}
            >
              <ImagePlus size={16} className="text-accent" /> checkout-mobile.png
              <span className="text-muted">124 KB</span>
            </div>
            <p className="min-h-12 text-sm leading-6">
              {text || <span className="text-muted">Describe the bug…</span>}
              {!submitted && (
                <span className="ml-0.5 inline-block h-4 w-px translate-y-0.5 bg-accent" />
              )}
            </p>
            <div className="mt-3 flex items-center justify-between text-xs text-muted">
              <span>{submitted ? 'Filed. Back to building.' : 'Paste, type, or speak'}</span>
              <span
                className={`t flex items-center gap-1 rounded px-2 py-1 ${submitted ? 'bg-accent text-accent-fg' : 'border border-border bg-bg'}`}
              >
                {submitted ? <Check size={13} /> : <ArrowUp size={13} />} Enter
              </span>
            </div>
            <MousePointer2
              size={20}
              className={`t absolute text-accent ${submitted ? 'right-6 bottom-5' : 'top-8 left-8'} ${time < 700 || submitted ? 'opacity-100' : 'opacity-0'}`}
            />
          </div>
        </div>
        <div className="p-5 sm:p-7">
          <div className="mb-7 flex items-center gap-2 text-xs text-muted">
            <span className="flex size-6 items-center justify-center rounded-full bg-emerald-500/15 font-medium text-emerald-600 dark:text-emerald-400">
              J
            </span>
            Jamie’s workspace
            <span className="ml-auto flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-emerald-500" /> Live
            </span>
          </div>
          <div className="mb-3 flex items-center justify-between text-sm font-medium">
            <span>Open bugs</span>
            <span className="text-xs text-muted">{delivered ? 3 : 2}</span>
          </div>
          <div className="min-h-44 space-y-2">
            <div
              className={`t rounded-lg border p-3 ${delivered ? 'translate-y-0 border-accent/30 bg-accent/10 opacity-100' : '-translate-y-2 border-transparent opacity-0'}`}
            >
              <p className="flex items-start gap-2 text-sm">
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-amber-500" />
                <span>{report}</span>
              </p>
              <p className="mt-1 pl-4 text-xs text-muted">#14 · Alex · just now · 1 screenshot</p>
            </div>
            {['#13 · Search loses focus after filtering', '#12 · Settings avatar looks blurry'].map(
              (bug) => (
                <div
                  key={bug}
                  className="rounded-lg border border-border px-3 py-2.5 text-xs text-muted"
                >
                  {bug}
                </div>
              ),
            )}
          </div>
          <div
            className={`t mt-4 flex items-center gap-2 rounded-lg border border-border bg-bg-subtle px-3 py-2 text-xs ${toast ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}
          >
            <Check size={14} className="text-accent" /> Alex filed #14
          </div>
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-muted">
        Illustrative demo · no account or real bug data involved
      </p>
    </section>
  )
}
