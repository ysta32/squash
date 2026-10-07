import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Check } from 'lucide-react'
import { Button, Field, Input, Section } from '../ui'
import { Avatar } from '../Avatar'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import type { Profile } from '../../lib/types'
import { AVATAR_COLORS } from '../../lib/avatarColor'

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
          <>
            {error && (
              <p role="alert" className="mr-auto text-sm text-danger">
                {error}
              </p>
            )}
            {saved && (
              <p role="status" className="mr-auto text-sm text-muted">
                Profile saved.
              </p>
            )}
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={busy || !name.trim() || !dirty}
            >
              {busy ? 'Saving…' : saved ? 'Saved' : 'Save'}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <Avatar profile={{ ...profile, display_name: name, avatar_color: color }} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{name.trim() || 'Your name'}</p>
              <p className="text-xs text-muted">Preview</p>
            </div>
          </div>
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
            <legend className="mb-2 text-sm font-medium text-fg">Avatar color</legend>
            <div className="flex flex-wrap gap-2.5">
              {AVATAR_COLORS.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-label={`Avatar color ${value}`}
                  aria-pressed={color === value}
                  style={{ backgroundColor: value }}
                  className={`t focus-ring flex size-7 items-center justify-center rounded-full ring-offset-2 ring-offset-bg disabled:cursor-not-allowed ${color === value ? 'ring-2 ring-fg' : 'hover:ring-2 hover:ring-border'}`}
                  onClick={() => {
                    setColor(value)
                    setSaved(false)
                  }}
                >
                  {color === value && (
                    <Check className="size-3.5 text-white" strokeWidth={3} aria-hidden="true" />
                  )}
                </button>
              ))}
            </div>
            <p className="mt-2.5 text-xs text-muted">
              Your Google photo is used when available; otherwise, your initials appear in this
              color.
            </p>
          </fieldset>
        </div>
      </Section>
    </form>
  )
}
