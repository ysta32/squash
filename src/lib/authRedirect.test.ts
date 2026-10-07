import { describe, expect, it } from 'vitest'
import { authCallbackUrl, safeNext } from './authRedirect'

describe('safeNext', () => {
  it('defaults when empty', () => {
    expect(safeNext(null)).toBe('/app')
    expect(safeNext(undefined)).toBe('/app')
    expect(safeNext('')).toBe('/app')
  })

  it('keeps same-origin relative paths with query and hash', () => {
    expect(safeNext('/app/ws/1')).toBe('/app/ws/1')
    expect(safeNext('/app?x=1#h')).toBe('/app?x=1#h')
  })

  it.each([
    'https://evil.com',
    'http://localhost/app',
    'javascript:alert(1)',
    'evil.com/app',
    'app',
    '//evil.com',
    '/\\evil.com',
    '/\n/evil.com',
    '/\t/evil.com',
    '/ /evil.com',
    '/a\u0000b',
    '/a\u007fb',
  ])('rejects %j', (raw) => {
    expect(safeNext(raw)).toBe('/app')
  })
})

describe('authCallbackUrl', () => {
  it('encodes the next target onto the callback URL', () => {
    expect(authCallbackUrl('/app?a=1&b=2')).toBe(
      `${window.location.origin}/auth/callback?next=${encodeURIComponent('/app?a=1&b=2')}`,
    )
  })

  it('falls back to /app', () => {
    expect(authCallbackUrl()).toBe(`${window.location.origin}/auth/callback?next=%2Fapp`)
  })
})
