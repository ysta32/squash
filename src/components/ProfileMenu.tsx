import { useCallback, useRef, useState, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { Keyboard, LogOut, Settings } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useDismiss } from '../hooks/useDismiss'
import { cn } from '../lib/utils'
import { menuRowClass, popoverClass } from './dialogStyles'
import { Avatar } from './Avatar'
import { Kbd } from './ui'

const ITEM = menuRowClass
const ITEM_ICON = 'size-4 shrink-0 text-ink-3'

export interface ProfileMenuProps {
  workspaceId: string
  onShowShortcuts?: () => void
}

export function ProfileMenu({ workspaceId, onShowShortcuts }: ProfileMenuProps) {
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
          't focus-ring flex size-8 items-center justify-center rounded-md hover:bg-surface-3 pointer-coarse:size-11',
          open && 'bg-surface-3',
        )}
      >
        <Avatar profile={profile} size="sm" />
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Profile"
          onKeyDown={onMenuKey}
          className={cn(
            popoverClass,
            'absolute top-full right-0 z-30 mt-2 w-64 max-w-[calc(100vw-1.5rem)] p-1',
          )}
        >
          <div className="flex items-center gap-2.5 px-2 py-2">
            <Avatar profile={profile} size="md" />
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-ink">
                {profile?.display_name ?? ''}
              </div>
              {email && <div className="truncate font-mono text-xs text-ink-3">{email}</div>}
            </div>
          </div>
          <div role="separator" className="-mx-1 my-1 border-t border-line" />
          <Link
            to={`/app/${workspaceId}/settings`}
            role="menuitem"
            onClick={() => setOpen(false)}
            className={ITEM}
          >
            <Settings aria-hidden="true" className={ITEM_ICON} />
            Settings
          </Link>
          {onShowShortcuts && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                onShowShortcuts()
              }}
              className={ITEM}
            >
              <Keyboard aria-hidden="true" className={ITEM_ICON} />
              <span className="flex-1">Keyboard shortcuts</span>
              <Kbd className="ml-auto">?</Kbd>
            </button>
          )}
          <div role="separator" className="-mx-1 my-1 border-t border-line" />
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
