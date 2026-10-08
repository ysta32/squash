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
