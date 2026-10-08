import { useCallback, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart2, Monitor, Moon, Sun, UserPlus } from 'lucide-react'
import type { MemberRole, Workspace, WorkspaceMember } from '../lib/types'
import type { PresenceUser } from '../hooks/usePresence'
import { useDismiss } from '../hooks/useDismiss'
import { NEXT_THEME, useTheme } from '../lib/theme'
import { cn } from '../lib/utils'
import { Button, Logo, LogoMark } from './ui'
import { PresenceAvatars } from './PresenceAvatars'
import { ProfileMenu } from './ProfileMenu'
import { StatsPopover } from './StatsPopover'
import { Tooltip } from './Tooltip'
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
/** 32px icon buttons, 44px on touch screens (DESIGN.md: ≥44px targets on touch). */
const ICON_BTN =
  't focus-ring flex size-[2.2857rem] shrink-0 items-center justify-center rounded-md text-ink-2 hover:bg-surface-3 hover:text-ink pointer-coarse:size-[3.1429rem] [&_svg]:size-4'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const Icon = THEME_ICON[theme]
  return (
    <Tooltip label={`Theme: ${theme} → ${NEXT_THEME[theme]}`} align="end">
      <button
        type="button"
        onClick={() => setTheme(NEXT_THEME[theme])}
        aria-label={`Theme: ${theme}`}
        className={ICON_BTN}
      >
        <Icon strokeWidth={1.5} aria-hidden="true" />
      </button>
    </Tooltip>
  )
}

/**
 * App shell header (DESIGN.md section 5): 48px on the paper background with a hairline rule.
 * Left: the pin mark (plus the wordmark from `sm` up) and the workspace switcher. Right:
 * presence, Invite, stats, theme and the profile menu.
 */
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
    <header className="flex h-[3.4286rem] shrink-0 items-center justify-between gap-2 border-b border-line pr-2 pl-3 sm:pr-3 sm:pl-4">
      <div className="flex min-w-0 items-center">
        <Link
          to="/app"
          aria-label="Squash: your workspaces"
          className="t focus-ring -ml-1 flex h-[2.2857rem] shrink-0 items-center rounded-md px-1 text-base pointer-coarse:h-[3.1429rem] pointer-coarse:min-w-[3.1429rem] pointer-coarse:justify-center"
        >
          {/* Wordmark from 360px up; only the narrowest phones fall back to the bare pin. Wrapped
              because Logo sets its own display and cn() does not merge conflicting classes. */}
          <span className="inline-flex min-[360px]:hidden">
            <LogoMark size={20} />
          </span>
          <span className="hidden min-[360px]:inline-flex">
            <Logo size={18} />
          </span>
        </Link>
        {/* A hairline slash between brand and workspace, like a path: never shown alone. */}
        <span
          aria-hidden="true"
          className="mx-1.5 h-4 w-px shrink-0 rotate-[18deg] bg-line-2 sm:mx-2"
        />
        <WorkspaceSwitcher workspace={workspace} workspaces={workspaces} />
      </div>
      <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
        <PresenceAvatars online={online} members={members} selfId={selfId} />
        {role !== null && (
          <Tooltip label="Invite teammates" align="end" className="sm:mr-1">
            <Button
              variant="secondary"
              size="sm"
              onClick={onInvite}
              aria-label="Invite"
              className="max-sm:size-[2.2857rem] max-sm:border-transparent max-sm:px-0 max-sm:text-ink-2 pointer-coarse:max-sm:size-[3.1429rem]"
            >
              <UserPlus size={16} strokeWidth={1.5} aria-hidden="true" className="sm:size-3.5" />
              <span className="max-sm:hidden">Invite</span>
            </Button>
          </Tooltip>
        )}
        <div ref={statsRef} className="relative">
          <Tooltip label="Team stats" disabled={statsOpen}>
            <button
              type="button"
              onClick={() => setStatsOpen((o) => !o)}
              aria-label="Stats"
              aria-expanded={statsOpen}
              className={cn(ICON_BTN, statsOpen && 'bg-surface-3 text-ink')}
            >
              <BarChart2 strokeWidth={1.5} aria-hidden="true" />
            </button>
          </Tooltip>
          {statsOpen && <StatsPopover workspaceId={workspace.id} members={members} />}
        </div>
        <span className="max-sm:hidden">
          <ThemeToggle />
        </span>
        <ProfileMenu workspaceId={workspace.id} onShowShortcuts={onShowShortcuts} />
      </div>
    </header>
  )
}
