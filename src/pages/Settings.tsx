import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Button, ButtonLink, Section } from '../components/ui'
import { ArrowLeft, Building2, Palette, ShieldUser, UserRound, type LucideIcon } from 'lucide-react'
import { cn } from '../lib/utils'
import { useAuth } from '../lib/auth'
import { ProfileSettings } from '../components/settings/ProfileSettings'
import { WorkspaceSettings } from '../components/settings/WorkspaceSettings'
import { AccountSettings } from '../components/settings/AccountSettings'
import { AppearanceSettings } from '../components/settings/AppearanceSettings'

const TABS: { value: 'profile' | 'appearance' | 'workspace' | 'account'; icon: LucideIcon }[] = [
  { value: 'profile', icon: UserRound },
  { value: 'appearance', icon: Palette },
  { value: 'workspace', icon: Building2 },
  { value: 'account', icon: ShieldUser },
]

export default function Settings() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const [params, setParams] = useSearchParams()
  const { user, profile, loading } = useAuth()
  const requested = params.get('tab')
  const tab =
    requested === 'workspace' || requested === 'account' || requested === 'appearance'
      ? requested
      : 'profile'

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 text-fg sm:px-6 sm:py-8">
      <Link
        to={workspaceId ? `/app/${workspaceId}` : '/app'}
        className="t focus-ring -ml-1 inline-flex h-7 items-center gap-1.5 rounded-md px-1 text-sm text-muted hover:text-fg"
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> Back to workspace
      </Link>
      <h1 className="mt-4 text-xl font-semibold tracking-tight">Settings</h1>
      <div className="mt-6 grid gap-6 md:grid-cols-[11rem_minmax(0,1fr)] md:items-start md:gap-8">
        <nav
          aria-label="Settings tabs"
          className="-mx-4 flex gap-1 overflow-x-auto border-b border-border px-4 pb-3 md:sticky md:top-6 md:mx-0 md:flex-col md:overflow-visible md:border-0 md:p-0"
        >
          {TABS.map(({ value, icon: Icon }) => (
            <Button
              variant="ghost"
              size="sm"
              key={value}
              type="button"
              aria-current={tab === value ? 'page' : undefined}
              className={cn(
                'h-8 justify-start text-sm capitalize md:w-full',
                tab === value && 'bg-bg-subtle font-medium text-fg hover:bg-bg-subtle',
              )}
              onClick={() =>
                setParams((previous) => {
                  const next = new URLSearchParams(previous)
                  next.set('tab', value)
                  return next
                })
              }
            >
              <Icon
                className={cn('size-4', tab === value ? 'text-fg' : 'text-muted')}
                aria-hidden="true"
              />
              {value}
            </Button>
          ))}
        </nav>
        <div className="min-w-0">
          {tab === 'appearance' ? (
            <AppearanceSettings />
          ) : loading ? (
            <p role="status" className="text-sm text-muted">
              Loading settings…
            </p>
          ) : !user ? (
            <p className="text-sm text-muted">Please sign in to manage settings.</p>
          ) : (
            <>
              {tab === 'profile' &&
                (profile ? (
                  <ProfileSettings key={profile.id} profile={profile} />
                ) : (
                  <p role="alert" className="text-sm text-danger">
                    Your profile could not be loaded.
                  </p>
                ))}
              {tab === 'workspace' &&
                (workspaceId ? (
                  <WorkspaceSettings key={workspaceId} workspaceId={workspaceId} />
                ) : (
                  <Section
                    title="Choose a workspace"
                    description="Select a workspace to manage its name, invites, and members."
                    footer={<ButtonLink to="/app">Choose workspace</ButtonLink>}
                  />
                ))}
              {tab === 'account' && <AccountSettings />}
            </>
          )}
        </div>
      </div>
    </main>
  )
}
