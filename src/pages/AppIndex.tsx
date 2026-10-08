import { Navigate, useSearchParams } from 'react-router-dom'
import { getLastWorkspace, useWorkspaces } from '../hooks/useWorkspaces'
import Onboarding from './Onboarding'
import { AuthLayout } from '../components/AuthLayout'
import { Button } from '../components/ui'

export default function AppIndex() {
  const [params] = useSearchParams()
  const { workspaces, loading, error, refresh } = useWorkspaces()

  if (params.get('new') === '1') return <Onboarding />
  if (loading) {
    // Shaped like the app shell (48px header, list rows) so the redirect doesn't jump.
    return (
      <div role="status" aria-label="Loading workspaces" className="min-h-dvh">
        <span className="sr-only">Loading…</span>
        <div aria-hidden="true" className="flex h-12 items-center gap-3 border-b border-line px-3">
          <span className="size-5 animate-skeleton rounded-full bg-surface-3" />
          <span className="h-3 w-24 animate-skeleton rounded-sm bg-surface-3" />
        </div>
        <div aria-hidden="true" className="max-w-[30rem] border-r border-line">
          {[0.6, 0.45, 0.7, 0.5].map((width) => (
            <div key={width} className="flex h-12 items-center gap-3 border-b border-line px-4">
              <span className="h-2 w-3 animate-skeleton rounded-xs bg-surface-3" />
              <span className="h-3 w-8 animate-skeleton rounded-sm bg-surface-3" />
              <span
                className="h-3 animate-skeleton rounded-sm bg-surface-3"
                style={{ width: `${width * 100}%` }}
              />
            </div>
          ))}
        </div>
      </div>
    )
  }
  if (error) {
    return (
      <AuthLayout
        eyebrow="Workspaces · not loaded"
        title="Could not load your workspaces"
        description={<span role="alert">{error}</span>}
      >
        <Button variant="primary" size="lg" className="w-full" onClick={() => void refresh()}>
          Try again
        </Button>
      </AuthLayout>
    )
  }
  const last = getLastWorkspace()
  const target = workspaces.find((w) => w.id === last) ?? workspaces[0]
  if (target) return <Navigate to={`/app/${target.id}`} replace />
  return <Onboarding />
}
