import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { ButtonLink, Logo, LogoMark } from '../components/ui'
import { ThemeToggle } from '../components/Header'
import { ProfileMenu } from '../components/ProfileMenu'
import { cn } from '../lib/utils'
import { useAuth } from '../lib/auth'
import { useWorkspaces } from '../hooks/useWorkspaces'
import { ProfileSettings } from '../components/settings/ProfileSettings'
import { WorkspaceSettings } from '../components/settings/WorkspaceSettings'
import { DeleteAccount } from '../components/settings/AccountSettings'
import { AppearanceSettings } from '../components/settings/AppearanceSettings'
import { NotificationSettings } from '../components/settings/NotificationSettings'
import { ClaudeSettings } from '../components/settings/ClaudeSettings'
import {
  LedgerGroup,
  LedgerRow,
  LedgerSkeleton,
  SettingsPanel,
} from '../components/settings/Ledger'
import { SkipLink } from '../components/SkipLink'

const TABS = [
  { value: 'profile', label: 'Profile' },
  { value: 'workspace', label: 'Workspace' },
  { value: 'members', label: 'Members' },
  { value: 'appearance', label: 'Appearance' },
  { value: 'notifications', label: 'Notifications' },
  { value: 'claude', label: 'Claude Code' },
  { value: 'deleted', label: 'Recently deleted' },
  { value: 'danger', label: 'Danger zone' },
] as const

type Tab = (typeof TABS)[number]['value']

/** `?tab=` value to tab; the retired "account" tab now lives in the danger zone. */
function toTab(value: string | null): Tab {
  if (value === 'account') return 'danger'
  return TABS.find((tab) => tab.value === value)?.value ?? 'profile'
}

/** Tabs that only work with a workspace selected. */
const NEEDS_WORKSPACE: ReadonlySet<Tab> = new Set(['workspace', 'members', 'claude', 'deleted'])

function ChooseWorkspace() {
  return (
    <SettingsPanel
      id="choose"
      title="Choose a workspace"
      description="Select a workspace to manage its name, invite link, members and Claude Code folder."
    >
      <div>
        <ButtonLink to="/app" variant="primary">
          Choose workspace
        </ButtonLink>
      </div>
    </SettingsPanel>
  )
}

/** Width of the fade at a scrolled edge of the mobile tab strip, and the margin kept around the
 * active tab when it is scrolled into view (so it never sits under a fade). */
const EDGE_FADE = 40

/**
 * The phone-width tab strip scrolls sideways. Keep the active tab fully in view, and fade only
 * the edges that have more tabs beyond them.
 */
