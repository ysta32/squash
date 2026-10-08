import { useCallback, useRef, useState, type KeyboardEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Check, ChevronsUpDown, Plus } from 'lucide-react'
import type { Workspace } from '../lib/types'
import { setLastWorkspace } from '../hooks/useWorkspaces'
import { useDismiss } from '../hooks/useDismiss'
import { cn } from '../lib/utils'
import { menuRowClass, popoverClass } from './dialogStyles'

const ITEM = menuRowClass

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
          't focus-ring flex h-8 min-w-0 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-ink hover:bg-surface-3 pointer-coarse:h-[3.1429rem]',
          open && 'bg-surface-3',
        )}
      >
        <span className="max-w-[9rem] truncate sm:max-w-[14rem]">{workspace.name}</span>
        <ChevronsUpDown aria-hidden="true" className="size-3.5 shrink-0 text-ink-3" />
      </button>
      {open && (
        <div
          role="menu"
          onKeyDown={onMenuKey}
          aria-label="Workspaces"
          className={cn(
            popoverClass,
            'absolute top-full left-0 z-30 mt-1.5 w-64 max-w-[calc(100vw-1.5rem)] p-1',
          )}
        >
          <div role="none" className="specimen-label px-2 pt-2 pb-1.5">
            Workspaces
          </div>
          {workspaces.map((w) => (
            <button
              key={w.id}
              type="button"
              role="menuitem"
              onClick={() => select(w.id)}
              aria-current={w.id === workspace.id ? 'true' : undefined}
              className={cn(ITEM, w.id === workspace.id && 'font-medium')}
            >
              <span className="min-w-0 flex-1 truncate">{w.name}</span>
              {w.id === workspace.id && (
                <Check aria-hidden="true" className="size-4 shrink-0 text-accent" />
              )}
            </button>
          ))}
          <div role="separator" className="-mx-1 my-1 border-t border-line" />
          <Link
            to="/app?new=1"
            role="menuitem"
            onClick={() => setOpen(false)}
            className={cn(ITEM, 'text-ink-2 hover:text-ink')}
          >
            <Plus aria-hidden="true" className="size-4 shrink-0" />
            Create or join…
          </Link>
        </div>
      )}
    </div>
  )
}
