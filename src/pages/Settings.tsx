import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Button, ButtonLink, Section } from '../components/ui'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { ProfileSettings } from '../components/settings/ProfileSettings'
import { WorkspaceSettings } from '../components/settings/WorkspaceSettings'
import { AccountSettings } from '../components/settings/AccountSettings'
import { AppearanceSettings } from '../components/settings/AppearanceSettings'

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
    <main className="mx-auto max-w-5xl px-5 py-8 text-fg">
      <Link
        to={workspaceId ? `/app/${workspaceId}` : '/app'}
        className="t focus-ring inline-flex items-center gap-2 text-muted hover:text-fg"
      >
        <ArrowLeft size={16} /> Back to workspace
      </Link>
      <h1 className="mt-6 text-2xl font-semibold">Settings</h1>
      <div className="mt-6 grid gap-6 md:grid-cols-[12rem_minmax(0,1fr)] md:items-start">
        <nav aria-label="Settings tabs" className="flex flex-col gap-1 md:sticky md:top-6">
          {(['profile', 'appearance', 'workspace', 'account'] as const).map((value) => (
            <Button
              variant="ghost"
              key={value}
              type="button"
              aria-current={tab === value ? 'page' : undefined}
              className={`justify-start capitalize ${tab === value ? 'bg-bg-subtle text-fg' : ''}`}
              onClick={() =>
                setParams((previous) => {
                  const next = new URLSearchParams(previous)
                  next.set('tab', value)
                  return next
                })
              }
            >
              {value}
            </Button>
          ))}
        </nav>
        <div className="min-w-0">
          {tab === 'appearance' ? (
            <AppearanceSettings />
          ) : loading ? (
            <p role="status">Loading settings…</p>
          ) : !user ? (
            <p>Please sign in to manage settings.</p>
          ) : (
            <>
              {tab === 'profile' &&
                (profile ? (
                  <ProfileSettings key={profile.id} profile={profile} />
                ) : (
                  <p role="alert">Your profile could not be loaded.</p>
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
