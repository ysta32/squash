import { useState } from 'react'
import { Check, X } from 'lucide-react'
import { cn, isMac } from '../lib/utils'
import { Button, Kbd } from './ui'

export interface GettingStartedProps {
  workspaceId: string
  steps: { filed: boolean; invited: boolean; claude: boolean; resolved: boolean }
  onInvite?: () => void
  onClaudeSetup?: () => void
}

export function GettingStarted(props: GettingStartedProps) {
  return <Checklist key={props.workspaceId} {...props} />
}

function Checklist({ workspaceId, steps, onInvite, onClaudeSetup }: GettingStartedProps) {
  const storageKey = `squash:getting-started:${workspaceId}`
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(storageKey) === 'true'
    } catch {
      return false
    }
  })
  const completed = Object.values(steps).filter(Boolean).length

  if (dismissed || completed === 4) return null

  const items = [
    {
      id: 'filed',
      label: 'File your first bug',
      action: (
        <span>
          <Kbd>{isMac ? '⌘V' : 'Ctrl+V'}</Kbd> a screenshot, then <Kbd>Enter</Kbd>
        </span>
      ),
    },
    {
      id: 'invited',
      label: 'Invite a teammate',
      action: onInvite && (
        <Button size="sm" variant="ghost" onClick={onInvite}>
          Invite
        </Button>
      ),
    },
    {
      id: 'claude',
      label: 'Connect Claude Code',
      action: onClaudeSetup && (
        <Button size="sm" variant="ghost" onClick={onClaudeSetup}>
          Set up
        </Button>
      ),
    },
    {
      id: 'resolved',
      label: 'Resolve a bug',
      action: (
        <span>
          press <Kbd>R</Kbd>
        </span>
      ),
    },
  ] as const

  return (
    <div className="mx-2 mb-1 mt-2 rounded-lg border border-border bg-bg-elevated px-3 pb-2 pt-2.5">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-medium">Get started</h2>
        <span className="text-xs tabular-nums text-muted">{completed} of 4</span>
        <Button
          size="sm"
          variant="ghost"
          className="-mr-1.5 ml-auto w-7 px-0"
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
      <div aria-hidden="true" className="mb-1.5 mt-2 h-1 overflow-hidden rounded-full bg-fg/[0.07]">
        <div
          className="t h-full rounded-full bg-accent"
          style={{ width: `${(completed / 4) * 100}%` }}
        />
      </div>
      <ol aria-label="Getting started">
        {items.map(({ id, label, action }) => (
          <li key={id} className="flex min-h-8 flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
            <span
              aria-hidden="true"
              className={cn(
                'flex h-4 w-4 shrink-0 items-center justify-center rounded-full',
                steps[id] ? 'bg-success/15 text-success' : 'border border-dashed border-muted/60',
              )}
            >
              {steps[id] && <Check size={11} strokeWidth={2.5} />}
            </span>
            <span className="sr-only">{steps[id] ? 'Done' : 'To do'}</span>
            <span className={cn(steps[id] ? 'text-muted line-through' : 'text-fg')}>{label}</span>
            {!steps[id] && (
              <span className="ml-auto flex items-center gap-1 text-muted">{action}</span>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}
