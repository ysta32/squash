// Captures the README screenshots from the real app running against demo data.
//   npm run screenshots              # all shots into docs/screenshots/
//   npm run screenshots -- workspace # only shots whose name contains "workspace"
// Uses your installed Google Chrome (Playwright's "chrome" channel).
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { createServer } from 'vite'
import { fixtures, socialCard } from './fixtures.mjs'

const configFile = fileURLToPath(new URL('./vite.config.ts', import.meta.url))
const fixturesDir = fileURLToPath(
  new URL('../../node_modules/.cache/squash-shots/', import.meta.url),
)
const outDir = fileURLToPath(new URL('../../docs/screenshots/', import.meta.url))
const only = process.argv[2]

const browser = await chromium.launch({ channel: 'chrome' })

// 1. Render the demo bugs' attached screenshots.
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

// 2. Serve the app with the mocked backend.
const server = await createServer({ configFile, logLevel: 'error' })
await server.listen()
const origin = 'http://localhost:5174'

const desktop = { width: 1440, height: 900 }
const mobile = { width: 430, height: 932 }

/** name, path, viewport, theme, optional scheme and an action to run before the shot. */
const shots = (await import('./shots.mjs')).shots({ desktop, mobile })

mkdirSync(outDir, { recursive: true })
for (const shot of shots) {
  if (only && !shot.name.includes(only)) continue
  const context = await browser.newContext({
    viewport: shot.viewport,
    deviceScaleFactor: 2,
    colorScheme: shot.theme,
    isMobile: shot.viewport === mobile,
    hasTouch: shot.viewport === mobile,
  })
  await context.addInitScript(
    ([theme, scheme]) => {
      localStorage.setItem('squash:theme', theme)
      if (scheme) localStorage.setItem('squash:scheme', scheme)
      else localStorage.removeItem('squash:scheme')
    },
    [shot.theme, shot.scheme ?? null],
  )
  const page = await context.newPage()
  await page.goto(origin + shot.path, { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  if (shot.before) await shot.before(page)
  await page.waitForTimeout(400)
  // Composite parts go to the cache; compose.mjs assembles them.
  const path = `${shot.composite ? fixturesDir : outDir}${shot.name}.png`
  const clip = typeof shot.clip === 'function' ? await shot.clip(page) : shot.clip
  await page.screenshot({ path, clip })
  console.log(shot.composite ? `(part) ${shot.name}` : `docs/screenshots/${shot.name}.png`)
  await context.close()
}

// 3. An animated demo of filing a bug: attach a screenshot, describe it, press Enter. Frames come
// from Chrome's screencast and are encoded with the system ffmpeg.
if (!only || 'demo'.includes(only)) {
  const framesDir = `${fixturesDir}frames/`
  rmSync(framesDir, { recursive: true, force: true })
  mkdirSync(framesDir, { recursive: true })
  const context = await browser.newContext({ viewport: desktop, colorScheme: 'light' })
  await context.addInitScript(() => localStorage.setItem('squash:theme', 'light'))
  const page = await context.newPage()
  await page.goto(`${origin}/app/ws-lumen/bug/23`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)

  const cdp = await context.newCDPSession(page)
  const frames = []
  cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
    const file = `${framesDir}${String(frames.length).padStart(4, '0')}.png`
    writeFileSync(file, Buffer.from(data, 'base64'))
    frames.push({ file, t: metadata.timestamp })
    void cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {})
  })
  await cdp.send('Page.startScreencast', {
    format: 'png',
    maxWidth: desktop.width,
    maxHeight: desktop.height,
  })

  const box = page.getByRole('textbox').first()
  await page.waitForTimeout(900)
  await box.click()
  await page.waitForTimeout(400)
  await page.getByTestId('file-input').setInputFiles(`${fixturesDir}checkout-mobile.png`)
  await page.waitForTimeout(900)
  await box.pressSequentially('Pay now is hidden behind the cookie banner on iPhone', { delay: 45 })
  await page.waitForTimeout(500)
  await page.keyboard.press('Alt+4')
  await page.waitForTimeout(900)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(2200)
  await cdp.send('Page.stopScreencast')
  frames.push({ file: frames.at(-1).file, t: frames.at(-1).t + 1.5 }) // hold the last frame
  await context.close()

  // Screencast frames arrive only on change, so each one is held until the next.
  const list = frames
    .slice(0, -1)
    .map((f, i) => `file '${f.file}'\nduration ${(frames[i + 1].t - f.t).toFixed(3)}`)
    .join('\n')
  writeFileSync(`${framesDir}list.txt`, `${list}\nfile '${frames.at(-1).file}'\n`)
  execFileSync('ffmpeg', [
    '-y',
    '-loglevel',
    'error',
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    `${framesDir}list.txt`,
    '-vf',
    'fps=15,scale=1200:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a:diff_mode=rectangle',
    `${outDir}demo.gif`,
  ])
  console.log('docs/screenshots/demo.gif')
}

// 4. GitHub social preview card (upload it in the repo's Settings → Social preview).
if (!only || 'social'.includes(only)) {
  const shot = readFileSync(`${outDir}workspace-dark.png`).toString('base64')
  const page = await browser.newPage({
    viewport: { width: 1280, height: 640 },
    deviceScaleFactor: 2,
  })
  await page.setContent(socialCard(shot))
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${outDir}social-preview.png` })
  await page.close()
  console.log('docs/screenshots/social-preview.png')
}

await browser.close()
await server.close()

// 5. Framed composites (hero, phones, color schemes).
if (!only) await import('./compose.mjs')
