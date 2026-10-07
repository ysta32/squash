// Visual-QA screenshot tool: captures routes at several widths in light and dark against the
// mocked backend (scripts/screenshots/vite.config.ts) and writes PNGs plus an index.html sheet.
//
// Run it through the e2e serializer (the machine is CPU-saturated):
//   ~/.claude/orch/bin/serial e2e -- npm run qa:shots -- --out .orch/shots/latest
//   node scripts/visual-qa/run.mjs --out <dir> [--routes /,/claude] [--widths 375,1280] [--themes light]
// Env: QA_PORT (default 4210). Uses your installed Google Chrome.
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { createServer } from 'vite'
import { renderFixtures } from '../screenshots/render-fixtures.mjs'

const DEFAULT_ROUTES = [
  '/',
  '/signin',
  '/claude',
  '/privacy',
  '/terms',
  '/app/ws-lumen',
  '/app/ws-lumen/bug/24',
  '/app/ws-lumen/settings',
  '/no-such-page',
]
const FORBIDDEN_PORTS = new Set([5173, 5174, 3000, 5000, 8080])

const args = process.argv.slice(2)
const opt = (name) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : undefined
}
const list = (name, fallback) => opt(name)?.split(',').filter(Boolean) ?? fallback

const routes = list('routes', DEFAULT_ROUTES)
const widths = list('widths', ['375', '768', '1280', '1920']).map(Number)
const themes = list('themes', ['light', 'dark'])
const outDir = resolve(opt('out') ?? '.orch/shots/latest')
const port = Number(process.env.QA_PORT ?? 4210)
const height = 900

if (!Number.isInteger(port) || FORBIDDEN_PORTS.has(port)) {
  throw new Error(`QA_PORT ${process.env.QA_PORT} is not allowed`)
}
if (widths.some((w) => !Number.isFinite(w) || w <= 0)) throw new Error('invalid --widths')
if (themes.some((t) => t !== 'light' && t !== 'dark')) throw new Error('--themes: light,dark')

const slug = (route) =>
  route === '/' ? 'home' : route.replace(/^\/|\/$/g, '').replace(/\W+/g, '-')

const repoRoot = fileURLToPath(new URL('../..', import.meta.url))
const rel = relative(outDir, repoRoot)
if (outDir === sep || outDir === resolve(homedir()) || rel === '' || !rel.startsWith('..')) {
  throw new Error(`refusing to use ${outDir} as --out (root, home, repo, or a repo ancestor)`)
}
mkdirSync(outDir, { recursive: true })
// Only remove files this tool itself writes.
for (const f of readdirSync(outDir)) {
  if (f === 'index.html' || f.endsWith('.png')) rmSync(`${outDir}/${f}`, { force: true })
}

const configFile = fileURLToPath(new URL('../screenshots/vite.config.ts', import.meta.url))
const server = await createServer({
  configFile,
  logLevel: 'error',
  server: { port, strictPort: true },
  define: { 'import.meta.env.VITE_SITE_URL': JSON.stringify(`http://localhost:${port}`) },
})
const shots = []
try {
  await server.listen()
  const origin = `http://localhost:${port}`
  const browser = await chromium.launch({ channel: 'chrome' })
  try {
    // Bug attachments are served from this cache; (re)build it so they never render broken.
    await renderFixtures(browser)
    for (const theme of themes) {
      const context = await browser.newContext({
        viewport: { width: widths[0], height },
        colorScheme: theme,
        reducedMotion: 'reduce',
      })
      await context.addInitScript((t) => localStorage.setItem('squash:theme', t), theme)
      const page = await context.newPage()
      for (const route of routes) {
        for (const width of widths) {
          await page.setViewportSize({ width, height })
          await page.goto(origin + route, { waitUntil: 'networkidle' })
          await page.waitForTimeout(300)
          const file = `${slug(route)}_${width}_${theme}.png`
          await page.screenshot({ path: `${outDir}/${file}`, fullPage: true })
          shots.push({ route, width, theme, file })
          console.log(file)
        }
      }
      await context.close()
    }
  } finally {
    await browser.close()
  }
} finally {
  await server.close()
}

const esc = (s) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`)
const cells = shots
  .map(
    (s) =>
      `<figure><figcaption>${esc(s.route)} &middot; ${s.width} &middot; ${s.theme}</figcaption>` +
      `<a href="${s.file}"><img src="${s.file}" loading="lazy" alt="${esc(s.file)}"></a></figure>`,
  )
  .join('\n')
writeFileSync(
  `${outDir}/index.html`,
  `<!doctype html><meta charset="utf-8"><title>Visual QA</title>
<style>body{font:12px system-ui;margin:16px;background:#888}
main{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-start}
figure{margin:0;background:#fff;padding:6px}img{max-width:360px;max-height:600px;object-fit:contain;object-position:top;display:block}</style>
<main>
${cells}
</main>
`,
)
console.log(`${shots.length} shots -> ${outDir}`)
