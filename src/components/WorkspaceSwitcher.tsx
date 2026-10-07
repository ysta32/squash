import { useCallback, useRef, useState, type KeyboardEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Check, ChevronsUpDown, Plus } from 'lucide-react'
import type { Workspace } from '../lib/types'
import { setLastWorkspace } from '../hooks/useWorkspaces'
import { useDismiss } from '../hooks/useDismiss'
import { cn } from '../lib/utils'

const ITEM =
  't focus-ring flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-bg-subtle focus-visible:bg-bg-subtle'

export interface WorkspaceSwitcherProps {
  workspace: Workspace
  workspaces: Workspace[]
}

export function WorkspaceSwitcher({ workspace, workspaces }: WorkspaceSwitcherProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const close = useCallback(() => setOpen(false), [])
  useDismiss(ref, close, open)

  const select = (id: string) => {
    setOpen(false)
    setLastWorkspace(id)
    navigate(`/app/${id}`)
  }

  const onMenuKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]'))
    const at = items.indexOf(document.activeElement as HTMLElement)
    const next = e.key === 'ArrowDown' ? at + 1 : at - 1
    items[(next + items.length) % items.length]?.focus()
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Switch workspace"
        className={cn(
          't focus-ring flex h-8 min-w-0 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-fg hover:bg-bg-subtle',
          open && 'bg-bg-subtle',
        )}
      >
        <span className="max-w-[9rem] truncate sm:max-w-[14rem]">{workspace.name}</span>
        <ChevronsUpDown aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-muted" />
      </button>
      {open && (
        <div
          role="menu"
          onKeyDown={onMenuKey}
          aria-label="Workspaces"
          className="t absolute left-0 top-full z-30 mt-1 w-60 max-w-[calc(100vw-1.5rem)] rounded-lg border border-border bg-bg-elevated p-1 shadow-elevated starting:-translate-y-1 starting:opacity-0"
        >
          <div
            role="none"
            className="px-2 pt-1.5 pb-1 text-[11px] font-medium tracking-wide text-muted uppercase"
          >
            Workspaces
          </div>
          {workspaces.map((w) => (
            <button
              key={w.id}
              type="button"
              role="menuitem"
              onClick={() => select(w.id)}
              aria-current={w.id === workspace.id ? 'true' : undefined}
              className={cn(ITEM, 'text-fg', w.id === workspace.id && 'font-medium')}
            >
              <span className="min-w-0 flex-1 truncate">{w.name}</span>
              {w.id === workspace.id && (
                <Check aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-accent" />
              )}
            </button>
          ))}
          <div role="separator" className="-mx-1 my-1 border-t border-border" />
          <Link
            to="/app?new=1"
            role="menuitem"
            onClick={() => setOpen(false)}
            className={cn(ITEM, 'text-muted hover:text-fg')}
          >
            <Plus aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
            Create or join…
          </Link>
        </div>
      )}
    </div>
  )
}
