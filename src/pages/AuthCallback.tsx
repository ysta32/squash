import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { safeNext } from '../lib/authRedirect'
import { AuthLayout } from '../components/AuthLayout'
import { ButtonLink, SpecimenLabel } from '../components/ui'

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

  // Supabase sends error_code=otp_expired for used or stale magic links.
  const code =
    params.get('error_code') ??
    hashParams.get('error_code') ??
    params.get('error') ??
    hashParams.get('error')
  const expired = (timedOut && !session) || code === 'otp_expired'
  const failed = Boolean(errorDescription) || expired
  const signInHref = `/signin?next=${encodeURIComponent(next)}`

  if (failed) {
    // Authored copy only. The provider's own wording is kept as a quiet reason line for a
    // generic failure (it can say "access denied" when Google sign-in was cancelled), and its
    // error code goes in the mono eyebrow.
    const letters = (text: string | null) => (text ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
    // Skip the reason when it only restates the code ("Access denied" for access_denied).
    const reason =
      !expired && errorDescription && letters(errorDescription) !== letters(code)
        ? errorDescription
        : null
    return (
      <AuthLayout
        eyebrow={
          <SpecimenLabel
            segments={['Sign in', expired ? 'Link expired' : 'Failed', code]}
            className="text-ink-3"
          />
        }
        title={expired ? 'This link has expired' : 'Could not sign you in'}
        description={
          <>
            <span role="alert">
              {expired
                ? 'Sign-in links work once, and only for a limited time.'
                : 'The sign-in didn’t go through, and nothing was changed.'}
            </span>{' '}
            {expired
              ? 'Ask for a new one and open it on this device.'
              : 'Try again from the sign-in page, or use the other sign-in method.'}
            {reason && (
              <span className="mt-4 block font-mono text-xs break-words text-ink-3">
                Reason: {reason}
              </span>
            )}
          </>
        }
      >
        <ButtonLink to={signInHref} variant="primary" size="lg" className="w-full">
          {expired ? 'Get a new link' : 'Back to sign in'}
        </ButtonLink>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      eyebrow="Sign in"
      title="Signing you in"
      description="Checking your link with the server. This takes a second or two."
    >
      <div role="status" aria-label="Signing you in" className="space-y-3" aria-busy="true">
        <div aria-hidden="true" className="h-11 w-full animate-skeleton rounded-md bg-surface-3" />
        <div aria-hidden="true" className="h-3 w-2/3 animate-skeleton rounded-sm bg-surface-3" />
      </div>
    </AuthLayout>
  )
}
