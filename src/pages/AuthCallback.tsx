import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { safeNext } from '../lib/authRedirect'
import { AuthLayout } from '../components/AuthLayout'
import { ButtonLink } from '../components/ui'

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

  if (error) {
    return (
      <AuthLayout title="Could not sign you in" description={<span role="alert">{error}</span>}>
        <ButtonLink
          to={`/signin?next=${encodeURIComponent(next)}`}
          variant="primary"
          size="lg"
          className="w-full"
        >
          Back to sign in
        </ButtonLink>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Signing you in">
      <div role="status" className="flex items-center gap-3 text-sm text-muted">
        <span
          aria-hidden="true"
          className="size-4 animate-spin rounded-full border-2 border-border border-t-accent"
        />
        This only takes a moment.
      </div>
    </AuthLayout>
  )
}
