// Shared helpers for the brand asset scripts (gen-icons.mjs, gen-og.mjs): design tokens read
// from src/index.css (so no color is duplicated here), the pin mark geometry from the app, the
// self-hosted Plex font files, and a Chrome page for rasterizing.
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PIN_GRID, pinMarkShapes } from '../src/components/ui/pinMark.ts'

export const root = fileURLToPath(new URL('..', import.meta.url))

/** Custom properties declared directly in the `:root` (paper) and `.dark` (darkroom) blocks. */
export function readTokens() {
  const css = readFileSync(join(root, 'src/index.css'), 'utf8')
  const block = (selector) => {
    const start = css.search(new RegExp(`^${selector.replace('.', '\\.')}\\s*\\{`, 'm'))
    if (start < 0) throw new Error(`src/index.css has no ${selector} block`)
    const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('\n}', start))
    const tokens = {}
    for (const [, name, value] of body.matchAll(/--([\w-]+):\s*([^;]+);/g)) tokens[name] = value
    return tokens
  }
  const light = block(':root')
  const dark = block('.dark')
  const need = [
    'bg',
    'surface-1',
    'surface-2',
    'text-1',
    'text-2',
    'text-3',
    'border-1',
    'border-2',
  ]
  for (const [name, set] of [
    ['light', light],
    ['dark', dark],
  ]) {
    for (const key of [...need, 'accent']) {
      if (!/^#[0-9a-f]{6}$/i.test(set[key] ?? '')) {
        throw new Error(`src/index.css ${name} --${key} is not a hex color`)
      }
    }
  }
  return { light, dark, grain: light.grain }
}

/** A standalone pin mark SVG. `pad` is the margin in grid units around the 16-unit artwork. */
export function markSvg({ needle, head, background, pad = 0, radius = 0, size }) {
  const box = PIN_GRID + pad * 2
  const bg = background
    ? `<rect x="${-pad}" y="${-pad}" width="${box}" height="${box}" rx="${radius}" fill="${background}"/>`
    : ''
  const dims = size ? ` width="${size}" height="${size}"` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad} ${box} ${box}"${dims}>${bg}${pinMarkShapes(needle, head)}</svg>`
}

const require = createRequire(import.meta.url)
// Inlined as data URIs: pages are set with setContent (about:blank), which may not load file://.
const fontFile = (pkg, file) => {
  const path = join(dirname(require.resolve(`${pkg}/package.json`)), 'files', file)
  return `data:font/woff2;base64,${readFileSync(path).toString('base64')}`
}

/** @font-face rules for the self-hosted Plex files. */
export function fontFaces() {
  const sans = fontFile(
    '@fontsource-variable/ibm-plex-sans',
    'ibm-plex-sans-latin-wght-normal.woff2',
  )
  const mono = (w) => fontFile('@fontsource/ibm-plex-mono', `ibm-plex-mono-latin-${w}-normal.woff2`)
  return `
@font-face { font-family: 'Plex Sans'; src: url(${sans}) format('woff2'); font-weight: 100 700; }
@font-face { font-family: 'Plex Mono'; src: url(${mono(400)}) format('woff2'); font-weight: 400; }
@font-face { font-family: 'Plex Mono'; src: url(${mono(500)}) format('woff2'); font-weight: 500; }`
}

/** Launches the installed Chrome (as the screenshot tools do) for rasterizing. */
export async function launchBrowser() {
  const { chromium } = await import('playwright-core')
  return chromium.launch({ channel: 'chrome' })
}

/** Renders `html` at exactly width×height CSS px and returns a PNG buffer. */
export async function rasterize(page, html, width, height, { transparent = false } = {}) {
  await page.setViewportSize({ width, height })
  await page.setContent(html, { waitUntil: 'load' })
  await page.evaluate(() => document.fonts.ready)
  return page.screenshot({
    type: 'png',
    omitBackground: transparent,
    clip: { x: 0, y: 0, width, height },
  })
}
