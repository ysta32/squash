import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { safeNext } from '../lib/authRedirect'

const SESSION_TIMEOUT_MS = 8000

export default function AuthCallback() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  const { hash } = useLocation()
  // Supabase reports OAuth / magic-link failures in the query (PKCE) or the hash fragment.
  const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash)
  const errorDescription =
    params.get('error_description') ??
    hashParams.get('error_description') ??
    params.get('error') ??
    hashParams.get('error')
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    if (errorDescription) return
    if (session) {
      navigate(next, { replace: true })
      return
    }
    const timer = window.setTimeout(() => setTimedOut(true), SESSION_TIMEOUT_MS)
    return () => window.clearTimeout(timer)
  }, [session, errorDescription, next, navigate])

  const error =
    errorDescription ?? (timedOut && !session ? 'Sign-in link is invalid or has expired.' : null)

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4 text-fg">
      <div className="w-full max-w-sm text-center">
        {error ? (
          <>
            <h1 className="text-base font-medium">Couldn’t sign you in</h1>
            <p role="alert" className="mt-2 text-sm text-muted">
              {error}
            </p>
            <Link
              to={`/signin?next=${encodeURIComponent(next)}`}
              className="mt-6 inline-block text-sm text-fg underline underline-offset-4"
            >
              Back to sign in
            </Link>
          </>
        ) : (
          <p className="text-sm text-muted">Signing you in…</p>
        )}
      </div>
    </main>
  )
}
