import { useRef, useState } from 'react'
import { Bot, Check, Copy, FolderCog, RotateCcw, X } from 'lucide-react'
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

const buttonClass =
  't focus-ring inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted hover:bg-bg-subtle hover:text-fg disabled:pointer-events-none disabled:opacity-50'

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
      if (succeeded)
        toast(`${done} ${succeeded} ${succeeded === 1 ? 'item' : 'items'}.`, { tone: 'success' })
      if (failed)
        toast(`Could not ${verb} ${failed} ${failed === 1 ? 'item' : 'items'}.`, { tone: 'error' })
    } finally {
      inFlight.current = false
      setBusy(false)
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
      className="focus-ring flex flex-wrap items-center gap-1 rounded-md border border-border bg-bg-subtle p-2"
    >
      <span className="mr-1 text-xs font-medium">{bugs.length} selected</span>
      {open.length > 0 && (
        <button
          type="button"
          disabled={busy}
          className={buttonClass}
          onClick={() => void run(open, (id) => onResolve(id, null), 'resolve', 'Resolved')}
        >
          <Check size={14} aria-hidden="true" /> Resolve
        </button>
      )}
      {resolved.length > 0 && (
        <button
          type="button"
          disabled={busy}
          className={buttonClass}
          onClick={() => void run(resolved, (id) => onReopen(id, null), 'reopen', 'Reopened')}
        >
          <RotateCcw size={14} aria-hidden="true" /> Reopen
        </button>
      )}
      <AssigneePicker
        members={members}
        selfId={selfId}
        value={null}
        disabled={busy || saved.length === 0}
        onChange={(userId) => void run(saved, (id) => onAssign(id, userId), 'assign', 'Assigned')}
      />
      {onSend && saved.length > 0 && (
        <button type="button" className={buttonClass} onClick={() => onSend(saved)}>
          <Bot size={14} aria-hidden="true" /> Send {saved.length} to Claude
        </button>
      )}
      {onCopy && saved.length > 0 && (
        <button
          type="button"
          className={buttonClass}
          aria-label="Copy selected items for Claude"
          onClick={() => onCopy(saved)}
        >
          <Copy size={14} aria-hidden="true" />
        </button>
      )}
      {onClaudeSetup && (
        <button
          type="button"
          className={buttonClass}
          aria-label="Claude Code setup"
          onClick={onClaudeSetup}
        >
          <FolderCog size={14} aria-hidden="true" />
        </button>
      )}
      <button type="button" className={buttonClass} onClick={onClear}>
        <X size={14} aria-hidden="true" /> Clear selection
      </button>
    </div>
  )
}
