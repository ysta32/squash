import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useOverlayOpen } from '../hooks/useKeyboard'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { useCoarsePointer } from '../hooks/useCoarsePointer'
import { markTourSeen } from '../lib/tour'
import { cn } from '../lib/utils'
import { Button, ENTER_KEY, Kbd, Keys, MOD_KEY, proseLinkClass } from './ui'
import { DialogHeader } from './DialogHeader'
import { dialogClass, dialogMaxHeightClass, dialogPositionClass, scrimClass } from './dialogStyles'

interface Stop {
  id: string
  title: string
  body: (touch: boolean, close: () => void) => ReactNode
}

const ROW = 'flex items-baseline gap-3 border-b border-line py-2.5'
const MARK = 'w-4 shrink-0 font-mono text-xs text-ink-3 nums'

function Rows({ items }: { items: ReactNode[] }) {
  return (
    <ol className="mt-4 border-t border-line text-sm text-ink-2">
      {items.map((item, i) => (
        <li key={i} className={ROW}>
          <span className={MARK}>{String.fromCharCode(65 + i)}</span>
          <span className="min-w-0">{item}</span>
        </li>
      ))}
    </ol>
  )
}

/** The tour, in the order you meet things in a workspace. */
const STOPS: Stop[] = [
  {
    id: 'capture',
    title: 'File anything in one line',
    body: (touch) => (
      <>
        <p>
          The capture bar at the top files whatever you are looking at. Every item gets a number, so
          a teammate (or Claude) can find it again.
        </p>
        <Rows
          items={[
            touch ? (
              'Tap the paperclip to attach a screenshot or photo'
            ) : (
              <>
                Paste a screenshot with <Keys keys={[MOD_KEY, 'V']} />, or press <Kbd>N</Kbd> and
                type
              </>
            ),
            'Describe what is wrong; a pasted link becomes the page it happened on',
            touch ? (
              'Tap File to send it to everyone in the workspace'
            ) : (
              <>
                Press <Kbd>{ENTER_KEY}</Kbd> to file it for everyone in the workspace
              </>
            ),
          ]}
        />
      </>
    ),
  },
  {
    id: 'kinds',
    title: 'Bugs, features, tests and to-dos',
    body: () => (
      <>
        <p>
          The tabs above the list keep four kinds of work apart. The capture bar files into the tab
          you are on, and any item can move to another kind from its … menu.
        </p>
        <Rows
          items={[
            <>
              <strong className="font-medium text-ink">Bugs</strong>: something that is broken
            </>,
            <>
              <strong className="font-medium text-ink">Features</strong>: something to build or
              change
            </>,
            <>
              <strong className="font-medium text-ink">Tests</strong>: a test to write or run
            </>,
            <>
              <strong className="font-medium text-ink">To-dos</strong>: anything else the project
              needs doing
            </>,
          ]}
        />
      </>
    ),
  },
  {
    id: 'work',
    title: 'Work the list together',
    body: (touch) => (
      <>
        <p>
          The list is live: new items, comments and resolutions reach every teammate in about a
          second. Open an item to read it, draw on its screenshots, comment and assign it.
        </p>
        <Rows
          items={
            touch
              ? [
                  'Tap an item to open it; Back returns to the list',
                  'Tap Resolve when it is fixed, with a note on what changed',
                  'Open, Resolved and All tabs keep the counts honest',
                ]
              : [
                  <>
                    <Kbd>J</Kbd> <Kbd>K</Kbd> move through the list
                  </>,
                  <>
                    <Kbd>R</Kbd> resolves, <Kbd>O</Kbd> reopens, <Kbd>I</Kbd> assigns it to you
                  </>,
                  <>
                    <Keys keys={[MOD_KEY, 'K']} /> opens the command palette; <Kbd>?</Kbd> lists
                    every shortcut
                  </>,
                ]
          }
        />
      </>
    ),
  },
  {
    id: 'claude',
    title: 'Hand work to Claude Code',
    body: () => (
      <>
        <p>
          With the free helper installed on your computer, Squash can open Claude Code on any item,
          screenshots included, in your project folder. Your code never passes through Squash.
        </p>
        <Rows
          items={[
            <>
              <strong className="font-medium text-ink">Send to Claude Code</strong> from an item:
              Claude fixes it, verifies it, commits and pushes
            </>,
            <>
              The <strong className="font-medium text-ink">Running</strong> tab follows every run in
              the workspace live, with Claude’s summary at the end
            </>,
            <>
              <strong className="font-medium text-ink">Ship to main</strong> lands an item’s work on
              the default branch, pushes it and checks the deploy
            </>,
            <>
              <strong className="font-medium text-ink">Auto-fix</strong> (Settings → Claude Code)
              sends each new item to Claude as you file it. Off by default
            </>,
          ]}
        />
      </>
    ),
  },
  {
    id: 'team',
    title: 'Bring your team',
    body: (_touch, close) => (
      <>
        <p>
          Squash is free, for teams of up to 10. Use <strong className="font-medium">Invite</strong>{' '}
          in the header to copy the workspace’s invite link; anyone who opens it can sign in and
          join.
        </p>
        <p className="mt-3">
          The “Get started” checklist tracks your first steps, and you can take this tour again from
          the command palette or your profile menu. The{' '}
          <Link to="/docs/getting-started" onClick={close} className={proseLinkClass}>
            docs
          </Link>{' '}
          cover everything else.
        </p>
      </>
    ),
  },
]

