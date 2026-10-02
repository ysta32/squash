import { useCallback, useRef, useState } from 'react'
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

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
      >
        <span className="max-w-[10rem] truncate">{workspace.name}</span>
        <ChevronsUpDown className="h-3.5 w-3.5 text-zinc-400" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-30 mt-1 w-56 rounded-lg border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
        >
          {workspaces.map((w) => (
            <button
              key={w.id}
              type="button"
              role="menuitem"
              onClick={() => select(w.id)}
              className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <span className="truncate">{w.name}</span>
              {w.id === workspace.id && <Check className="h-3.5 w-3.5 shrink-0" />}
            </button>
          ))}
          <div className="my-1 border-t border-zinc-200 dark:border-zinc-800" />
          <Link
            to="/app?new=1"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block rounded-md px-2 py-1.5 text-sm text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            Create or join…
          </Link>
        </div>
      )}
    </div>
  )
}
