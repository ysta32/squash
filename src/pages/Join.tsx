import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AuthLayout } from '../components/AuthLayout'
import { ButtonLink } from '../components/ui'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { friendlyError, setLastWorkspace, useWorkspaces } from '../hooks/useWorkspaces'

interface Preview {
  id: string
  name: string
  member_count: number
}

const INVALID = 'That invite code doesn’t exist.'

export default function Join() {
  const { code = '' } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const { joinWorkspace } = useWorkspaces()
  const [preview, setPreview] = useState<Preview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const joining = useRef(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { data, error: err } = await supabase.rpc('workspace_preview', { p_code: code })
      if (cancelled) return
      // The RPC can resolve with null data (e.g. no rows under some PostgREST setups); treat it as invalid.
      const row = Array.isArray(data) ? data[0] : undefined
      if (err) setError(friendlyError(err))
      else if (!row) setError(INVALID)
      else setPreview(row)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [code])

  useEffect(() => {
    if (!user || !preview || joining.current) return
    joining.current = true
    void (async () => {
      try {
        const ws = await joinWorkspace(code)
        setLastWorkspace(ws.id)
        navigate(`/app/${ws.id}`, { replace: true })
      } catch (err) {
        joining.current = false
        setError(err instanceof Error ? err.message : 'Something went wrong.')
      }
    })()
  }, [user, preview, code, joinWorkspace, navigate])

  const next = encodeURIComponent(`/join/${code}`)

  const eyebrow = `Invite · ${code.toUpperCase()}`

  if (loading || authLoading) {
    return (
      <AuthLayout eyebrow={eyebrow} title="Checking invite">
        <div role="status" aria-label="Loading invite details" className="space-y-3">
          <span className="sr-only">Loading invite details…</span>
          <div aria-hidden="true" className="h-4 w-3/4 animate-skeleton rounded-sm bg-surface-3" />
          <div
            aria-hidden="true"
            className="h-11 w-full animate-skeleton rounded-md bg-surface-3"
          />
        </div>
      </AuthLayout>
    )
  }

  if (error || !preview) {
    return (
      <AuthLayout
        eyebrow={eyebrow}
        title="Invite not available"
        description={
          // One lead paragraph: what happened, then what to do.
          <>
            <span role="alert">{error ?? INVALID}</span> Ask the person who invited you for a new
            link, or open a workspace of your own.
          </>
        }
        footer="Invite links stop working when the owner regenerates them or the workspace is full."
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <ButtonLink to="/app?new=1" variant="primary" size="lg" className="sm:flex-1">
            Open a workspace
          </ButtonLink>
          <ButtonLink to="/" variant="secondary" size="lg" className="sm:flex-1">
            Back to home
          </ButtonLink>
        </div>
      </AuthLayout>
    )
  }

  const members = `${preview.member_count} ${preview.member_count === 1 ? 'member' : 'members'}`

  return (
    <AuthLayout
      eyebrow={eyebrow}
      title={`Join ${preview.name}`}
      pitch
      description={`You have been invited to this workspace. It has ${members}.`}
      footer={
        user
          ? undefined
          : 'Signing in with a new email creates your account, then brings you straight back here.'
      }
    >
      {user ? (
        <div role="status" className="space-y-3">
          <p className="text-sm text-ink-2">Joining {preview.name}…</p>
          <div
            aria-hidden="true"
            className="h-11 w-full animate-skeleton rounded-md bg-surface-3"
          />
        </div>
      ) : (
        <ButtonLink to={`/signin?next=${next}`} variant="primary" size="lg" className="w-full">
          Sign in to join
        </ButtonLink>
      )}
    </AuthLayout>
  )
}
