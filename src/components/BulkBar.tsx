import { useRef, useState } from 'react'
import { Check, Copy, FolderCog, RotateCcw, Sparkle, X } from 'lucide-react'
import type { BugWithMeta, WorkspaceMember } from '../lib/types'
import { AssigneePicker } from './AssigneePicker'
import { useToast } from './Toast'

export interface BulkBarProps {
  bugs: BugWithMeta[]
  members: WorkspaceMember[]
  selfId: string
  onResolve: (id: string, note: string | null) => Promise<void>
  onReopen: (id: string, note: string | null) => Promise<void>
  onAssign: (id: string, userId: string | null) => Promise<void>
  onClear: () => void
  onSend?: (bugs: BugWithMeta[]) => void
  onCopy?: (bugs: BugWithMeta[]) => void
  onClaudeSetup?: () => void
}

// Quiet ghost actions: 32px (44px on touch), ink-2 text, no fills (DESIGN.md: one filled button per screen).
const buttonClass =
  't focus-ring inline-flex h-[2.2857rem] shrink-0 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-ink-2 hover:bg-surface-3 hover:text-ink disabled:pointer-events-none disabled:text-ink-3 pointer-coarse:h-[3.1429rem] [&_svg]:size-4'
const iconClass = `${buttonClass} w-[2.2857rem] justify-center px-0 pointer-coarse:w-[3.1429rem]`

export function BulkBar({
  bugs,
  members,
  selfId,
  onResolve,
  onReopen,
  onAssign,
  onClear,
  onSend,
  onCopy,
  onClaudeSetup,
}: BulkBarProps) {
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)
  const saved = bugs.filter((bug) => !bug.optimistic)
  const open = saved.filter((bug) => bug.status === 'open')
  const resolved = saved.filter((bug) => bug.status === 'resolved')

  async function run(
    targets: BugWithMeta[],
    update: (id: string) => Promise<void>,
    verb: string,
    done: string,
  ) {
    if (inFlight.current || targets.length === 0) return
    inFlight.current = true
    setBusy(true)
    try {
      const results = await Promise.allSettled(targets.map(async (bug) => update(bug.id)))
      const failed = results.filter((result) => result.status === 'rejected').length
      const succeeded = results.length - failed
      if (succeeded) {
        const previous = targets.filter((_, index) => results[index].status === 'fulfilled')
        toast(`${done} ${succeeded} ${succeeded === 1 ? 'bug' : 'bugs'}`, {
          tone: 'success',
          action: {
            label: 'Undo',
            onAction: () => {
              void Promise.allSettled(
                previous.map(async (bug) => {
                  if (verb === 'assign') await onAssign(bug.id, bug.assignee_id)
                  else if (bug.status === 'open') await onReopen(bug.id, bug.resolution_note)
                  else await onResolve(bug.id, bug.resolution_note)
                }),
              ).then((undone) => {
                const failures = undone.filter((result) => result.status === 'rejected').length
                if (failures)
                  toast(`Could not undo ${failures} ${failures === 1 ? 'bug' : 'bugs'}.`, {
                    tone: 'error',
                  })
              })
            },
          },
        })
      }
      if (failed)
        toast(`Could not ${verb} ${failed} ${failed === 1 ? 'item' : 'items'}.`, { tone: 'error' })
    } finally {
      inFlight.current = false
      setBusy(false)
      onClear()
    }
  }

  if (bugs.length === 0) return null

  return (
    <div
      role="group"
      aria-label="Bulk actions"
      aria-busy={busy}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          event.nativeEvent.stopImmediatePropagation()
          onClear()
        }
      }}
      className="focus-ring-inset flex min-h-[2.8571rem] shrink-0 flex-wrap items-center gap-x-1 border-t border-line bg-surface-2 py-1 pr-2 pl-4 pointer-coarse:min-h-[3.4286rem]"
    >
      <span className="mr-2 shrink-0 font-mono text-label tracking-[0.06em] text-ink uppercase tabular-nums">
        {bugs.length} selected
      </span>
      {open.length > 0 && (
        <button
          type="button"
          disabled={busy}
          className={buttonClass}
          onClick={() => void run(open, (id) => onResolve(id, null), 'resolve', 'Resolved')}
        >
          <Check strokeWidth={1.5} aria-hidden="true" /> Resolve
        </button>
      )}
      {resolved.length > 0 && (
        <button
          type="button"
          disabled={busy}
          className={buttonClass}
          onClick={() => void run(resolved, (id) => onReopen(id, null), 'reopen', 'Reopened')}
        >
          <RotateCcw strokeWidth={1.5} aria-hidden="true" /> Reopen
        </button>
      )}
      {/* The bar sits at the bottom of the pane, so the picker's menu opens upwards. */}
      <span className="inline-flex px-2">
        <AssigneePicker
          members={members}
          selfId={selfId}
          value={null}
          disabled={busy || saved.length === 0}
          side="above"
          align="start"
          onChange={(userId) => void run(saved, (id) => onAssign(id, userId), 'assign', 'Assigned')}
        />
      </span>
      {onSend && saved.length > 0 && (
        <button type="button" className={buttonClass} onClick={() => onSend(saved)}>
          <Sparkle strokeWidth={1.75} aria-hidden="true" className="text-accent" /> Send{' '}
          <span className="font-mono tabular-nums">{saved.length}</span> to Claude Code
        </button>
      )}
      {onCopy && saved.length > 0 && (
        <button
          type="button"
          className={iconClass}
          aria-label="Copy selected items for Claude"
          title="Copy a prompt for Claude Code"
          onClick={() => onCopy(saved)}
        >
          <Copy strokeWidth={1.5} aria-hidden="true" />
        </button>
      )}
      {onClaudeSetup && (
        <button
          type="button"
          className={iconClass}
          aria-label="Claude Code setup"
          title="Claude Code project folder"
          onClick={onClaudeSetup}
        >
          <FolderCog strokeWidth={1.5} aria-hidden="true" />
        </button>
      )}
      <button
        type="button"
        className={`${buttonClass} ml-auto`}
        aria-keyshortcuts="Escape"
        onClick={onClear}
      >
        <X strokeWidth={1.5} aria-hidden="true" />
        <span className="max-sm:sr-only">Clear selection</span>
      </button>
    </div>
  )
}
