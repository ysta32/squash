import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthLayout } from '../components/AuthLayout'
import { InviteDialog } from '../components/InviteDialog'
import { setLastWorkspace, useWorkspaces } from '../hooks/useWorkspaces'
import { Button, Field, Input } from '../components/ui'
import type { Workspace } from '../lib/types'

export default function Onboarding() {
  const navigate = useNavigate()
  const { createWorkspace, joinWorkspace } = useWorkspaces()
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ form: 'create' | 'join'; message: string } | null>(null)
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
      setError({
        form: 'create',
        message: err instanceof Error ? err.message : 'Something went wrong.',
      })
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
      setError({
        form: 'join',
        message: err instanceof Error ? err.message : 'Something went wrong.',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      title="Name your workspace"
      description="A workspace is a shared place for your team's bugs."
      footer={
        <form onSubmit={(e) => void onJoin(e)} className="space-y-3">
          <Field
            label="Have an invite code?"
            hint="Enter the 8 characters a teammate shared."
            error={error?.form === 'join' ? error.message : null}
          >
            {({ id, describedBy }) => (
              <div className="flex gap-2">
                <Input
                  id={id}
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s/g, ''))}
                  placeholder="ABCD1234"
                  aria-label="Invite code"
                  aria-describedby={describedBy}
                  maxLength={8}
                  className="min-w-0 flex-1 font-mono tracking-widest uppercase placeholder:tracking-widest"
                />
                <Button type="submit" disabled={busy || code.length < 8} className="w-20">
                  Join
                </Button>
              </div>
            )}
          </Field>
        </form>
      }
    >
      <form onSubmit={(e) => void onCreate(e)} className="space-y-3">
        <Field
          label="Workspace name"
          hint="Your team or product name. You can rename it later."
          error={error?.form === 'create' ? error.message : null}
        >
          {({ id, describedBy }) => (
            <Input
              id={id}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme web app"
              aria-label="Workspace name"
              aria-describedby={describedBy}
              maxLength={60}
            />
          )}
        </Field>
        <Button type="submit" variant="primary" disabled={busy || !name.trim()} className="w-full">
          Create workspace
        </Button>
      </form>

      {created && (
        <InviteDialog
          workspace={created}
          open
          canRegenerate={false}
          onClose={() => navigate(`/app/${created.id}`)}
        />
      )}
    </AuthLayout>
  )
}
