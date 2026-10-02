import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { ToastProvider } from './components/Toast'
import { AuthProvider, useAuth } from './lib/auth'
import AppIndex from './pages/AppIndex'
import AuthCallback from './pages/AuthCallback'
import Join from './pages/Join'
import Landing from './pages/Landing'
import Privacy from './pages/Privacy'
import Settings from './pages/Settings'
import SignIn from './pages/SignIn'
import Terms from './pages/Terms'
import Workspace from './pages/Workspace'

function FullPageSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="flex min-h-screen flex-col bg-bg">
      <span className="sr-only">Loading…</span>
      <div className="h-12 border-b border-border" />
      <div className="mx-auto mt-6 w-full max-w-3xl space-y-3 px-4">
        <div className="h-20 animate-pulse rounded-lg bg-bg-subtle" />
        <div className="h-10 animate-pulse rounded-lg bg-bg-subtle" />
        <div className="h-10 animate-pulse rounded-lg bg-bg-subtle" />
      </div>
    </div>
  )
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <FullPageSkeleton />
  if (!user) {
    const next = `${location.pathname}${location.search}`
    return <Navigate to={`/signin?next=${encodeURIComponent(next)}`} replace />
  }
  return <>{children}</>
}

function Home() {
  const { user, loading } = useAuth()
  if (loading) return <FullPageSkeleton />
  if (user) return <Navigate to="/app" replace />
  return <Landing />
}

/** Remounts the workspace screen when switching workspaces (bug selection keeps state). */
function WorkspaceRoute() {
  const { workspaceId = '' } = useParams<{ workspaceId: string }>()
  return <Workspace key={workspaceId} />
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/signin" element={<SignIn />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/join/:code" element={<Join />} />
            <Route
              path="/app"
              element={
                <RequireAuth>
                  <AppIndex />
                </RequireAuth>
              }
            />
            <Route
              path="/app/:workspaceId"
              element={
                <RequireAuth>
                  <WorkspaceRoute />
                </RequireAuth>
              }
            />
            <Route
              path="/app/:workspaceId/bug/:number"
              element={
                <RequireAuth>
                  <WorkspaceRoute />
                </RequireAuth>
              }
            />
            <Route
              path="/app/:workspaceId/settings"
              element={
                <RequireAuth>
                  <Settings />
                </RequireAuth>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
