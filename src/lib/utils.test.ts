import { describe, expect, it } from 'vitest'
import { cn, deriveTitle, initials, randomId, relativeTime } from './utils'

describe('cn', () => {
  it('joins truthy class names and drops falsy ones', () => {
    expect(cn('a', false, null, undefined, '', 'b')).toBe('a b')
  })
  it('returns an empty string with no classes', () => {
    expect(cn()).toBe('')
  })
})

describe('relativeTime', () => {
  const now = new Date(2026, 5, 15, 12, 0, 0)
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString()

  it('returns "just now" under a minute', () => {
    expect(relativeTime(ago(0), now)).toBe('just now')
    expect(relativeTime(ago(59_000), now)).toBe('just now')
  })
  it('returns "just now" for future timestamps and invalid input', () => {
    expect(relativeTime(ago(-120_000), now)).toBe('just now')
    expect(relativeTime('not a date', now)).toBe('just now')
  })
  it('returns minutes', () => {
    expect(relativeTime(ago(60_000), now)).toBe('1m')
    expect(relativeTime(ago(3 * 60_000 + 30_000), now)).toBe('3m')
    expect(relativeTime(ago(59 * 60_000), now)).toBe('59m')
  })
  it('returns hours', () => {
    expect(relativeTime(ago(60 * 60_000), now)).toBe('1h')
    expect(relativeTime(ago(2 * 3_600_000 + 59 * 60_000), now)).toBe('2h')
    expect(relativeTime(ago(23 * 3_600_000), now)).toBe('23h')
  })
  it('returns days under a week', () => {
    expect(relativeTime(ago(24 * 3_600_000), now)).toBe('1d')
    expect(relativeTime(ago(5 * 24 * 3_600_000), now)).toBe('5d')
    expect(relativeTime(ago(6 * 24 * 3_600_000), now)).toBe('6d')
  })
  it('returns a short date beyond a week', () => {
    expect(relativeTime(new Date(2026, 2, 3, 9, 0).toISOString(), now)).toBe('Mar 3')
  })
  it('includes the year for dates in another year', () => {
    expect(relativeTime(new Date(2025, 11, 25, 9, 0).toISOString(), now)).toBe('Dec 25, 2025')
  })
  it('defaults now to the current time', () => {
    expect(relativeTime(new Date().toISOString())).toBe('just now')
  })
})

describe('deriveTitle', () => {
  it('uses the first line, trimmed', () => {
    expect(deriveTitle('  Login button broken  \nsecond line')).toBe('Login button broken')
  })
  it('skips leading blank lines and collapses whitespace', () => {
    expect(deriveTitle('\n\n   Save   does\tnothing\r\nmore')).toBe('Save does nothing')
  })
  it('keeps titles of exactly 60 characters', () => {
    const sixty = 'x'.repeat(60)
    expect(deriveTitle(sixty)).toBe(sixty)
  })
  it('truncates longer titles to 60 characters ending with an ellipsis', () => {
    const title = deriveTitle('a'.repeat(100))
    expect(title).toBe(`${'a'.repeat(59)}…`)
    expect(Array.from(title)).toHaveLength(60)
  })
  it('does not leave trailing whitespace before the ellipsis', () => {
    const title = deriveTitle(`${'a'.repeat(58)} bcdef`)
    expect(title).toBe(`${'a'.repeat(58)}…`)
  })
  it('returns an empty string for blank input', () => {
    expect(deriveTitle('   \n  ')).toBe('')
  })
})

describe('initials', () => {
  it('uses first and last word initials', () => {
    expect(initials('Ada Lovelace')).toBe('AL')
    expect(initials('mary jane watson')).toBe('MW')
  })
  it('uses a single initial for one word', () => {
    expect(initials('  stanley ')).toBe('S')
  })
  it('returns "?" for empty names', () => {
    expect(initials('   ')).toBe('?')
  })
  it('handles non-BMP characters', () => {
    expect(initials('😀 Smile')).toBe('😀S')
  })
})

describe('randomId', () => {
  it('returns distinct UUIDs', () => {
    const a = randomId()
    expect(a).toMatch(/^[0-9a-f-]{36}$/)
    expect(randomId()).not.toBe(a)
  })
})
