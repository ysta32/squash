import { useCallback, useRef, useState } from 'react'
import { BarChart2, Monitor, Moon, Sun, UserPlus } from 'lucide-react'
import type { MemberRole, Workspace, WorkspaceMember } from '../lib/types'
import type { PresenceUser } from '../hooks/usePresence'
import { useDismiss } from '../hooks/useDismiss'
import { useTheme, type Theme } from '../lib/theme'
import { PresenceAvatars } from './PresenceAvatars'
import { ProfileMenu } from './ProfileMenu'
import { StatsPopover } from './StatsPopover'
import { WorkspaceSwitcher } from './WorkspaceSwitcher'

export interface HeaderProps {
  workspace: Workspace
  workspaces: Workspace[]
  members: WorkspaceMember[]
  online: PresenceUser[]
  selfId: string
  onInvite: () => void
  role: MemberRole | null
}

const NEXT_THEME: Record<Theme, Theme> = { light: 'dark', dark: 'system', system: 'light' }
const THEME_ICON = { light: Sun, dark: Moon, system: Monitor }
const ICON_BTN =
  'flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const Icon = THEME_ICON[theme]
  return (
    <button
      type="button"
      onClick={() => setTheme(NEXT_THEME[theme])}
      aria-label={`Theme: ${theme}`}
      title={`Theme: ${theme}`}
      className={ICON_BTN}
    >
      <Icon className="h-4 w-4" />
    </button>
  )
}

export function Header({
  workspace,
  workspaces,
  members,
  online,
  selfId,
  onInvite,
  role,
}: HeaderProps) {
  const [statsOpen, setStatsOpen] = useState(false)
  const statsRef = useRef<HTMLDivElement>(null)
  const closeStats = useCallback(() => setStatsOpen(false), [])
  useDismiss(statsRef, closeStats, statsOpen)

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-200 px-3 dark:border-zinc-800">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold tracking-tight">Squash</span>
        <span className="text-zinc-300 dark:text-zinc-700">/</span>
        <WorkspaceSwitcher workspace={workspace} workspaces={workspaces} />
      </div>
      <div className="flex items-center gap-1.5">
        <PresenceAvatars online={online} members={members} selfId={selfId} />
        <div ref={statsRef} className="relative">
          <button
            type="button"
            onClick={() => setStatsOpen((o) => !o)}
            aria-label="Stats"
            title="Stats"
            aria-expanded={statsOpen}
            className={ICON_BTN}
          >
            <BarChart2 className="h-4 w-4" />
          </button>
          {statsOpen && <StatsPopover workspaceId={workspace.id} members={members} />}
        </div>
        {role !== null && (
          <button
            type="button"
            onClick={onInvite}
            aria-label="Invite"
            title="Invite"
            className={ICON_BTN}
          >
            <UserPlus className="h-4 w-4" />
          </button>
        )}
        <ThemeToggle />
        <ProfileMenu workspaceId={workspace.id} />
      </div>
    </header>
  )
}
