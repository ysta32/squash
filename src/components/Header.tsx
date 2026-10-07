import { useCallback, useRef, useState } from 'react'
import { BarChart2, Monitor, Moon, Sun, UserPlus } from 'lucide-react'
import type { MemberRole, Workspace, WorkspaceMember } from '../lib/types'
import type { PresenceUser } from '../hooks/usePresence'
import { useDismiss } from '../hooks/useDismiss'
import { NEXT_THEME, useTheme } from '../lib/theme'
import { cn } from '../lib/utils'
import { LogoMark } from './ui'
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
  onShowShortcuts?: () => void
  role: MemberRole | null
}

const THEME_ICON = { light: Sun, dark: Moon, system: Monitor }
const ICON_BTN =
  't focus-ring flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted hover:bg-bg-subtle hover:text-fg'
// Icon-only on mobile; a compact secondary button with a label from `sm` up.
const INVITE_BTN =
  't focus-ring flex h-8 w-8 shrink-0 items-center justify-center gap-1.5 rounded-md text-muted hover:bg-bg-subtle hover:text-fg sm:mx-1 sm:h-7 sm:w-auto sm:border sm:border-border sm:bg-bg sm:px-2.5 sm:text-xs sm:font-medium sm:text-fg'

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const Icon = THEME_ICON[theme]
  return (
    <button
      type="button"
      onClick={() => setTheme(NEXT_THEME[theme])}
      aria-label={`Theme: ${theme}`}
      title={`Theme: ${theme} (switch to ${NEXT_THEME[theme]})`}
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
  onShowShortcuts,
  role,
}: HeaderProps) {
  const [statsOpen, setStatsOpen] = useState(false)
  const statsRef = useRef<HTMLDivElement>(null)
  const closeStats = useCallback(() => setStatsOpen(false), [])
  useDismiss(statsRef, closeStats, statsOpen)

  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border px-3">
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="flex shrink-0 items-center gap-2 pl-0.5 text-sm font-semibold tracking-tight">
          <LogoMark size={20} />
          <span className="hidden sm:inline">Squash</span>
        </span>
        <span aria-hidden="true" className="select-none text-sm text-muted/50">
          /
        </span>
        <WorkspaceSwitcher workspace={workspace} workspaces={workspaces} />
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <PresenceAvatars online={online} members={members} selfId={selfId} />
        {role !== null && (
          <button
            type="button"
            onClick={onInvite}
            aria-label="Invite"
            title="Invite people"
            className={INVITE_BTN}
          >
            <UserPlus className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
            <span aria-hidden="true" className="hidden sm:inline">
              Invite
            </span>
          </button>
        )}
        <div ref={statsRef} className="relative">
          <button
            type="button"
            onClick={() => setStatsOpen((o) => !o)}
            aria-label="Stats"
            title="Team stats"
            aria-expanded={statsOpen}
            className={cn(ICON_BTN, statsOpen && 'bg-bg-subtle text-fg')}
          >
            <BarChart2 className="h-4 w-4" />
          </button>
          {statsOpen && <StatsPopover workspaceId={workspace.id} members={members} />}
        </div>
        <ThemeToggle />
        <ProfileMenu workspaceId={workspace.id} onShowShortcuts={onShowShortcuts} />
      </div>
    </header>
  )
}
