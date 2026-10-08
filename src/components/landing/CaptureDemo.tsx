import { useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { cn } from '../../lib/utils'
import { buttonClass } from '../ui'

const SEVERITIES = ['low', 'medium', 'high', 'critical'] as const
type Severity = (typeof SEVERITIES)[number]

const SEV_COLOR: Record<Severity, string> = {
  low: 'bg-sev-low',
  medium: 'bg-sev-medium',
  high: 'bg-sev-high',
  critical: 'bg-sev-critical',
}

interface Row {
  number: number
  title: string
  severity: Severity
  time: string
  fresh?: boolean
}

/** The demo workspace's two newest bugs; anything you file here is numbered from #26. */
const SEED: Row[] = [
  {
    number: 24,
    title: 'Checkout button hidden behind cookie banner on iPhone',
    severity: 'critical',
    time: '6m',
  },
  {
    number: 23,
    title: 'Revenue chart labels overlap when the range is 90 days',
    severity: 'high',
    time: '38m',
  },
]
const MAX_ROWS = 4

/** Field-notebook tally: 1–4 ticks, never color alone. */
function Ticks({ severity }: { severity: Severity }) {
  const level = SEVERITIES.indexOf(severity) + 1
  return (
    <span aria-hidden="true" className="inline-flex h-2 items-end gap-0.5">
      {SEVERITIES.map((s, i) => (
        <span
          key={s}
          className={cn('h-2 w-0.5 rounded-xs', i < level ? SEV_COLOR[severity] : 'bg-line-2')}
        />
      ))}
    </span>
  )
}

/**
 * A working miniature of the capture bar. It runs entirely in this page (nothing is sent) and
 * does not import the app, so the landing chunk stays small.
 */
export function CaptureDemo() {
  const [rows, setRows] = useState<Row[]>(SEED)
  const [draft, setDraft] = useState('')
  const [severity, setSeverity] = useState<Severity>('medium')
  const [status, setStatus] = useState('')
  const next = useRef(26)
  const inputRef = useRef<HTMLInputElement>(null)
  const inputId = useId()
  const hintId = useId()

  function file(e: FormEvent) {
    e.preventDefault()
    const title = draft.trim()
    if (!title) {
      setStatus('Type what broke first.')
      inputRef.current?.focus()
      return
    }
    const number = next.current++
    setRows((current) =>
      [{ number, title, severity, time: 'now', fresh: true }, ...current].slice(0, MAX_ROWS),
    )
    setDraft('')
    setStatus(`Filed #${number}`)
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    const digit = /^Digit([1-4])$/.exec(e.code)?.[1]
    if (e.altKey && digit) {
      e.preventDefault()
      const picked = SEVERITIES[Number(digit) - 1]
      setSeverity(picked)
      setStatus(`Severity: ${picked}`)
    }
  }

  function cycleSeverity() {
    const picked = SEVERITIES[(SEVERITIES.indexOf(severity) + 1) % SEVERITIES.length]
    setSeverity(picked)
    setStatus(`Severity: ${picked}`)
  }

  return (
    <div>
      <form onSubmit={file} aria-label="Capture bar demo">
        <div className="t flex h-12 items-center gap-1 rounded-lg border border-line-input bg-surface-2 pr-1.5 pl-3 shadow-elev-1 focus-within:border-focus focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus">
          <label htmlFor={inputId} className="sr-only">
            Describe a bug
          </label>
          <input
            ref={inputRef}
            id={inputId}
            value={draft}
            maxLength={120}
            autoComplete="off"
            aria-describedby={hintId}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Describe a bug, press Enter"
            className="h-full min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-3"
          />
          <button
            type="button"
            onClick={cycleSeverity}
            aria-label={`Severity: ${severity}. Change with Alt+1 to 4`}
            title="Severity (Alt+1–4)"
            className="t focus-ring inline-flex h-9 items-center gap-2 rounded-md px-2 text-xs text-ink-2 capitalize hover:bg-surface-3"
          >
            <Ticks severity={severity} />
            <span className="hidden sm:inline">{severity}</span>
          </button>
          <button type="submit" className={buttonClass('primary', 'sm', 'h-9 gap-2 px-3')}>
            File
            <kbd aria-hidden="true" className="font-mono text-xs opacity-80">
              ↵
            </kbd>
          </button>
        </div>
        <p id={hintId} className="mt-2 text-xs text-ink-3">
          Alt+1–4 sets severity. Runs in this page; nothing is sent.
        </p>
        <p role="status" className="sr-only">
          {status}
        </p>
      </form>
      <ul aria-label="Demo bug list" className="mt-4 divide-y divide-line border-y border-line">
        {rows.map((row) => (
          <li
            key={row.number}
            className={cn(
              'grid h-10 grid-cols-[1rem_3ch_minmax(0,1fr)_auto] items-center gap-3 px-1 text-sm',
              row.fresh && 'mk-arrive',
            )}
          >
            <Ticks severity={row.severity} />
            <span className="text-right font-mono text-xs font-medium text-ink-3 tabular-nums">
              {row.number}
            </span>
            <span className="truncate font-medium">{row.title}</span>
            <span className="font-mono text-xs text-ink-3 tabular-nums">{row.time}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
