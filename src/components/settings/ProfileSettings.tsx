import { useState } from 'react'
import type { FormEvent } from 'react'
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

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user || !name.trim() || busy) return
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
      setSaved(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save your profile.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={(event) => void save(event)} className="space-y-6">
      <h2 className="text-lg font-medium">Profile</h2>
      <Avatar profile={{ ...profile, display_name: name, avatar_color: color }} size="lg" />
      <label className="block space-y-2">
        <span>Display name</span>
        <input
          required
          maxLength={MAX_NAME_LENGTH}
          value={name}
          onChange={(event) => {
            setName(event.target.value)
            setSaved(false)
          }}
          disabled={busy}
          className="t block w-full rounded-md border border-border bg-bg px-3 py-2 focus:outline-accent"
        />
      </label>
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
              className={`t h-7 w-7 rounded-full border-2 border-bg hover:scale-110 ${color === value ? 'ring-2 ring-accent ring-offset-2 ring-offset-bg' : ''}`}
              onClick={() => {
                setColor(value)
                setSaved(false)
              }}
            />
          ))}
        </div>
        <p className="mt-3 text-sm text-muted">
          Your Google photo is used when available; otherwise, your initials appear in this color.
        </p>
      </fieldset>
      {error && (
        <p role="alert" className="text-red-500">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="text-muted">
          Profile saved.
        </p>
      )}
      <button
        disabled={busy || !name.trim()}
        className="t rounded-md bg-accent px-4 py-2 text-accent-fg hover:opacity-90 disabled:opacity-50"
      >
        {busy ? 'Saving…' : 'Save profile'}
      </button>
    </form>
  )
}
