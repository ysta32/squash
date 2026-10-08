import { useState, type ReactNode } from 'react'
import { Check, X } from 'lucide-react'
import type { BugFilters } from '../hooks/useBugs'
import { useCoarsePointer } from '../hooks/useCoarsePointer'
import type { OnboardingSteps } from '../lib/onboarding'
import { cn } from '../lib/utils'
import { EmptyState, FileGuide } from './EmptyState'
import { Button, Kbd } from './ui'

export interface GettingStartedProps {
  workspaceId: string
  steps: OnboardingSteps
  onInvite?: () => void
  onClaudeSetup?: () => void
  /** `pane`: the focal point of the empty detail pane, on the detail column's gutter. */
  variant?: 'list' | 'pane'
  /** Shown instead when the checklist is dismissed or complete. */
  fallback?: ReactNode
}

/** Step actions read as quiet accent links, not as bare words. */
const ACTION = '-mr-1.5 text-accent! hover:text-accent-strong! pointer-coarse:h-[3.1429rem]'

export function GettingStarted(props: GettingStartedProps) {
  return <Checklist key={props.workspaceId} {...props} />
}

function Checklist({
  workspaceId,
  steps,
  onInvite,
  onClaudeSetup,
  variant = 'list',
  fallback = null,
}: GettingStartedProps) {
  const storageKey = `squash:getting-started:${workspaceId}`
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(storageKey) === 'true'
    } catch {
      return false
    }
  })
  const touch = useCoarsePointer()
  const completed = Object.values(steps).filter(Boolean).length

  if (dismissed || completed === 4) return fallback

  const items = [
    // Its how-to is spelled out under the step (FileGuide) rather than squeezed beside it.
    { id: 'filed', label: 'File your first bug', action: null },
    {
      id: 'invited',
      label: 'Invite a teammate',
      action: onInvite && (
        <Button size="sm" variant="ghost" className={ACTION} onClick={onInvite}>
          Invite
        </Button>
      ),
    },
    {
      id: 'claude',
      label: 'Connect Claude Code',
      action: onClaudeSetup && (
        <Button size="sm" variant="ghost" className={ACTION} onClick={onClaudeSetup}>
          Set up
        </Button>
      ),
    },
    {
      id: 'resolved',
      label: 'Resolve a bug',
      action: touch ? (
        <span>Open one and tap Resolve</span>
      ) : (
        <span className="flex items-center gap-1">
          Press <Kbd>R</Kbd>
        </span>
      ),
    },
  ] as const

  return (
    // A ruled section at the head of the list, not a card (DESIGN.md: hairline rules over cards).
    <section
      aria-label="Get started"
      className={cn(
        variant === 'pane'
          ? // Lines up with the detail column and its empty states (StatePanel inset="deep").
            'max-w-[calc(30rem+96px)] px-4 pt-[72px] pb-[48px] sm:px-6 lg:px-[48px]'
          : 'border-b border-line px-4 pt-3 pb-1.5',
      )}
    >
      <div className="flex items-center gap-2">
        <h2 className="font-mono text-label font-medium tracking-[0.06em] text-ink-2 uppercase">
          Get started
        </h2>
        <span className="font-mono text-label text-ink-3 tabular-nums">{completed} of 4</span>
        <Button
          size="sm"
          variant="ghost"
          className="-mr-1.5 ml-auto w-[2.2857rem] px-0 text-ink-3 hover:text-ink pointer-coarse:h-[3.1429rem] pointer-coarse:w-[3.1429rem]"
          aria-label="Dismiss getting started"
          title="Dismiss"
          onClick={() => {
            setDismissed(true)
            try {
              localStorage.setItem(storageKey, 'true')
            } catch {
              // Dismissal still works when storage is unavailable.
            }
          }}
        >
          <X size={14} aria-hidden="true" />
        </Button>
      </div>
      {/* Progress as a 2px rule; it grows with transform only. */}
      <div aria-hidden="true" className="mt-1.5 mb-1 h-[2px] overflow-hidden bg-line">
        <div
          className="h-full origin-left bg-accent transition-transform duration-(--dur-standard) ease-(--ease-out)"
          style={{ transform: `scaleX(${completed / 4})` }}
        />
      </div>
      <ol aria-label="Getting started">
        {items.map(({ id, label, action }) => (
          <li
            key={id}
            className="flex min-h-[2.2857rem] flex-wrap items-center gap-x-2.5 gap-y-1 text-sm pointer-coarse:min-h-[3.1429rem]"
          >
            <span
              aria-hidden="true"
              className={cn(
                'flex size-4 shrink-0 items-center justify-center rounded-full',
                steps[id] ? 'text-status-resolved' : 'border border-dashed border-line-input',
              )}
            >
              {steps[id] && <Check size={14} strokeWidth={2} />}
            </span>
            <span className="sr-only">{steps[id] ? 'Done' : 'To do'}</span>
            <span className={cn(steps[id] ? 'text-muted line-through' : 'text-ink')}>{label}</span>
            {!steps[id] && action && (
              <span className="ml-auto flex items-center gap-1 text-xs text-ink-3">{action}</span>
            )}
            {id === 'filed' && !steps.filed && (
              // Indented to the step label: the 16px mark plus the row's 10px gap.
              <FileGuide className="mb-1.5 basis-full pl-[26px]" />
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}

export interface OnboardingProps extends Omit<GettingStartedProps, 'fallback' | 'workspaceId'> {
  /** Without one (no workspace route) there is no checklist to keep, only the empty state. */
  workspaceId?: string
  kind: BugFilters['kind']
  tab: BugFilters['tab']
}

/**
 * What an empty kind shows in place of its list: the getting-started checklist while nothing has
 * been filed anywhere (its first step carries the how-to), otherwise, or once the checklist is
 * dismissed, the "File your first …" empty state. Never both, so the call to action appears once.
 */
export function Onboarding({
  workspaceId,
  kind,
  tab,
  variant = 'list',
  ...props
}: OnboardingProps) {
  const first = (
    <EmptyState
      kind={kind}
      tab={tab}
      filtered={false}
      inset={variant === 'pane' ? 'deep' : 'default'}
    />
  )
  if (props.steps.filed || !workspaceId) return first
  return <GettingStarted {...props} workspaceId={workspaceId} variant={variant} fallback={first} />
}
