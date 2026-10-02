export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/**
 * Compact relative time: "just now", "3m", "2h", "5d", then "Mar 3" (same year) or "Mar 3, 2024".
 * Future timestamps (clock skew) and invalid input render as "just now".
 */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso)
  const t = then.getTime()
  if (Number.isNaN(t)) return 'just now'
  const diff = now.getTime() - t
  if (diff < MINUTE) return 'just now'
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m`
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h`
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}d`
  const label = `${MONTHS[then.getMonth()]} ${then.getDate()}`
  return then.getFullYear() === now.getFullYear() ? label : `${label}, ${then.getFullYear()}`
}

const TITLE_MAX = 60

/** First non-empty line, whitespace-collapsed, at most 60 characters (truncated with "…"). */
export function deriveTitle(text: string): string {
  const line =
    text
      .split(/\r?\n/)
      .map((l) => l.replace(/\s+/g, ' ').trim())
      .find((l) => l.length > 0) ?? ''
  const chars = Array.from(line)
  if (chars.length <= TITLE_MAX) return line
  return `${chars
    .slice(0, TITLE_MAX - 1)
    .join('')
    .trimEnd()}…`
}

/** Up to two uppercase initials from the first and last word; "?" when empty. */
export function initials(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0)
  if (words.length === 0) return '?'
  const first = Array.from(words[0])[0]
  if (words.length === 1) return first.toUpperCase()
  const last = Array.from(words[words.length - 1])[0]
  return `${first}${last}`.toUpperCase()
}

export function randomId(): string {
  return crypto.randomUUID()
}

export const isMac: boolean =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent)
