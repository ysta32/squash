// Renders the demo bugs' attached screenshots into the cache the mocked backend serves from.
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { fixtures } from './fixtures.mjs'

export const fixturesDir = fileURLToPath(
  new URL('../../node_modules/.cache/squash-shots/', import.meta.url),
)

/** Renders every fixture image with the given Playwright browser. */
export async function renderFixtures(browser) {
  mkdirSync(fixturesDir, { recursive: true })
  for (const f of fixtures) {
    const page = await browser.newPage({
      viewport: { width: f.width, height: f.height },
      deviceScaleFactor: 2,
    })
    await page.setContent(f.html)
    writeFileSync(fixturesDir + f.file, await page.screenshot())
    await page.close()
  }
}
