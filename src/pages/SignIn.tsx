import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { safeNext } from '../lib/authRedirect'
import { AuthLayout } from '../components/AuthLayout'
import { Button, Field, Input } from '../components/ui'

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
      />
    </svg>
  )
}

export default function SignIn() {
  const { session, loading, signInWithGoogle, signInWithMagicLink } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))

  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [googleBusy, setGoogleBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && session) navigate(next, { replace: true })
  }, [loading, session, next, navigate])

  useEffect(() => {
    // After the OAuth redirect, returning via back/bfcache restores this page; un-stick the button.
    const onPageShow = () => setGoogleBusy(false)
    window.addEventListener('pageshow', onPageShow)
    return () => window.removeEventListener('pageshow', onPageShow)
  }, [])

  async function handleGoogle() {
    setError(null)
    setGoogleBusy(true)
    try {
      await signInWithGoogle(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed')
      setGoogleBusy(false)
    }
  }

  async function handleMagicLink(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) return
    setError(null)
    setSending(true)
    try {
      await signInWithMagicLink(trimmed, next)
      setSentTo(trimmed)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send magic link')
    } finally {
      setSending(false)
    }
  }

  if (sentTo) {
    return (
      <AuthLayout
        title="Check your email"
        description={
          <>
            We sent a sign-in link to <strong className="font-semibold text-fg">{sentTo}</strong>.
            Open it on this device to finish signing in. It can take a minute to arrive, so check
            your spam folder if you do not see it.
          </>
        }
      >
        <Button
          variant="ghost"
          onClick={() => {
            setSentTo(null)
            setEmail('')
          }}
          className="w-full"
        >
          Use a different email
        </Button>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Sign in to Squash" description="Use Google or get a one-time link by email.">
      <div className="space-y-4">
        <Button
          size="lg"
          onClick={() => void handleGoogle()}
          disabled={googleBusy}
          className="w-full"
        >
          <GoogleIcon />
          {googleBusy ? 'Redirecting…' : 'Continue with Google'}
        </Button>

        <div className="flex items-center gap-3 text-xs text-muted">
          <div className="h-px flex-1 bg-border" />
          or
          <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={(e) => void handleMagicLink(e)} className="space-y-3">
          <Field label="Email" error={error}>
            {({ id, describedBy }) => (
              <Input
                id={id}
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-describedby={describedBy}
                aria-invalid={error ? true : undefined}
              />
            )}
          </Field>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={sending || !email.trim()}
            className="w-full"
          >
            {sending ? 'Sending…' : 'Email me a link'}
          </Button>
        </form>
      </div>
    </AuthLayout>
  )
}