function useTabStrip(active: string) {
  const ref = useRef<HTMLElement>(null)
  const [edges, setEdges] = useState({ start: false, end: false })

  const measure = useCallback(() => {
    const strip = ref.current
    if (!strip) return
    const max = strip.scrollWidth - strip.clientWidth
    setEdges({ start: strip.scrollLeft > 1, end: max - strip.scrollLeft > 1 })
  }, [])

  useLayoutEffect(() => {
    const strip = ref.current
    const tab = strip?.querySelector<HTMLElement>('[aria-current="page"]')
    if (!strip || !tab || strip.scrollWidth <= strip.clientWidth) {
      measure()
      return
    }
    const box = strip.getBoundingClientRect()
    const item = tab.getBoundingClientRect()
    let delta = 0
    if (item.left < box.left + EDGE_FADE) delta = item.left - box.left - EDGE_FADE
    else if (item.right > box.right - EDGE_FADE) delta = item.right - box.right + EDGE_FADE
    if (delta !== 0) strip.scrollLeft += delta
    measure()
  }, [active, measure])

  useLayoutEffect(() => {
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [measure])

  return { ref, edges, onScroll: measure }
}

export default function Settings() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const [params] = useSearchParams()
  const { user, profile, loading } = useAuth()
  const { workspaces } = useWorkspaces()
  const tab = toTab(params.get('tab'))
  const workspace = workspaces.find((candidate) => candidate.id === workspaceId) ?? null
  const back = workspaceId ? `/app/${workspaceId}` : '/app'
  const { ref: stripRef, edges, onScroll: onStripScroll } = useTabStrip(tab)

  const tabHref = (value: Tab) => {
    const next = new URLSearchParams(params)
    next.set('tab', value)
    return `?${next.toString()}`
  }

  let content
  if (tab === 'appearance') content = <AppearanceSettings />
  else if (tab === 'notifications') content = <NotificationSettings />
  else if (loading) content = <LedgerSkeleton label="Loading settings…" />
  else if (!user) content = <p className="text-sm text-ink-2">Sign in again to manage settings.</p>
  else if (NEEDS_WORKSPACE.has(tab) && !workspaceId) content = <ChooseWorkspace />
  else if (tab === 'profile')
    content = profile ? (
      <ProfileSettings key={profile.id} profile={profile} />
    ) : (
      <p role="alert" className="text-sm text-danger">
        Your profile could not be loaded. Reload the page to try again.
      </p>
    )
  else if (workspaceId && (tab === 'workspace' || tab === 'members' || tab === 'deleted'))
    content = <WorkspaceSettings key={workspaceId} workspaceId={workspaceId} section={tab} />
  else if (workspaceId && tab === 'claude')
    content = (
      <ClaudeSettings
        key={workspaceId}
        workspaceId={workspaceId}
        workspaceName={workspace?.name ?? 'this workspace'}
      />
    )
  else
    content = (
      <SettingsPanel
        id="danger"
        title="Danger zone"
        description="Permanent actions. Each one asks you to confirm before anything is deleted."
      >
        <LedgerGroup>
          <div className="-mt-px overflow-hidden rounded-lg border border-danger/40 px-5">
            <div className="-mb-px">
              {workspaceId ? (
                <WorkspaceSettings key={workspaceId} workspaceId={workspaceId} section="danger" />
              ) : (
                <LedgerRow
                  label="Delete a workspace"
                  description="Open settings from a workspace you own to delete it."
                />
              )}
              <DeleteAccount />
            </div>
          </div>
        </LedgerGroup>
      </SettingsPanel>
    )

  return (
    <>
      <SkipLink />
      <div className="min-h-dvh text-ink">
        {/* The app header's height, padding and controls (theme, profile), with its contents on
            the settings grid so the logo lines up with the section nav on wide screens. */}
        <header className="sticky top-0 z-20 border-b border-line paper-grain">
          <div className="mx-auto flex h-[3.4286rem] max-w-[1120px] items-center gap-2 pr-2 pl-3 sm:pr-3 sm:pl-4 lg:px-10">
            <div className="flex min-w-0 flex-1 items-center">
              <Link
                to={back}
                className="t focus-ring -ml-1 flex h-[2.2857rem] shrink-0 items-center rounded-md px-1 text-base text-ink pointer-coarse:h-[3.1429rem] pointer-coarse:min-w-[3.1429rem] pointer-coarse:justify-center"
                aria-label={workspace ? `Squash, back to ${workspace.name}` : 'Squash home'}
              >
                <span className="inline-flex min-[360px]:hidden">
                  <LogoMark size={20} />
                </span>
                <span className="hidden min-[360px]:inline-flex">
                  <Logo size={18} />
                </span>
              </Link>
              {workspace && (
                <>
                  <span
                    aria-hidden="true"
                    className="mx-1.5 h-4 w-px shrink-0 rotate-[18deg] bg-line-2 sm:mx-2"
                  />
                  <span className="min-w-0 truncate text-sm font-medium text-ink-2">
                    {workspace.name}
                  </span>
                </>
              )}
              <span
                aria-hidden="true"
                className="mx-1.5 h-4 w-px shrink-0 rotate-[18deg] bg-line-2 sm:mx-2"
              />
              <span className="shrink-0 text-sm font-medium text-ink">Settings</span>
            </div>
            <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
              <Link
                to={back}
                aria-label="Back to workspace"
                className="t focus-ring inline-flex h-[2.2857rem] shrink-0 items-center gap-1.5 rounded-md px-2.5 text-sm text-ink-2 hover:bg-surface-3 hover:text-ink pointer-coarse:h-[3.1429rem]"
              >
                <ArrowLeft className="size-4" strokeWidth={1.5} absoluteStrokeWidth aria-hidden />
                <span className="sm:hidden">Back</span>
                <span className="max-sm:hidden">Back to workspace</span>
              </Link>
              <span className="max-sm:hidden">
                <ThemeToggle />
              </span>
              {workspaceId && <ProfileMenu workspaceId={workspaceId} />}
            </div>
          </div>
        </header>
        <main
          id="main"
          tabIndex={-1}
          className="mx-auto grid max-w-[1120px] gap-x-16 gap-y-8 px-4 pt-6 pb-24 focus:outline-none sm:px-6 md:grid-cols-[11rem_minmax(0,40rem)] md:pt-12 lg:grid-cols-[13rem_minmax(0,45.7143rem)] lg:px-10"
        >
          <div className="min-w-0 md:sticky md:top-24 md:self-start">
            <h1 className="specimen-label text-ink-3 max-md:sr-only md:pb-4">Settings</h1>
            <nav
              ref={stripRef}
              onScroll={onStripScroll}
              aria-label="Settings tabs"
              data-fade-start={edges.start || undefined}
              data-fade-end={edges.end || undefined}
              className={cn(
                '-mx-4 overflow-x-auto [scrollbar-width:none] max-md:border-b max-md:border-line sm:-mx-6 md:mx-0 md:overflow-visible [&::-webkit-scrollbar]:hidden',
                // Fade only an edge with more tabs past it (40px, EDGE_FADE), never a resting first tab.
                'max-md:[--fade-l:black] max-md:[--fade-r:black] max-md:data-fade-start:[--fade-l:transparent] max-md:data-fade-end:[--fade-r:transparent]',
                'max-md:[mask-image:linear-gradient(to_right,var(--fade-l),black_40px,black_calc(100%-40px),var(--fade-r))]',
              )}
            >
              <ol className="flex gap-1 px-4 max-md:w-max sm:px-6 md:flex-col md:gap-0 md:px-0">
                {TABS.map(({ value, label }, index) => {
                  const current = tab === value
                  return (
                    <li key={value} className="shrink-0">
                      <Link
                        to={tabHref(value)}
                        replace
                        aria-current={current ? 'page' : undefined}
                        className={cn(
                          't focus-ring-inset relative flex h-11 items-center gap-2.5 rounded-md px-2 text-sm whitespace-nowrap max-md:min-h-[3.1429rem] md:h-9 pointer-coarse:min-h-[3.1429rem]',
                          !current && 'text-ink-2 hover:bg-surface-3 hover:text-ink',
                          current && 'font-medium text-ink',
                        )}
                      >
                        <span
                          aria-hidden="true"
                          className={cn(
                            'font-mono text-xs nums',
                            current && value === 'danger'
                              ? 'text-danger'
                              : current
                                ? 'text-accent'
                                : 'text-ink-3',
                          )}
                        >
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        {label}
                        {current && (
                          <span
                            aria-hidden="true"
                            className={cn(
                              'absolute max-md:inset-x-2 max-md:bottom-0 max-md:h-0.5 md:inset-y-2 md:-left-3 md:w-[2px]',
                              value === 'danger' ? 'bg-danger' : 'bg-accent',
                            )}
                          />
                        )}
                      </Link>
                    </li>
                  )
                })}
              </ol>
            </nav>
          </div>
          <div className="min-w-0">{content}</div>
        </main>
      </div>
    </>
  )
}
