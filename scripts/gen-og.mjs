// Renders the social cards (1200×630 PNG, DESIGN.md section 6) for every page in OG_PAGES
// (vite-plugin-seo.ts) with the self-hosted Plex fonts and the paper tokens from src/index.css:
//   public/og.png              home
//   public/og/<slug>.png       every other public page
//   public/og/press-dark.png   darkroom variant for the press kit
//   public/brand/*             press-kit logo files (mark SVGs, logo PNGs, light and dark)
// Run `npm run gen:og` (uses the installed Google Chrome) after changing copy, tokens or the
// mark; outputs are committed. Re-run when CHANGELOG.md gets a new release (the changelog card
// carries the latest version).
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { OG_PAGES, ogImagePath } from '../vite-plugin-seo.ts'
import { fontFaces, launchBrowser, markSvg, rasterize, readTokens, root } from './brand.mjs'

const WIDTH = 1200
const HEIGHT = 630
const tokens = readTokens()
const faces = fontFaces()

const esc = (s) =>
  String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

// The changelog card names the latest release ("## v1.7.0 — 2026-10-07").
const changelog = await readFile(path.join(root, 'CHANGELOG.md'), 'utf8')
const release = changelog.match(/^## (v\d+\.\d+\.\d+) — (\d{4}-\d{2}-\d{2})$/m)
if (!release) throw new Error('CHANGELOG.md has no "## vX.Y.Z — YYYY-MM-DD" release heading')

const labelFor = (page) =>
  page.slug === 'changelog' ? `${page.label} · ${release[1]} · ${release[2]}` : page.label

const segments = (label) =>
  label
    .split(' · ')
    .map((part) => `<span>${esc(part)}</span>`)
    .join('<i aria-hidden="true">·</i>')

const ticks = (n, color) =>
  `<span class="ticks">${Array.from({ length: 4 }, (_, i) => `<b style="background:${i < n ? color : 'var(--border-2)'}"></b>`).join('')}</span>`

// Real demo-seeded bug (scripts/screenshots/seed.ts), set as a pinned specimen: the home card's
// product visual. Built from tokens so it never drifts from the UI's palette.
const specimenCard = (t) => `
  <div class="card">
    <div class="pin">${markSvg({ needle: t['text-1'], head: t.accent, size: 56 })}</div>
    <div class="card-label">${ticks(4, t['sev-critical'])}${segments('No. 024 · Bug · Critical')}</div>
    <div class="card-title">Checkout button hidden behind cookie banner on iPhone</div>
    <div class="card-rule"></div>
    <div class="card-detail">${segments('Coll. J. Ellis · /checkout · iPhone 390×844')}</div>
  </div>`

const chapters = `
  <ol class="chapters">
    <li><span>01</span>Capture</li>
    <li><span>02</span>Mark up</li>
    <li><span>03</span>Fix with Claude Code</li>
  </ol>`

function card(page, t) {
  const visual = page.slug === 'home' ? specimenCard(t) : page.slug === 'features' ? chapters : ''
  return `<!doctype html><html><head><meta charset="utf-8"><style>
${faces}
:root { ${Object.entries(t)
    .map(([k, v]) => `--${k}: ${v};`)
    .join(' ')} }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: ${WIDTH}px; height: ${HEIGHT}px; overflow: hidden; }
body {
  position: relative; color: var(--text-1); font-family: 'Plex Sans';
  background-color: var(--bg);
  background-image: radial-gradient(120% 90% at 0% 0%, var(--surface-1) 0%, transparent 65%), var(--grain);
  -webkit-font-smoothing: antialiased;
}
.label, .card-label, .card-detail, .facts, .chapters span {
  font-family: 'Plex Mono'; text-transform: uppercase; letter-spacing: 0.06em;
  font-variant-numeric: tabular-nums;
}
.label i, .card-label i, .card-detail i, .facts i { font-style: normal; color: var(--text-3); padding: 0 0.6ch; }
.label {
  position: absolute; left: 72px; top: 72px; display: inline-flex; align-items: center;
  font-size: 20px; line-height: 28px; color: var(--text-2);
  border: 1.5px solid var(--border-2); border-radius: 3px; background: var(--surface-1); padding: 8px 14px;
}
.title {
  position: absolute; left: 72px; top: 176px; width: ${visual ? 560 : 1000}px;
  font-weight: 600; font-size: 64px; line-height: 68px; letter-spacing: -0.03em; text-wrap: balance;
}
.desc { margin-top: 24px; font-weight: 400; font-size: 26px; line-height: 36px; letter-spacing: 0; color: var(--text-2); max-width: 820px; text-wrap: pretty; }
.foot {
  position: absolute; left: 72px; right: 72px; bottom: 64px; height: 56px;
  display: flex; align-items: flex-end; justify-content: space-between;
  border-top: 1.5px solid var(--border-1); padding-top: 20px;
}
.facts { font-size: 17px; line-height: 24px; color: var(--text-3); }
.logo { display: flex; align-items: center; gap: 12px; font-weight: 600; font-size: 38px; line-height: 1; letter-spacing: -0.02em; }
.logo svg { width: 40px; height: 40px; }
.card {
  position: absolute; left: 676px; top: 156px; width: 452px; padding: 28px 28px 24px;
  background: var(--surface-2); border: 1.5px solid var(--border-2); border-radius: 8px;
  box-shadow: var(--elev-3);
}
.pin { position: absolute; left: -26px; top: -30px; }
.pin svg { display: block; }
.card-label { display: flex; align-items: center; font-size: 15px; line-height: 20px; color: var(--text-2); }
.ticks { display: inline-flex; gap: 3px; margin-right: 12px; }
.ticks b { display: block; width: 3px; height: 13px; border-radius: 1px; }
.card-title { margin-top: 16px; font-weight: 600; font-size: 30px; line-height: 38px; letter-spacing: -0.015em; }
.card-rule { height: 1.5px; background: var(--border-1); margin: 22px -28px 14px; }
.card-detail { font-size: 14px; line-height: 20px; color: var(--text-3); }
.chapters { position: absolute; left: 720px; top: 176px; width: 408px; list-style: none; border-top: 1.5px solid var(--border-2); }
.chapters li { display: flex; align-items: baseline; gap: 20px; padding: 22px 0; border-bottom: 1.5px solid var(--border-1); font-size: 30px; line-height: 36px; font-weight: 500; letter-spacing: -0.01em; }
.chapters span { font-size: 18px; color: var(--accent); letter-spacing: 0.06em; }
</style></head><body>
  <div class="label">${segments(labelFor(page))}</div>
  <h1 class="title">${esc(page.title)}${page.description ? `<p class="desc">${esc(page.description)}</p>` : ''}</h1>
  ${visual}
  <div class="foot">
    <span class="facts">${segments('MIT · Self-host on Supabase · No tracking')}</span>
    <span class="logo">${markSvg({ needle: t['text-1'], head: t.accent })}squash</span>
  </div>
</body></html>`
}

// Press-kit logo files: lockups as PNG (fonts rendered here), the mark as SVG.
const logoLockup = (t, transparent) => `<!doctype html><html><head><style>${faces}
* { margin: 0; } html, body { width: 960px; height: 320px; }
body { display: flex; align-items: center; justify-content: center; ${transparent ? '' : `background: ${t.bg};`} }
.logo { display: flex; align-items: center; gap: 30px; color: ${t['text-1']}; font-family: 'Plex Sans'; font-weight: 600; font-size: 120px; line-height: 1; letter-spacing: -0.02em; -webkit-font-smoothing: antialiased; }
.logo svg { width: 128px; height: 128px; }
</style></head><body><span class="logo">${markSvg({ needle: t['text-1'], head: t.accent })}squash</span></body></html>`

const pub = (...parts) => path.join(root, 'public', ...parts)
await mkdir(pub('og'), { recursive: true })
await mkdir(pub('brand'), { recursive: true })

const browser = await launchBrowser()
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 })
  const light = { ...tokens.light, grain: tokens.grain }
  // The darkroom grain is the paper grain, much fainter on near-black.
  const dark = { ...tokens.light, ...tokens.dark, grain: tokens.grain }
  for (const og of OG_PAGES) {
    const png = await rasterize(page, card(og, light), WIDTH, HEIGHT)
    await writeFile(pub(ogImagePath(og)), png)
  }
  const press = OG_PAGES.find((og) => og.slug === 'press')
  await writeFile(
    pub('og', 'press-dark.png'),
    await rasterize(page, card(press, dark), WIDTH, HEIGHT),
  )

  const hiDpi = await browser.newPage({ deviceScaleFactor: 2 })
  for (const [name, t] of [
    ['light', light],
    ['dark', dark],
  ]) {
    await writeFile(
      pub('brand', `squash-logo-${name}.png`),
      await rasterize(hiDpi, logoLockup(t, false), 960, 320),
    )
    await writeFile(
      pub('brand', `squash-logo-${name}-transparent.png`),
      await rasterize(hiDpi, logoLockup(t, true), 960, 320, { transparent: true }),
    )
    await writeFile(
      pub('brand', `squash-mark-${name}.svg`),
      `${markSvg({ needle: t['text-1'], head: t.accent })}\n`,
    )
  }
} finally {
  await browser.close()
}
console.log(`Generated ${OG_PAGES.length + 1} social cards and the press-kit logo files`)
