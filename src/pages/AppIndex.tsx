import { Navigate, useSearchParams } from 'react-router-dom'
import { getLastWorkspace, useWorkspaces } from '../hooks/useWorkspaces'
import Onboarding from './Onboarding'

export default function AppIndex() {
  const [params] = useSearchParams()
  const { workspaces, loading, error, refresh } = useWorkspaces()

  if (params.get('new') === '1') return <Onboarding />
  if (loading) {
    return (
      <div role="status" aria-label="Loading workspaces" className="min-h-screen bg-bg p-6">
        <span className="sr-only">Loading…</span>
        <div className="mx-auto max-w-md space-y-3">
          <div className="h-8 animate-pulse rounded-lg bg-bg-subtle" />
          <div className="h-24 animate-pulse rounded-lg bg-bg-subtle" />
        </div>
      </div>
    )
  }
  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-bg p-6 text-fg">
        <p role="alert" className="text-sm text-muted">
          {error}
        </p>
        <button
          type="button"
          onClick={() => void refresh()}
          className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-bg-subtle"
        >
          Try again
        </button>
      </main>
    )
  }
  const last = getLastWorkspace()
  const target = workspaces.find((w) => w.id === last) ?? workspaces[0]
  if (target) return <Navigate to={`/app/${target.id}`} replace />
  return <Onboarding />
}
