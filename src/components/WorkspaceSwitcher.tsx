import { useCallback, useRef, useState, type KeyboardEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Check, ChevronsUpDown } from 'lucide-react'
import type { Workspace } from '../lib/types'
import { setLastWorkspace } from '../hooks/useWorkspaces'
import { useDismiss } from '../hooks/useDismiss'

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
        className="focus-ring flex h-8 items-center gap-1 rounded-md px-2 text-sm font-medium hover:bg-bg-subtle"
      >
        <span className="max-w-[10rem] truncate">{workspace.name}</span>
        <ChevronsUpDown className="h-3.5 w-3.5 text-muted" />
      </button>
      {open && (
        <div
          role="menu"
          onKeyDown={onMenuKey}
          className="absolute left-0 top-full w-56 z-30 mt-1 rounded-lg border border-border bg-bg-elevated p-1 shadow-elevated"
        >
          {workspaces.map((w) => (
            <button
              key={w.id}
              type="button"
              role="menuitem"
              onClick={() => select(w.id)}
              className="flex h-8 w-full items-center rounded-md px-2 text-left text-sm hover:bg-bg-subtle focus-ring justify-between gap-2"
            >
              <span className="truncate">{w.name}</span>
              {w.id === workspace.id && <Check className="h-3.5 w-3.5 shrink-0" />}
            </button>
          ))}
          <div role="separator" className="my-1 border-t border-border" />
          <Link
            to="/app?new=1"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex h-8 w-full items-center rounded-md px-2 text-left text-sm hover:bg-bg-subtle focus-ring text-muted"
          >
            Create or join…
          </Link>
        </div>
      )}
    </div>
  )
}
