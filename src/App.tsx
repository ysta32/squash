import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { ChunkReloadReset, ErrorBoundary } from './components/ErrorBoundary'
import { ToastProvider } from './components/Toast'
import { AuthProvider, useAuth } from './lib/auth'
import Landing from './pages/Landing'
import SignIn from './pages/SignIn'
const AppIndex = lazy(() => import('./pages/AppIndex'))
const AuthCallback = lazy(() => import('./pages/AuthCallback'))
const ClaudeGuide = lazy(() => import('./pages/ClaudeGuide'))
const Join = lazy(() => import('./pages/Join'))
const Privacy = lazy(() => import('./pages/Privacy'))
const Settings = lazy(() => import('./pages/Settings'))
const Terms = lazy(() => import('./pages/Terms'))
const Workspace = lazy(() => import('./pages/Workspace'))

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

/** Suspense fallback that stays blank for the first 150 ms so fast loads never flash a skeleton. */
function DelayedSkeleton() {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const timer = window.setTimeout(() => setShow(true), 150)
    return () => window.clearTimeout(timer)
  }, [])
  return show ? <FullPageSkeleton /> : null
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

function PrefetchWorkspace() {
  const { user } = useAuth()
  useEffect(() => {
    if (user) void import('./pages/Workspace')
  }, [user])
  return null
}

/** Resets the boundary on navigation so a crash on one page doesn't stick. */
function RoutedBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  return <ErrorBoundary resetKey={pathname}>{children}</ErrorBoundary>
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <PrefetchWorkspace />
          <RoutedBoundary>
            <Suspense fallback={<DelayedSkeleton />}>
              <ChunkReloadReset />
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/claude" element={<ClaudeGuide />} />
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
            </Suspense>
          </RoutedBoundary>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
