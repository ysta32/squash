import { useCallback, useRef, useState, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { LogOut, Settings } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useDismiss } from '../hooks/useDismiss'
import { cn } from '../lib/utils'
import { Avatar } from './Avatar'
import { Kbd } from './ui'

const ITEM =
  't focus-ring flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm text-fg hover:bg-bg-subtle focus-visible:bg-bg-subtle'
const ITEM_ICON = 'h-3.5 w-3.5 shrink-0 text-muted'

export function ProfileMenu({ workspaceId }: { workspaceId: string }) {
  const { profile, user, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(ref, close, open)
  const email = user?.email ?? null

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
        title={profile?.display_name ?? 'Profile'}
        className={cn(
          't focus-ring flex h-8 w-8 items-center justify-center rounded-md hover:bg-bg-subtle',
          open && 'bg-bg-subtle',
        )}
      >
        <Avatar profile={profile} size="sm" />
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Profile"
          onKeyDown={onMenuKey}
          className="t absolute right-0 top-full z-30 mt-1 w-60 max-w-[calc(100vw-1.5rem)] rounded-lg border border-border bg-bg-elevated p-1 shadow-elevated starting:-translate-y-1 starting:opacity-0"
        >
          <div className="flex items-center gap-2.5 px-2 py-2">
            <Avatar profile={profile} size="md" />
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-fg">
                {profile?.display_name ?? ''}
              </div>
              {email && <div className="truncate text-xs text-muted">{email}</div>}
            </div>
          </div>
          <div role="separator" className="-mx-1 my-1 border-t border-border" />
          <Link
            to={`/app/${workspaceId}/settings`}
            role="menuitem"
            onClick={() => setOpen(false)}
            className={ITEM}
          >
            <Settings aria-hidden="true" className={ITEM_ICON} />
            Settings
          </Link>
          <div role="none" className="flex h-8 items-center gap-2 px-2 text-xs text-muted">
            <span className="flex-1">Keyboard shortcuts</span>
            <Kbd>?</Kbd>
          </div>
          <div role="separator" className="-mx-1 my-1 border-t border-border" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setError(null)
              signOut().catch((e: unknown) =>
                setError(e instanceof Error ? e.message : 'Could not sign out'),
              )
            }}
            className={ITEM}
          >
            <LogOut aria-hidden="true" className={ITEM_ICON} />
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
