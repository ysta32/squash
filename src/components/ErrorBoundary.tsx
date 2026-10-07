import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Bug } from 'lucide-react'

const CHUNK_ERROR =
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i
const RELOAD_FLAG = 'squash:chunk-reload'

function isChunkLoadError(error: unknown): boolean {
  return error instanceof Error && CHUNK_ERROR.test(error.message)
}

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/** Catches render crashes and shows a recovery screen instead of a blank page. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack)
    if (!isChunkLoadError(error)) return
    // A deploy replaced the chunk we asked for: reload once to pick up the new build.
    let shouldReload = false
    try {
      if (sessionStorage.getItem(RELOAD_FLAG) !== '1') {
        sessionStorage.setItem(RELOAD_FLAG, '1')
        shouldReload = true
      }
    } catch {
      // Storage unavailable: skip the auto-reload so we can't loop.
    }
    if (shouldReload) window.location.reload()
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    const githubUrl: string = import.meta.env.VITE_GITHUB_URL || ''
    const details = `${error.name}: ${error.message}${error.stack ? `\n\n${error.stack}` : ''}`
    return (
      <main className="flex min-h-dvh items-center justify-center bg-bg p-6 text-fg">
        <div className="w-full max-w-md rounded-xl border border-border bg-bg-subtle p-6">
          <div className="mb-4 flex items-center gap-2 font-semibold">
            <Bug className="h-5 w-5 text-accent" aria-hidden="true" />
            Something went wrong
          </div>
          <p className="text-sm text-muted">
            Squash hit an unexpected error. Reloading usually fixes it, and your bugs are safe.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white"
              onClick={() => window.location.reload()}
            >
              Reload
            </button>
            <a className="text-sm text-accent underline underline-offset-2" href="/app">
              Go to your workspaces
            </a>
            {githubUrl ? (
              <a
                className="text-sm text-accent underline underline-offset-2"
                href={`${githubUrl.replace(/\/$/, '')}/issues/new`}
                target="_blank"
                rel="noreferrer"
              >
                Report this on GitHub
              </a>
            ) : null}
          </div>
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer text-muted">Error details</summary>
            <pre className="mt-2 max-h-48 overflow-auto rounded bg-bg p-2 text-xs whitespace-pre-wrap">
              {details}
            </pre>
          </details>
        </div>
      </main>
    )
  }
}
