import { useRef, useState } from 'react'
import { Check } from 'lucide-react'
import { Input } from '../ui'
import { Avatar } from '../Avatar'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import type { Profile } from '../../lib/types'
import { AVATAR_PALETTE, avatarDarkColor, avatarPaletteColor } from '../../lib/avatarColor'
import { cn } from '../../lib/utils'
import { SignOutButton } from './AccountSettings'
import { LedgerGroup, LedgerRow, SaveError, SaveIndicator, SettingsPanel, TOUCH } from './Ledger'
import { useAutosave } from './useAutosave'

// Mirrors the profiles CHECK constraints in supabase/migrations/0001_init.sql.
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/
const MAX_NAME_LENGTH = 80

/**
 * Profile fields save themselves, like Appearance: the name when you leave the field (or press
 * Enter; Escape reverts), a color as soon as you pick it. Each row shows its own "Saved" tick.
 */
export function ProfileSettings({ profile }: { profile: Profile }) {
  const { user, refreshProfile } = useAuth()
  const [name, setName] = useState(profile.display_name)
  const [color, setColor] = useState(profile.avatar_color)
  const nameSave = useAutosave(
    `profile:${profile.id}:display_name`,
    profile.display_name,
    'Could not save your name.',
  )
  const colorSave = useAutosave(
    `profile:${profile.id}:avatar_color`,
    profile.avatar_color,
    'Could not save your avatar color.',
  )
  // Set by Escape: the draft was thrown away, so a failed save rolls the field back too.
  const reverted = useRef(false)

  async function write(patch: { display_name: string } | { avatar_color: string }) {
    if (!user) throw new Error('You are signed out.')
    const { error } = await supabase.from('profiles').update(patch).eq('id', user.id)
    if (error) throw new Error(error.message)
    await refreshProfile()
  }

  function commitName() {
    const next = name.trim()
    if (next === nameSave.pending()) {
      if (name !== next) setName(next)
      nameSave.clearError()
      return
    }
    if (!next) return nameSave.fail('Display name cannot be empty.')
    if (next.length > MAX_NAME_LENGTH)
      return nameSave.fail(`Display name must be at most ${MAX_NAME_LENGTH} characters.`)
    setName(next)
    reverted.current = false
    void nameSave.commit(next, (value) => write({ display_name: value }), {
      // A failed name stays in the field to retry, unless Escape already discarded it.
      onFail: (rollbackTo) => {
        if (reverted.current) setName(rollbackTo as string)
      },
    })
  }

  function commitColor(value: string) {
    if (!HEX_COLOR.test(value)) return colorSave.fail('Pick a valid avatar color.')
    setColor(value)
    void colorSave.commit(value, (next) => write({ avatar_color: next }), {
      // Only the newest pick rolls the swatch back; a later pick is still on its way.
      onFail: (rollbackTo) => setColor(rollbackTo as string),
    })
  }

  const shown = avatarPaletteColor(color)
  const nameError = nameSave.state.status === 'error'

  return (
    <SettingsPanel
      id="profile"
      title="Profile"
      description="How your name and avatar appear to teammates on bugs, comments and presence. Changes save as you make them."
    >
      <LedgerGroup>
        <div className="flex items-center gap-4 border-b border-line py-5">
          <Avatar profile={{ ...profile, display_name: name, avatar_color: color }} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-medium text-ink">{name.trim() || 'Your name'}</p>
            {user?.email && <p className="truncate text-sm text-ink-2">{user.email}</p>}
          </div>
          <SignOutButton />
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            commitName()
          }}
        >
          <LedgerRow
            label="Display name"
            htmlFor="profile-name"
            description="Shown on bugs you file and comments you write. Saves when you leave the field."
            status={<SaveIndicator state={nameSave.state} />}
          >
            <div className="flex w-full flex-col gap-1.5 sm:w-64">
              <Input
                id="profile-name"
                aria-describedby={nameError ? 'profile-name-error' : undefined}
                aria-invalid={nameError ? true : undefined}
                required
                maxLength={MAX_NAME_LENGTH}
                value={name}
                autoComplete="name"
                enterKeyHint="done"
                onChange={(event) => {
                  reverted.current = false
                  setName(event.target.value)
                }}
                onBlur={commitName}
                onKeyDown={(event) => {
                  if (event.key !== 'Escape') return
                  event.preventDefault()
                  // Back to the value saved or being saved; that save keeps reporting.
                  setName(nameSave.pending())
                  reverted.current = true
                  nameSave.clearError()
                }}
                className={TOUCH}
              />
              <SaveError id="profile-name-error" state={nameSave.state} />
            </div>
          </LedgerRow>
        </form>
        <LedgerRow
          stack
          label="Avatar color"
          labelId="avatar-color-label"
          description="Used behind your initials when there is no Google photo."
          status={<SaveIndicator state={colorSave.state} />}
        >
          <div
            role="group"
            aria-labelledby="avatar-color-label"
            className="-mx-1.5 grid w-[calc(100%+0.75rem)] grid-cols-[repeat(auto-fill,minmax(3.1429rem,1fr))] sm:flex sm:w-auto sm:flex-wrap"
          >
            {AVATAR_PALETTE.map(({ name: colorName, value }) => {
              const selected = shown === value
              return (
                <button
                  key={value}
                  type="button"
                  aria-label={`Avatar color ${colorName}`}
                  aria-pressed={selected}
                  title={colorName}
                  // The 44px button is the hit area; the round swatch inside wears the focus ring.
                  className="group flex h-[3.1429rem] min-w-[3.1429rem] items-center justify-center rounded-full outline-none sm:w-[3.1429rem]"
                  onClick={() => commitColor(value)}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      backgroundColor: value,
                      ['--swatch-dark' as string]: avatarDarkColor(value),
                    }}
                    className={cn(
                      't flex size-[2.2857rem] items-center justify-center rounded-full shadow-[inset_0_0_0_1px_rgb(28_27_24/0.12)] ring-offset-2 ring-offset-bg outline-offset-[5px] outline-focus group-focus-visible:outline-2 dark:bg-(--swatch-dark)! dark:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.16)]',
                      selected ? 'ring-2 ring-ink' : 'group-hover:ring-2 group-hover:ring-line-2',
                    )}
                  >
                    {selected && (
                      <Check className="size-4 text-white" strokeWidth={2} absoluteStrokeWidth />
                    )}
                  </span>
                </button>
              )
            })}
          </div>
          <SaveError id="avatar-color-error" state={colorSave.state} />
        </LedgerRow>
      </LedgerGroup>
    </SettingsPanel>
  )
}
