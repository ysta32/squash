import { Link, useParams, useSearchParams } from 'react-router-dom'
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
    <main className="mx-auto max-w-2xl px-5 py-8 text-fg">
      <Link
        to={workspaceId ? `/app/${workspaceId}` : '/app'}
        className="t inline-flex items-center gap-2 text-muted hover:text-fg"
      >
        <ArrowLeft size={16} /> Back to workspace
      </Link>
      <h1 className="mt-6 text-2xl font-semibold">Settings</h1>
      <nav aria-label="Settings tabs" className="my-6 flex gap-5 border-b border-border">
        {(['profile', 'workspace', 'appearance', 'account'] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-current={tab === value ? 'page' : undefined}
            className={`t border-b-2 pb-3 capitalize ${tab === value ? 'border-accent text-fg' : 'border-transparent text-muted hover:text-fg'}`}
            onClick={() =>
              setParams((previous) => {
                const next = new URLSearchParams(previous)
                next.set('tab', value)
                return next
              })
            }
          >
            {value}
          </button>
        ))}
      </nav>
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
              <p>Select a workspace first.</p>
            ))}
          {tab === 'account' && <AccountSettings />}
        </>
      )}
    </main>
  )
}
