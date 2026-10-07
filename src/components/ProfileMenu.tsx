import { useCallback, useRef, useState, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useDismiss } from '../hooks/useDismiss'
import { Avatar } from './Avatar'

export function ProfileMenu({ workspaceId }: { workspaceId: string }) {
  const { profile, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(ref, close, open)

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
        aria-label="Profile menu"
        aria-haspopup="menu"
        aria-expanded={open}
        className="focus-ring flex rounded-full"
      >
        <Avatar profile={profile} size="sm" />
      </button>
      {open && (
        <div
          role="menu"
          onKeyDown={onMenuKey}
          className="absolute right-0 top-full w-48 z-30 mt-1 rounded-lg border border-border bg-bg-elevated p-1 shadow-elevated"
        >
          <div className="truncate px-2 py-1.5 text-sm font-medium text-fg">
            {profile?.display_name ?? ''}
          </div>
          <div role="separator" className="my-1 border-t border-border" />
          <Link
            to={`/app/${workspaceId}/settings`}
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex h-8 w-full items-center rounded-md px-2 text-left text-sm hover:bg-bg-subtle focus-visible:bg-bg-subtle focus-visible:outline-none"
          >
            Settings
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setError(null)
              signOut().catch((e: unknown) =>
                setError(e instanceof Error ? e.message : 'Could not sign out'),
              )
            }}
            className="flex h-8 w-full items-center rounded-md px-2 text-left text-sm hover:bg-bg-subtle focus-visible:bg-bg-subtle focus-visible:outline-none"
          >
            Sign out
          </button>
          {error && (
            <p role="alert" className="px-2 py-1 text-xs text-danger">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
