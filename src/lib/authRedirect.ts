const DEFAULT_NEXT = '/app'

/**
 * Only allow same-origin relative paths as post-auth redirect targets.
 * Rejects absolute URLs, protocol-relative ("//evil") and backslash tricks ("/\evil").
 */
export function safeNext(raw: string | null | undefined): string {
  if (!raw) return DEFAULT_NEXT
  if (!raw.startsWith('/')) return DEFAULT_NEXT
  if (raw.startsWith('//') || raw.startsWith('/\\')) return DEFAULT_NEXT
  return raw
}

/** OAuth / magic-link redirect target: `${origin}/auth/callback?next=<encoded next>`. */
export function authCallbackUrl(next?: string): string {
  return `${window.location.origin}/auth/callback?next=${encodeURIComponent(next ?? DEFAULT_NEXT)}`
}