export interface TourDialogProps {
  open: boolean
  onClose: () => void
}

export function TourDialog({ open, onClose }: TourDialogProps) {
  if (!open) return null
  // Mounted only while open, so every opening starts at the first stop.
  return <Tour onClose={onClose} />
}

function Tour({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  const [at, setAt] = useState(0)
  const touch = useCoarsePointer()
  useOverlayOpen(true)
  useFocusTrap(dialogRef, true, { initialFocus: 'field' })

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  const close = () => {
    markTourSeen()
    onClose()
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        markTourSeen()
        onCloseRef.current()
      } else if (e.key === 'ArrowRight') {
        setAt((i) => Math.min(i + 1, STOPS.length - 1))
      } else if (e.key === 'ArrowLeft') {
        setAt((i) => Math.max(i - 1, 0))
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  const stop = STOPS[at]
  const last = at === STOPS.length - 1

  return (
    <div
      className={cn(scrimClass, dialogPositionClass)}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        className={cn(dialogClass, dialogMaxHeightClass, 'max-w-lg overflow-y-auto p-6')}
      >
        <DialogHeader
          eyebrow={`Tour · ${at + 1} of ${STOPS.length}`}
          title={stop.title}
          titleId="tour-title"
          onClose={close}
        />
        <div aria-live="polite" className="mt-3 text-sm leading-6 text-ink-2">
          {stop.body(touch, close)}
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <ol aria-label="Tour steps" className="mr-auto flex items-center gap-1">
            {STOPS.map((s, i) => (
              <li key={s.id}>
                <button
                  type="button"
                  aria-label={`Step ${i + 1}: ${s.title}`}
                  aria-current={i === at ? 'step' : undefined}
                  onClick={() => setAt(i)}
                  className="t focus-ring flex size-6 items-center justify-center rounded-full pointer-coarse:size-[3.1429rem]"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'block h-1.5 rounded-full transition-[width,background-color] duration-(--dur-standard)',
                      i === at ? 'w-4 bg-accent' : 'w-1.5 bg-line-2',
                    )}
                  />
                </button>
              </li>
            ))}
          </ol>
          {at > 0 ? (
            <Button variant="ghost" onClick={() => setAt(at - 1)}>
              Back
            </Button>
          ) : (
            <Button variant="ghost" onClick={close}>
              Skip
            </Button>
          )}
          <Button variant="primary" onClick={last ? close : () => setAt(at + 1)}>
            {last ? 'Done' : 'Next'}
          </Button>
        </div>
      </div>
    </div>
  )
}
