// Avatar initials are white, so every avatar background must reach WCAG AA (4.5:1) against white.

/** Colors offered in profile settings. Each one clears 4.5:1 against white (see avatarColor.test.ts). */
export const AVATAR_COLORS = [
  '#b91c1c',
  '#c2410c',
  '#b45309',
  '#047857',
  '#0e7490',
  '#2563eb',
  '#7c3aed',
  '#be185d',
  '#4f46e5',
  '#0f766e',
] as const

export const AVATAR_MIN_CONTRAST = 4.5

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/
const WHITE: Rgb = [255, 255, 255]

type Rgb = [number, number, number]

function parseHex(hex: string): Rgb | null {
  if (!HEX_COLOR.test(hex)) return null
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb
}

function toHex(rgb: Rgb): string {
  return `#${rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

function luminance([r, g, b]: Rgb): number {
  const [lr, lg, lb] = [r, g, b].map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb
}

function ratio(a: Rgb, b: Rgb): number {
  const la = luminance(a)
  const lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/** WCAG 2 contrast ratio between two #rrggbb colors, or NaN if either is not a 6-digit hex. */
export function contrastRatio(a: string, b: string): number {
  const ra = parseHex(a)
  const rb = parseHex(b)
  return ra && rb ? ratio(ra, rb) : NaN
}

/**
 * The background to render behind white initials. Stored colors predate the accessible palette
 * (and the signup trigger still assigns lighter shades), so any color under 4.5:1 is darkened
 * toward black, which keeps its hue, until it clears the threshold. Invalid values fall back to
 * the first palette entry.
 */
export function readableAvatarColor(color: string): string {
  const rgb = parseHex(color)
  if (!rgb) return AVATAR_COLORS[0]
  if (ratio(rgb, WHITE) >= AVATAR_MIN_CONTRAST) return color
  for (let scale = 99; scale >= 0; scale--) {
    const darker = rgb.map((v) => Math.round((v * scale) / 100)) as Rgb
    if (ratio(darker, WHITE) >= AVATAR_MIN_CONTRAST) return toHex(darker)
  }
  return '#000000'
}
