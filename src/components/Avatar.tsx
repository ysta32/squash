import { useState } from 'react'
import type { Profile } from '../lib/types'
import { avatarDarkColor, avatarPaletteColor } from '../lib/avatarColor'
import { cn, initials } from '../lib/utils'

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg'

const SIZE_CLASS: Record<AvatarSize, string> = {
  xs: 'h-5 w-5 text-[9px]',
  sm: 'h-6 w-6 text-[10px]',
  md: 'h-8 w-8 text-xs',
  lg: 'h-12 w-12 text-base',
}

export interface AvatarProps {
  profile: Pick<Profile, 'display_name' | 'avatar_url' | 'avatar_color'> | null
  size?: AvatarSize
  ring?: boolean
  className?: string
}

export function Avatar({ profile, size = 'md', ring = false, className }: AvatarProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const url = profile?.avatar_url ?? null

  const base = cn(
    'inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-semibold',
    SIZE_CLASS[size],
    ring && 'ring-2 ring-success',
    className,
  )

  if (!profile) {
    return (
      <span className={cn(base, 'bg-muted text-bg')} aria-label="Unknown user">
        ?
      </span>
    )
  }

  if (url && failedUrl !== url) {
    return (
      <img
        src={url}
        alt={profile.display_name}
        referrerPolicy="no-referrer"
        onError={() => setFailedUrl(url)}
        className={cn(base, 'object-cover')}
      />
    )
  }

  const color = avatarPaletteColor(profile.avatar_color)
  return (
    <span
      // A 1px inset hairline keeps the disc's edge on any page; darkroom swaps in the lifted ink.
      className={cn(
        base,
        'text-white shadow-[inset_0_0_0_1px_rgb(28_27_24/0.12)] dark:bg-(--avatar-dark)! dark:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.16)]',
      )}
      style={{ backgroundColor: color, ['--avatar-dark' as string]: avatarDarkColor(color) }}
      aria-label={profile.display_name}
    >
      {initials(profile.display_name)}
    </span>
  )
}
