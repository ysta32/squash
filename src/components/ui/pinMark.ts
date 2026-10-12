/**
 * The specimen pin: Squash's logo mark (DESIGN.md section 3, "Logo"). A 6px pin head in the
 * accent with a 45° needle in ink, drawn on a 16px grid at a 1.5 stroke so it stays crisp at
 * favicon size. Plain data with no imports: `LogoMark` renders it in React and
 * `scripts/gen-icons.mjs` / `scripts/gen-og.mjs` render the same geometry into static assets.
 */
export const PIN_GRID = 16
/** The needle runs from the bottom left into the head; its end is hidden under the head. */
export const PIN_NEEDLE = { x1: 3, y1: 13, x2: 8.25, y2: 7.75 }
/** Head centred on whole pixels so its outer edges land on the pixel grid at 16px. */
export const PIN_HEAD = { cx: 10, cy: 6, r: 3 }
export const PIN_STROKE = 1.5

/** SVG markup for the mark's shapes (no outer <svg>), filled with the given paints. */
export function pinMarkShapes(needle: string, head: string): string {
  const n = PIN_NEEDLE
  const h = PIN_HEAD
  return (
    `<path d="M${n.x1} ${n.y1} ${n.x2} ${n.y2}" fill="none" stroke="${needle}" ` +
    `stroke-width="${PIN_STROKE}" stroke-linecap="round"/>` +
    `<circle cx="${h.cx}" cy="${h.cy}" r="${h.r}" fill="${head}"/>`
  )
}

/**
 * The app icon: the same pin, scaled up in white and a glossy mint head, on a viridian squircle
 * like a home-screen app. Fixed brand colors (it does not follow the theme, as app icons don't),
 * drawn on a 100-unit grid. `AppIcon` renders it in React and `scripts/gen-icons.mjs` rasterizes
 * it for the favicon and PWA icons.
 */
export const APP_ICON_GRID = 100

/** A superellipse (n = 5), close to the continuous-corner squircle of iOS app icons. */
function squirclePath(size: number): string {
  const half = size / 2
  const points: string[] = []
  for (let i = 0; i < 128; i++) {
    const t = (i / 128) * 2 * Math.PI
    const c = Math.cos(t)
    const s = Math.sin(t)
    const x = half + half * Math.sign(c) * Math.abs(c) ** 0.4
    const y = half + half * Math.sign(s) * Math.abs(s) ** 0.4
    points.push(`${+x.toFixed(2)} ${+y.toFixed(2)}`)
  }
  return `M${points.join('L')}Z`
}
const SQUIRCLE = squirclePath(APP_ICON_GRID)

/**
 * SVG markup for the app icon (no outer <svg>). `id` prefixes the gradient and filter ids, which
 * must be unique per document. `bleed` fills the whole square instead of the squircle, for
 * platforms that round the corners themselves (iOS, maskable PWA icons).
 */
export function appIconShapes(id: string, { bleed = false } = {}): string {
  const shape = bleed
    ? `<rect width="${APP_ICON_GRID}" height="${APP_ICON_GRID}"`
    : `<path d="${SQUIRCLE}"`
  const n = PIN_NEEDLE
  const h = PIN_HEAD
  return (
    `<defs>` +
    `<linearGradient id="${id}-bg" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#1f9e7f"/><stop offset=".55" stop-color="#0d6b57"/>` +
    `<stop offset="1" stop-color="#074537"/></linearGradient>` +
    `<linearGradient id="${id}-sheen" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#fff" stop-opacity=".22"/>` +
    `<stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient>` +
    `<radialGradient id="${id}-head" cx=".36" cy=".32" r=".75">` +
    `<stop offset="0" stop-color="#f0fff9"/><stop offset=".4" stop-color="#8ce6cb"/>` +
    `<stop offset="1" stop-color="#2aa785"/></radialGradient>` +
    `<filter id="${id}-shadow" x="-30%" y="-30%" width="160%" height="160%">` +
    `<feDropShadow dx="0" dy=".6" stdDeviation=".6" flood-color="#02251d" flood-opacity=".5"/>` +
    `</filter></defs>` +
    `${shape} fill="url(#${id}-bg)"/>` +
    `${shape} fill="url(#${id}-sheen)"/>` +
    // Centre the 16-unit pin (its artwork spans 3–13) on the tile at 4.5×.
    `<g transform="translate(14 14) scale(4.5)" filter="url(#${id}-shadow)">` +
    `<path d="M${n.x1} ${n.y1} ${n.x2} ${n.y2}" fill="none" stroke="#fff" ` +
    `stroke-width="${PIN_STROKE}" stroke-linecap="round"/>` +
    `<circle cx="${h.cx}" cy="${h.cy}" r="${h.r}" fill="url(#${id}-head)"/>` +
    `<circle cx="${h.cx - 0.95}" cy="${h.cy - 1}" r=".7" fill="#fff" fill-opacity=".75"/>` +
    `</g>`
  )
}

/** A standalone app icon SVG document. */
export function appIconSvg({ bleed = false, size }: { bleed?: boolean; size?: number } = {}) {
  const dims = size ? ` width="${size}" height="${size}"` : ''
  const box = APP_ICON_GRID
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${box} ${box}"${dims}>${appIconShapes('squash', { bleed })}</svg>`
}
