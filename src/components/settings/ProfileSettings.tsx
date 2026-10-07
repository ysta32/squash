import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Button, Field, Input, Section } from '../ui'
import { Avatar } from '../Avatar'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import type { Profile } from '../../lib/types'

const COLORS = [
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#10b981',
  '#06b6d4',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#6366f1',
  '#14b8a6',
]

// Mirrors the profiles CHECK constraints in supabase/migrations/0001_init.sql.
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/
const MAX_NAME_LENGTH = 80

export function ProfileSettings({ profile }: { profile: Profile }) {
  const { user, refreshProfile } = useAuth()
  const [name, setName] = useState(profile.display_name)
  const [color, setColor] = useState(profile.avatar_color)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const [persisted, setPersisted] = useState({
    name: profile.display_name,
    color: profile.avatar_color,
  })
  const dirty = name.trim() !== persisted.name || color !== persisted.color

  useEffect(() => {
    if (!saved) return
    const timer = window.setTimeout(() => setSaved(false), 2500)
    return () => window.clearTimeout(timer)
  }, [saved])

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user || !name.trim() || busy || !dirty) return
    setSaved(false)
    if (name.trim().length > MAX_NAME_LENGTH) {
      setError(`Display name must be at most ${MAX_NAME_LENGTH} characters.`)
      return
    }
    if (!HEX_COLOR.test(color)) {
      setError('Pick a valid avatar color.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ display_name: name.trim(), avatar_color: color })
        .eq('id', user.id)
      if (updateError) throw new Error(updateError.message)
      await refreshProfile()
      setPersisted({ name: name.trim(), color })
      setName(name.trim())
      setSaved(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save your profile.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={(event) => void save(event)} className="space-y-6">
      <Section
        title="Profile"
        description="Choose how your name and avatar appear to your team."
        footer={
          <Button type="submit" variant="primary" disabled={busy || !name.trim() || !dirty}>
            {busy ? 'Saving…' : saved ? 'Saved' : 'Save'}
          </Button>
        }
      >
        <div className="space-y-5">
          <Avatar profile={{ ...profile, display_name: name, avatar_color: color }} size="lg" />
          <Field label="Display name">
            {({ id, describedBy }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                required
                maxLength={MAX_NAME_LENGTH}
                value={name}
                onChange={(event) => {
                  setName(event.target.value)
                  setSaved(false)
                }}
                disabled={busy}
              />
            )}
          </Field>
          <fieldset disabled={busy}>
            <legend className="mb-3">Avatar color</legend>
            <div className="flex flex-wrap gap-3">
              {COLORS.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-label={`Avatar color ${value}`}
                  aria-pressed={color === value}
                  style={{ backgroundColor: value }}
                  className={`focus-ring h-7 w-7 rounded-full border-2 border-bg hover:scale-110 ${color === value ? 'ring-2 ring-accent ring-offset-2 ring-offset-bg' : ''}`}
                  onClick={() => {
                    setColor(value)
                    setSaved(false)
                  }}
                />
              ))}
            </div>
            <p className="mt-3 text-sm text-muted">
              Your Google photo is used when available; otherwise, your initials appear in this
              color.
            </p>
          </fieldset>
          {error && (
            <p role="alert" className="text-danger">
              {error}
            </p>
          )}
          {saved && (
            <p role="status" className="text-muted">
              Profile saved.
            </p>
          )}
        </div>
      </Section>
    </form>
  )
}
