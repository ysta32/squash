import { describe, expect, it } from 'vitest'
import { entryScript, isAppOutdated } from './useAppUpdate'

const page = (hash: string) =>
  `<head><script type="module" crossorigin src="/assets/index-${hash}.js"></script></head>`

describe('entryScript', () => {
  it('finds the hashed entry script of a built page', () => {
    expect(entryScript(page('Dq0i8kEl'))).toBe('/assets/index-Dq0i8kEl.js')
  })

  it('is null for the dev page', () => {
    expect(entryScript('<script type="module" src="/src/main.tsx"></script>')).toBeNull()
  })
})

describe('isAppOutdated', () => {
  it('is true once a different build is deployed', async () => {
    expect(await isAppOutdated('/assets/index-old.js', async () => page('new'))).toBe(true)
  })

  it('is false while the deployed build is the running one', async () => {
    expect(await isAppOutdated('/assets/index-same.js', async () => page('same'))).toBe(false)
  })

  it('is false in dev or when the page has no entry script', async () => {
    expect(await isAppOutdated(null, async () => page('new'))).toBe(false)
    expect(await isAppOutdated('/assets/index-old.js', async () => '<html></html>')).toBe(false)
  })
})
