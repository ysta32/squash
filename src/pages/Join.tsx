import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
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

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--bg)] p-4 text-[var(--fg)]">
      <div className="w-full max-w-sm rounded-xl border border-[var(--border)] p-6 text-center">
        {loading || authLoading ? (
          <p className="text-sm text-[var(--muted)]">Loading…</p>
        ) : error ? (
          <>
            <p className="text-sm">{error}</p>
            <Link to="/" className="mt-4 inline-block text-sm text-[var(--accent)]">
              Back to home
            </Link>
          </>
        ) : preview ? (
          <>
            <h1 className="text-lg font-semibold">
              {preview.name} · {preview.member_count}{' '}
              {preview.member_count === 1 ? 'member' : 'members'}
            </h1>
            {user ? (
              <p className="mt-3 text-sm text-[var(--muted)]">Joining…</p>
            ) : (
              <Link
                to={`/signin?next=${next}`}
                className="mt-4 inline-block rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
              >
                Sign in to join
              </Link>
            )}
          </>
        ) : null}
      </div>
    </main>
  )
}
