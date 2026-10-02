import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { InviteDialog } from '../components/InviteDialog'
import { setLastWorkspace, useWorkspaces } from '../hooks/useWorkspaces'
import type { Workspace } from '../lib/types'

export default function Onboarding() {
  const navigate = useNavigate()
  const { createWorkspace, joinWorkspace } = useWorkspaces()
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<Workspace | null>(null)

  const onCreate = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    setError(null)
    try {
      const ws = await createWorkspace(name)
      setLastWorkspace(ws.id)
      setCreated(ws)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  const onJoin = async (e: FormEvent) => {
    e.preventDefault()
    if (code.length < 8) return
    setBusy(true)
    setError(null)
    try {
      const ws = await joinWorkspace(code)
      setLastWorkspace(ws.id)
      navigate(`/app/${ws.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--bg)] p-4 text-[var(--fg)]">
      <div className="w-full max-w-md rounded-xl border border-[var(--border)] p-6">
        <section>
          <h1 className="text-lg font-semibold">Create a workspace</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">A shared place for your team's bugs.</p>
          <form onSubmit={(e) => void onCreate(e)} className="mt-3 flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Workspace name"
              aria-label="Workspace name"
              maxLength={60}
              className="min-w-0 flex-1 rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={busy || !name.trim()}
              className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Create
            </button>
          </form>
        </section>

        <div className="my-6 border-t border-[var(--border)]" />

        <section>
          <h2 className="text-lg font-semibold">Join with a code</h2>
          <form onSubmit={(e) => void onJoin(e)} className="mt-3 flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s/g, ''))}
              placeholder="ABCD1234"
              aria-label="Invite code"
              maxLength={8}
              className="min-w-0 flex-1 rounded-md border border-[var(--border)] bg-transparent px-3 py-2 font-mono text-sm uppercase tracking-widest"
            />
            <button
              type="submit"
              disabled={busy || code.length < 8}
              className="rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              Join
            </button>
          </form>
        </section>

        {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
      </div>

      {created && (
        <InviteDialog
          workspace={created}
          open
          canRegenerate={false}
          onClose={() => navigate(`/app/${created.id}`)}
        />
      )}
    </main>
  )
}
