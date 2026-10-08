// Visual-QA screenshot tool: captures routes at several widths in light and dark against the
// mocked backend (scripts/screenshots/vite.config.ts) and writes PNGs plus an index.html sheet.
//
// Run it through the e2e serializer (the machine is CPU-saturated):
//   ~/.claude/orch/bin/serial e2e -- npm run qa:shots -- --out .orch/shots/latest
//   node scripts/visual-qa/run.mjs --out <dir> [--routes /,/claude] [--states palette,toast]
//     [--widths 375,1280] [--themes light]
// Routes: `/path` (signed in), `public:/path` (signed out), `state:<name>` (scripted UI state, see STATES).
// Without --routes/--states the default routes and every state are shot.
// Env: QA_PORT (default 4210). Uses your installed Google Chrome.
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { createServer } from 'vite'
import { fixturesDir, renderFixtures } from '../screenshots/render-fixtures.mjs'

const DEFAULT_ROUTES = [
  'public:/',
  'public:/signin',
  'public:/no-such-page',
  'public:/privacy',
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

const WS = '/app/ws-lumen'
const SAMPLE_DESCRIPTION = 'Checkout button is hidden behind the cookie banner on iPhone'
const SHORT = 15_000

/**
 * Scripted states. `path` is loaded first (with optional mock `delayBugs` ms), then `run` interacts
 * until the state is visible. `run` may return a cleanup. A state whose UI never appears
 * (timeout) is logged as a warning and skipped, never failing the run.
 */
const searchbox = (page) => page.getByRole('searchbox', { name: /^Search/ })
const settingsState = (tab) => ({
  path: `${WS}/settings?tab=${tab}`,
  run: (page) =>
    page
      .getByRole('navigation', { name: 'Settings tabs' })
      .getByRole('button', { name: tab, exact: true })
      .and(page.locator('[aria-current="page"]'))
      .waitFor({ timeout: SHORT }),
})
const STATES = {
  palette: {
    path: WS,
    run: async (page) => {
      await searchbox(page).waitFor({ timeout: SHORT })
      await page.keyboard.press('ControlOrMeta+k')
      await page.getByRole('dialog', { name: 'Command palette' }).waitFor({ timeout: SHORT })
    },
  },
  shortcuts: {
    path: WS,
    run: async (page) => {
      await searchbox(page).waitFor({ timeout: SHORT })
      await page.keyboard.press('?')
      await page.getByRole('dialog').waitFor({ timeout: SHORT })
    },
  },
  invite: {
    path: WS,
    run: async (page) => {
      await page.getByRole('button', { name: 'Invite', exact: true }).click({ timeout: SHORT })
      await page.getByRole('dialog', { name: 'Invite people' }).waitFor({ timeout: SHORT })
    },
  },
  'capture-focused': {
    path: WS,
    run: async (page) => {
      const box = page.getByRole('textbox', { name: /^Describe the/ })
      await box.click({ timeout: SHORT })
      await box.fill(SAMPLE_DESCRIPTION)
      await box.waitFor({ state: 'visible' })
    },
  },
  'filter-empty': {
    path: WS,
    run: async (page) => {
      await searchbox(page).fill('zzz-no-such-bug')
      await page.getByText('No matches', { exact: true }).waitFor({ timeout: SHORT })
    },
  },
  'filter-popover': {
    path: WS,
    run: async (page) => {
      await page.getByRole('button', { name: /^Filter(,|$)/ }).click({ timeout: SHORT })
      await page.getByRole('dialog', { name: 'Filters' }).waitFor({ timeout: SHORT })
    },
  },
  'list-actions': {
    path: WS,
    run: async (page) => {
      await page.getByRole('button', { name: 'List actions' }).click({ timeout: SHORT })
      await page.getByRole('menu', { name: 'List actions' }).waitFor({ timeout: SHORT })
    },
  },
  'empty-workspace': {
    path: '/app/ws-side',
    run: (page) => page.getByRole('textbox', { name: /^Describe the/ }).waitFor({ timeout: SHORT }),
  },
  loading: {
    path: WS,
    delayBugs: 120_000,
    waitUntil: 'domcontentloaded',
    run: (page) => page.getByRole('status', { name: 'Loading bugs' }).waitFor({ timeout: SHORT }),
  },
  offline: {
    path: WS,
    run: async (page, context) => {
      await searchbox(page).waitFor({ timeout: SHORT })
      await context.setOffline(true)
      await page.getByRole('status').filter({ hasText: 'Offline' }).waitFor({ timeout: SHORT })
      return () => context.setOffline(false)
    },
  },
  lightbox: {
    path: `${WS}/bug/24`,
    run: async (page) => {
      await page.getByRole('button', { name: 'Open screenshot 1' }).click({ timeout: SHORT })
      const dialog = page.getByRole('dialog', { name: 'Screenshot viewer' })
      await dialog.waitFor({ timeout: SHORT })
      await dialog
        .locator('img')
        .first()
        .evaluate((img) =>
          Promise.race([img.decode(), new Promise((resolve) => setTimeout(resolve, 5_000))]),
        )
    },
  },
  // The bug detail scrolls inside its own pane, so a full-page shot never reaches the Claude panel,
  // timeline and comments; this scrolls that pane to the end first.
  'detail-timeline': {
    path: `${WS}/bug/24`,
    run: async (page) => {
      const timeline = page.getByRole('list', { name: 'Timeline', exact: true })
      await timeline.waitFor({ timeout: SHORT })
      await page
        .locator('article')
        .first()
        .evaluate((article) => {
          for (let el = article.parentElement; el; el = el.parentElement) el.scrollTop = 1e6
          window.scrollTo(0, document.documentElement.scrollHeight)
        })
    },
  },
  'resolve-popover': {
    path: `${WS}/bug/24`,
    run: async (page) => {
      await page.getByRole('button', { name: 'Resolve', exact: true }).click({ timeout: SHORT })
      await page.getByRole('textbox', { name: 'Note', exact: true }).waitFor({ timeout: SHORT })
    },
  },
  'detail-menu': {
    path: `${WS}/bug/24`,
    run: async (page) => {
      await page.getByRole('button', { name: 'More actions' }).click({ timeout: SHORT })
      await page.getByRole('menu', { name: 'More actions' }).waitFor({ timeout: SHORT })
    },
  },
  toast: {
    path: `${WS}/bug/24`,
    run: async (page) => {
      // Resolving shows no toast; deleting does (the mock only changes in this page).
      // Delete lives in the detail's … menu.
      await page.getByRole('button', { name: 'More actions' }).click({ timeout: SHORT })
      await page
        .getByRole('menuitem', { name: 'Delete bug', exact: true })
        .click({ timeout: SHORT })
      await page
        .getByRole('dialog')
        .getByRole('button', { name: 'Delete bug', exact: true })
        .click({ timeout: SHORT })
      await page.getByRole('button', { name: 'Dismiss notification' }).waitFor({ timeout: SHORT })
    },
  },
  'toast-action': {
    path: `${WS}/bug/24`,
    run: async (page) => {
      await page.getByText('#24').first().waitFor({ timeout: SHORT })
      await page.keyboard.press('i')
      await page.getByRole('button', { name: 'Undo', exact: true }).waitFor({ timeout: SHORT })
    },
  },
  'claude-setup': {
    path: WS,
    run: async (page) => {
      await searchbox(page).waitFor({ timeout: SHORT })
      await page.keyboard.press('ControlOrMeta+k')
      await page.keyboard.type('Set up Claude Code')
      await page.keyboard.press('Enter')
      await page.getByRole('dialog', { name: 'Connect Claude Code' }).waitFor({ timeout: SHORT })
    },
  },
  'invite-regenerate': {
    path: WS,
    run: async (page) => {
      await page.getByRole('button', { name: 'Invite', exact: true }).click({ timeout: SHORT })
      const dialog = page.getByRole('dialog', { name: 'Invite people' })
      await dialog.getByRole('button', { name: 'Regenerate' }).click({ timeout: SHORT })
      await dialog.getByRole('button', { name: 'Yes, regenerate' }).waitFor({ timeout: SHORT })
    },
  },
  'capture-staged': {
    path: WS,
    run: async (page) => {
      const box = page.getByRole('textbox', { name: /^Describe the/ })
      await box.click({ timeout: SHORT })
      await box.fill(`${SAMPLE_DESCRIPTION} on https://shop.example.com/checkout`)
      await page.getByTestId('file-input').setInputFiles(`${fixturesDir}checkout-desktop.png`)
      await page.getByRole('button', { name: /^Mark up/ }).waitFor({ timeout: SHORT })
    },
  },
  'settings-profile': settingsState('profile'),
  'settings-appearance': settingsState('appearance'),
  'settings-workspace': settingsState('workspace'),
  'settings-account': settingsState('account'),
}

const requested = list('routes', null)
const stateNames = [
  ...(requested ?? []).filter((r) => r.startsWith('state:')).map((r) => r.slice(6)),
  ...list('states', []),
]
const everything = requested === null && opt('states') === undefined
const routes = (requested ?? (everything ? DEFAULT_ROUTES : [])).filter(
  (r) => !r.startsWith('state:'),
)
if (everything) stateNames.push(...Object.keys(STATES))
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

const slug = (route) => {
  const isPublic = route.startsWith('public:')
  const path = isPublic ? route.slice(7) : route
  const base = path === '/' ? 'home' : path.replace(/^\/|\/$/g, '').replace(/\W+/g, '-')
  return isPublic ? `public-${base}` : base
}

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
      // A fresh page per shot, so mock flags (signed out, delayed fetch) never leak between shots.
      const open = async (width, { signedOut = false, delayBugs = 0 } = {}) => {
        const page = await context.newPage()
        await page.addInitScript(
          ([out, delay]) => {
            const set = (key, on, value) =>
              on ? localStorage.setItem(key, value) : localStorage.removeItem(key)
            set('squash:demo-signed-out', out, '1')
            set('squash:demo-delay-bugs', delay > 0, String(delay))
          },
          [signedOut, delayBugs],
        )
        await page.setViewportSize({ width, height })
        return page
      }
      for (const route of routes) {
        const signedOut = route.startsWith('public:')
        const path = signedOut ? route.slice(7) : route
        for (const width of widths) {
          const page = await open(width, { signedOut })
          await page.goto(origin + path, { waitUntil: 'networkidle' })
          await page.waitForTimeout(300)
          const file = `${slug(route)}_${width}_${theme}.png`
          await page.screenshot({ path: `${outDir}/${file}`, fullPage: true })
          shots.push({ group: route, width, theme, file })
          console.log(file)
          await page.close()
        }
      }
      for (const name of stateNames) {
        const state = STATES[name]
        if (!state) {
          console.warn(`WARN state:${name} is unknown; skipped`)
          continue
        }
        for (const width of widths) {
          const page = await open(width, { delayBugs: state.delayBugs })
          let cleanup
          try {
            await page.goto(origin + state.path, { waitUntil: state.waitUntil ?? 'networkidle' })
            cleanup = await state.run(page, context)
            await page.waitForTimeout(300)
            const file = `state-${name}_${width}_${theme}.png`
            await page.screenshot({ path: `${outDir}/${file}` })
            shots.push({ group: `state:${name}`, width, theme, file })
            console.log(file)
          } catch (err) {
            const why = err instanceof Error ? err.message.split('\n')[0] : String(err)
            console.warn(`WARN state:${name} @${width} ${theme} skipped: ${why}`)
          } finally {
            await cleanup?.()
            // Always restore the shared context, even if a state failed before returning its cleanup.
            await context.setOffline(false)
            await page.close()
          }
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
const groups = new Map()
for (const s of shots) groups.set(s.group, [...(groups.get(s.group) ?? []), s])
const cells = [...groups]
  .map(
    ([group, items]) =>
      `<section><h2>${esc(group)}</h2><div class="row">` +
      items
        .map(
          (s) =>
            `<figure><figcaption>${s.width} &middot; ${s.theme}</figcaption>` +
            `<a href="${s.file}"><img src="${s.file}" loading="lazy" alt="${esc(s.file)}"></a></figure>`,
        )
        .join('\n') +
      '</div></section>',
  )
  .join('\n')
writeFileSync(
  `${outDir}/index.html`,
  `<!doctype html><meta charset="utf-8"><title>Visual QA</title>
<style>body{font:12px system-ui;margin:16px;background:#888}
h2{margin:16px 0 6px;font:600 14px system-ui}
.row{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-start}
figure{margin:0;background:#fff;padding:6px}img{max-width:360px;max-height:600px;object-fit:contain;object-position:top;display:block}</style>
<main>
${cells}
</main>
`,
)
console.log(`${shots.length} shots -> ${outDir}`)
