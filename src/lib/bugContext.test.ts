import { afterEach, describe, expect, it, vi } from 'vitest'
import { collectEnvContext, extractUrl, formatContext, sanitizeContext } from './bugContext'

afterEach(() => vi.restoreAllMocks())

describe('sanitizeContext', () => {
  it.each([null, [], 'text', 1, undefined])('ignores non-objects %j', (value) => {
    expect(sanitizeContext(value)).toEqual({})
  })
  it('drops unknown keys, invalid dimensions and unsafe URLs', () => {
    expect(
      sanitizeContext({
        secret: 'no',
        url: 'javascript:alert(1)',
        viewport: { w: Infinity, h: 2 },
        browser: 4,
      }),
    ).toEqual({})
    expect(sanitizeContext({ url: 'file:///tmp/foo', viewport: { w: 0, h: 2 } })).toEqual({})
  })
  it('bounds strings and numbers and keeps only recognized viewport keys', () => {
    expect(
      sanitizeContext({
        browser: 'x'.repeat(200),
        build: '\n abc\t',
        viewport: { w: 200000, h: 900.4, dpr: 30, secret: true },
      }),
    ).toEqual({ browser: 'x'.repeat(128), build: 'abc', viewport: { w: 100000, h: 900, dpr: 16 } })
    expect(
      sanitizeContext({ url: 'https://example.com/' + 'a'.repeat(3000) }).url?.length,
    ).toBeLessThanOrEqual(2048)
  })
})

describe('extractUrl', () => {
  it('finds the first external http(s) URL and excludes the app origin', () => {
    expect(
      extractUrl(`${window.location.origin}/app https://example.com/checkout https://second.test`),
    ).toBe('https://example.com/checkout')
    expect(extractUrl('No URL ftp://example.com')).toBeUndefined()
  })
  it('handles prose and markdown punctuation', () => {
    expect(extractUrl('See [page](https://example.com/path).')).toBe('https://example.com/path')
    expect(extractUrl('https://example.com/a(b)')).toBe('https://example.com/a(b)')
    expect(extractUrl('https:// https://valid.test')).toBe('https://valid.test/')
  })
})

describe('review follow-ups', () => {
  it('rounds the pixel ratio and strips invisible bidi characters', () => {
    const ctx = sanitizeContext({
      viewport: { w: 1440, h: 900, dpr: 1.100000023841858 },
      browser: 'Chrome\u202e131\u2066',
    })
    expect(ctx.viewport?.dpr).toBe(1.1)
    expect(ctx.browser).toBe('Chrome131')
  })

  it('trims punctuation after closing brackets', () => {
    expect(extractUrl('(see https://example.com/x.)')).toBe('https://example.com/x')
    expect(extractUrl('[link](https://example.com/a_(b)).')).toBe('https://example.com/a_(b)')
  })
})

describe('collectEnvContext', () => {
  it.each([
    [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/131.0.0.0 Safari/537.36',
      'Chrome 131',
      'macOS',
    ],
    [
      'Mozilla/5.0 (Windows NT 10.0) Chrome/131.0.0.0 Safari/537.36 Edg/131.0',
      'Edge 131',
      'Windows',
    ],
    [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18.0 Mobile Safari/604.1',
      'Safari 18',
      'iOS',
    ],
    ['Mozilla/5.0 (Android 15) Firefox/132.0', 'Firefox 132', 'Android'],
  ])('parses %s', (ua, browser, os) => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(ua)
    expect(collectEnvContext()).toMatchObject({
      browser,
      os,
      viewport: { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio },
    })
  })
  it('formats missing context as empty', () => {
    expect(formatContext(null)).toBe('')
  })
})
