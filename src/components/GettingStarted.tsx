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
    <div className="m-3 rounded-lg border border-border bg-bg-elevated p-3">
      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-sm font-medium">Get started</h2>
        <span className="text-xs text-muted">{completed} of 4</span>
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto px-1.5"
          aria-label="Dismiss getting started"
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
      <ol aria-label="Getting started" className="space-y-2">
        {items.map(({ id, label, action }) => (
          <li key={id} className="flex flex-wrap items-center gap-2 text-xs">
            <span
              aria-hidden="true"
              className={cn(
                'flex h-4 w-4 shrink-0 items-center justify-center rounded-full',
                steps[id] ? 'bg-success/15 text-success' : 'border border-border',
              )}
            >
              {steps[id] && <Check size={12} />}
            </span>
            <span className="sr-only">{steps[id] ? 'Done' : 'To do'}</span>
            <span className={cn(steps[id] && 'text-muted line-through')}>{label}</span>
            {!steps[id] && <span className="ml-auto text-muted">{action}</span>}
          </li>
        ))}
      </ol>
    </div>
  )
}
