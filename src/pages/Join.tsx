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

const INVALID = "That invite code doesn't exist."

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
      if (err) setError(friendlyError(err))
      else if (data.length === 0) setError(INVALID)
      else setPreview(data[0])
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

  if (loading || authLoading) {
    return (
      <AuthLayout title="Checking invite">
        <p role="status" className="text-sm text-muted">
          Loading invite details…
        </p>
      </AuthLayout>
    )
  }

  if (error || !preview) {
    return (
      <AuthLayout
        title="Invite not available"
        description={<span role="alert">{error ?? INVALID}</span>}
      >
        <p className="mb-4 text-sm text-muted">
          Ask the person who invited you for a new link, or create a workspace of your own.
        </p>
        <ButtonLink to="/" variant="secondary" size="lg" className="w-full">
          Back to home
        </ButtonLink>
      </AuthLayout>
    )
  }

  const members = `${preview.member_count} ${preview.member_count === 1 ? 'member' : 'members'}`

  return (
    <AuthLayout
      title={`Join ${preview.name}`}
      description={`You have been invited to this workspace. It has ${members}.`}
    >
      {user ? (
        <p role="status" className="text-sm text-muted">
          Joining workspace…
        </p>
      ) : (
        <ButtonLink to={`/signin?next=${next}`} variant="primary" size="lg" className="w-full">
          Sign in to join
        </ButtonLink>
      )}
    </AuthLayout>
  )
}
