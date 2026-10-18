/**
 * The beetle: Squash's logo mark (DESIGN.md section 3, "Logo"). A beetle seen from above, with a
 * check cut out of its shell: a bug, squashed. One flat color on a 24-unit grid, strokes at 1.6
 * so it stays readable at favicon size. Plain data with no imports: `LogoMark` and `AppIcon`
 * render it in React, and `scripts/gen-icons.mjs` / `scripts/gen-og.mjs` render the same geometry
 * into static assets.
 */
export const MARK_GRID = 24
export const MARK_STROKE = 1.6
/** Antennae, then three legs a side (one subpath each). */
export const MARK_LIMBS =
  'M10.4 5.2 8.6 2.8M13.6 5.2 15.4 2.8' +
  'M6.4 10.4 3.8 8.8M5.8 14 3 14M6.4 17.6 3.8 19.2' +
  'M17.6 10.4 20.2 8.8M18.2 14 21 14M17.6 17.6 20.2 19.2'
export const MARK_HEAD = { cx: 12, cy: 6.6, r: 2.6 }
export const MARK_BODY = { cx: 12, cy: 14.4, rx: 6.2, ry: 7 }
/** The check cut out of the shell, as a stroke of this width. */
export const MARK_CHECK = 'M8.6 14.2 11 16.6 15.6 11.6'
export const MARK_CHECK_STROKE = 1.9

/**
 * SVG markup for the mark's shapes (no outer <svg>) in one paint. `id` names the mask that cuts
 * the check out (so it shows whatever is behind the mark); it must be unique per document.
 */
export function markShapes(paint: string, id = 'squash-mark'): string {
  const h = MARK_HEAD
  const b = MARK_BODY
  return (
    `<mask id="${id}-cut" maskUnits="userSpaceOnUse" x="0" y="0" width="${MARK_GRID}" height="${MARK_GRID}">` +
    `<rect width="${MARK_GRID}" height="${MARK_GRID}" fill="#fff"/>` +
    `<path d="${MARK_CHECK}" fill="none" stroke="#000" stroke-width="${MARK_CHECK_STROKE}" ` +
    `stroke-linecap="round" stroke-linejoin="round"/></mask>` +
    `<path d="${MARK_LIMBS}" fill="none" stroke="${paint}" stroke-width="${MARK_STROKE}" ` +
    `stroke-linecap="round"/>` +
    `<circle cx="${h.cx}" cy="${h.cy}" r="${h.r}" fill="${paint}"/>` +
    `<ellipse cx="${b.cx}" cy="${b.cy}" rx="${b.rx}" ry="${b.ry}" fill="${paint}" mask="url(#${id}-cut)"/>`
  )
}

/**
 * The app icon: the beetle in white on a flat marker-red tile with continuous corners, like a
 * home-screen app. Fixed brand colors (it does not follow the theme, as app icons don't), drawn
 * on a 100-unit grid. `AppIcon` renders it in React and `scripts/gen-icons.mjs` rasterizes it for
 * the favicon and PWA icons.
 */
export const APP_ICON_GRID = 100
export const APP_ICON_TILE = '#c92a14'
export const APP_ICON_INK = '#ffffff'

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
 * SVG markup for the app icon (no outer <svg>). `id` prefixes the mask id, which must be unique
 * per document. `bleed` fills the whole square instead of the squircle, for platforms that round
 * the corners themselves (iOS, maskable PWA icons).
 */
export function appIconShapes(id: string, { bleed = false } = {}): string {
  const tile = bleed
    ? `<rect width="${APP_ICON_GRID}" height="${APP_ICON_GRID}" fill="${APP_ICON_TILE}"/>`
    : `<path d="${SQUIRCLE}" fill="${APP_ICON_TILE}"/>`
  // The beetle spans 3–21 × 2–22 of its grid: centred on the tile at 3×.
  return `${tile}<g transform="translate(14 13) scale(3)">${markShapes(APP_ICON_INK, id)}</g>`
}

/** A standalone app icon SVG document. */
export function appIconSvg({ bleed = false, size }: { bleed?: boolean; size?: number } = {}) {
  const dims = size ? ` width="${size}" height="${size}"` : ''
  const box = APP_ICON_GRID
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${box} ${box}"${dims}>${appIconShapes('squash', { bleed })}</svg>`
}
