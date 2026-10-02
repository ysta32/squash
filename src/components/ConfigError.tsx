import { Bug } from 'lucide-react'

export interface ConfigErrorProps {
  missing: string[]
}

/** Shown instead of the app when the build is missing required Supabase settings. */
export function ConfigError({ missing }: ConfigErrorProps) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg p-6 text-fg">
      <div className="w-full max-w-md rounded-xl border border-border bg-bg-subtle p-6">
        <div className="mb-4 flex items-center gap-2 font-semibold">
          <Bug className="h-5 w-5 text-accent" aria-hidden="true" />
          Squash isn't configured yet
        </div>
        <p className="text-sm text-muted">
          This build is missing the environment variables it needs to reach Supabase:
        </p>
        <ul className="my-3 space-y-1">
          {missing.map((name) => (
            <li key={name}>
              <code className="rounded bg-bg px-1.5 py-0.5 text-xs">{name}</code>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted">
          Set them in <code className="text-xs">.env</code> for local development, or in your
          host&apos;s environment settings, then rebuild. Vite bakes these values in at build time,
          so a redeploy is required after changing them. See{' '}
          <a
            className="text-accent underline underline-offset-2"
            href="https://github.com/ysta32/squash#self-host"
          >
            the self-host guide
          </a>
          .
        </p>
      </div>
    </main>
  )
}
