import { mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { createServer } from 'vite'
import { fixtures } from '../screenshots/fixtures.mjs'

const require = createRequire(import.meta.url)
const configFile = fileURLToPath(new URL('../screenshots/vite.config.ts', import.meta.url))
const cacheDir = fileURLToPath(new URL('../../node_modules/.cache/squash-a11y/', import.meta.url))
const fixturesDir = fileURLToPath(
  new URL('../../node_modules/.cache/squash-shots/', import.meta.url),
)
const scenarios = [
  { path: '/', signedOut: true },
  { path: '/signin', signedOut: true },
  { path: '/claude' },
  { path: '/privacy' },
  { path: '/app/ws-lumen' },
  { path: '/app/ws-lumen/bug/24' },
  { path: '/app/ws-lumen/settings' },
  { path: '/app/ws-lumen', overlay: 'Command palette', key: 'ControlOrMeta+k' },
  { path: '/app/ws-lumen', overlay: 'Keyboard shortcuts', key: '?' },
]

const results = []
const groups = new Map()
let browser
let server
let failed = false

function compact(value) {
  return value.replace(/\s+/g, ' ').trim().slice(0, 160)
}

try {
  mkdirSync(cacheDir, { recursive: true })
  mkdirSync(fixturesDir, { recursive: true })
  browser = await chromium.launch({ channel: 'chrome' })
  for (const fixture of fixtures) {
    const page = await browser.newPage({
      viewport: { width: fixture.width, height: fixture.height },
      deviceScaleFactor: 2,
    })
    try {
      await page.setContent(fixture.html)
      await page.screenshot({ path: fixturesDir + fixture.file })
    } finally {
      await page.close()
    }
  }

  server = await createServer({ configFile, logLevel: 'error' })
  await server.listen()
  const origin = server.resolvedUrls?.local[0]
  if (!origin) throw new Error('Mock Vite server did not provide a local URL')

  for (const theme of ['light', 'dark']) {
    for (const scenario of scenarios) {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 2,
        colorScheme: theme,
      })
      try {
        await context.addInitScript(
          ({ theme, signedOut }) => {
            localStorage.setItem('squash:theme', theme)
            localStorage.removeItem('squash:scheme')
            if (signedOut) localStorage.setItem('squash:demo-signed-out', '1')
            else localStorage.removeItem('squash:demo-signed-out')
          },
          { theme, signedOut: scenario.signedOut ?? false },
        )
        const page = await context.newPage()
        const response = await page.goto(new URL(scenario.path, origin).href, {
          waitUntil: 'networkidle',
        })
        if (!response?.ok()) throw new Error(`Failed to load ${scenario.path}`)
        await page.waitForTimeout(600)
        if (new URL(page.url()).pathname !== scenario.path) {
          throw new Error(`Unexpected redirect from ${scenario.path} to ${page.url()}`)
        }
        if (scenario.overlay) {
          await page.keyboard.press(scenario.key)
          await page.getByRole('dialog', { name: scenario.overlay, exact: true }).waitFor()
        }
        await page.waitForTimeout(400)
        await page.evaluate(() => document.fonts.ready)
        await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') })
        const audit = await page.evaluate(() =>
          window.axe.run(document, {
            runOnly: {
              type: 'tag',
              values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'],
            },
          }),
        )
        const label = `${scenario.path}${scenario.overlay ? ` (${scenario.overlay})` : ''} [${theme}]`
        results.push({ page: label, path: scenario.path, theme, overlay: scenario.overlay, audit })
        for (const violation of audit.violations) {
          if (['serious', 'critical'].includes(violation.impact)) failed = true
          let group = groups.get(violation.id)
          if (!group) {
            group = { impacts: new Set(), count: 0, pages: [], examples: [] }
            groups.set(violation.id, group)
          }
          group.impacts.add(violation.impact)
          group.count += violation.nodes.length
          group.pages.push(label)
          for (const node of violation.nodes) {
            if (group.examples.length === 2) break
            group.examples.push({ target: node.target, html: node.html })
          }
        }
      } finally {
        await context.close()
      }
    }
  }

  console.log(`Audited ${results.length} page/theme states; ${groups.size} rules with violations.`)
  for (const [id, group] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    console.log(
      `${id} | ${[...group.impacts].join(', ')} | count=${group.count} | pages: ${group.pages.join('; ')}`,
    )
    for (const example of group.examples) {
      console.log(`  ${compact(JSON.stringify(example.target))} | ${compact(example.html)}`)
    }
  }
  console.log(
    failed
      ? 'FAIL: serious or critical violations found.'
      : 'PASS: no serious or critical violations.',
  )
  process.exitCode = failed ? 1 : 0
} catch (error) {
  console.error(`Audit failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
} finally {
  try {
    mkdirSync(cacheDir, { recursive: true })
    writeFileSync(
      `${cacheDir}report.json`,
      JSON.stringify({ complete: results.length === scenarios.length * 2, results }, null, 2) +
        '\n',
    )
    console.log('JSON: node_modules/.cache/squash-a11y/report.json')
  } finally {
    try {
      await browser?.close()
    } finally {
      await server?.close()
    }
  }
}
