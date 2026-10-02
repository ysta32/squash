const DEFAULT_NEXT = '/app'

/** True if the string contains whitespace, C0 control characters (U+0000–U+001F) or DEL. */
function hasControlOrWhitespace(value: string): boolean {
  if (/\s/.test(value)) return true
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i)
    if (code <= 0x1f || code === 0x7f) return true
  }
  return false
}

/**
 * Only allow same-origin relative paths as post-auth redirect targets.
 * Rejects absolute URLs, protocol-relative ("//evil") and backslash tricks ("/\evil").
 */
export function safeNext(raw: string | null | undefined): string {
  if (!raw) return DEFAULT_NEXT
  if (!raw.startsWith('/')) return DEFAULT_NEXT
  if (raw.startsWith('//') || raw.startsWith('/\\')) return DEFAULT_NEXT
  // Browsers strip tabs/newlines and normalise backslashes, so "/\n/evil" would become "//evil".
  if (hasControlOrWhitespace(raw)) return DEFAULT_NEXT
  let url: URL
  try {
    url = new URL(raw, window.location.origin)
  } catch {
    return DEFAULT_NEXT
  }
  if (url.origin !== window.location.origin || !url.pathname.startsWith('/')) return DEFAULT_NEXT
  return raw
}

/** OAuth / magic-link redirect target: `${origin}/auth/callback?next=<encoded next>`. */
export function authCallbackUrl(next?: string): string {
  return `${window.location.origin}/auth/callback?next=${encodeURIComponent(next ?? DEFAULT_NEXT)}`
}
