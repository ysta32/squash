// Avatar initials are white, so every avatar background must reach WCAG AA (4.5:1) against white.

/**
 * The curated avatar palette: eight warm, earthy inks that mirror the Specimen tokens (accent,
 * success, severity, danger, the Rust and Madder schemes, text-2). No blue or purple. Each one
 * clears 4.5:1 against white initials (see avatarColor.test.ts).
 */
export const AVATAR_PALETTE = [
  { name: 'Viridian', value: '#0d6b57', dark: '#10846b' },
  { name: 'Moss', value: '#2e772a', dark: '#33842f' },
  { name: 'Ochre', value: '#826400', dark: '#917000' },
  { name: 'Rust', value: '#b4470f', dark: '#c74e11' },
  { name: 'Vermilion', value: '#b42318', dark: '#df2b1e' },
  { name: 'Madder', value: '#b4235a', dark: '#d73170' },
  { name: 'Umber', value: '#7a4a2a', dark: '#a66439' },
  { name: 'Graphite', value: '#57534b', dark: '#787267' },
] as const

/**
 * `dark` is the same ink lifted in lightness for the darkroom theme, where the light-mode inks
 * sink into the near-black page. Each still clears 4.5:1 against white initials and stands at
 * least 3:1 off the dark page (see avatarColor.test.ts).
 */

/** Colors offered in profile settings. */
export const AVATAR_COLORS = AVATAR_PALETTE.map((entry) => entry.value)

export const AVATAR_MIN_CONTRAST = 4.5

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/

type Rgb = [number, number, number]

function parseHex(hex: string): Rgb | null {
  if (!HEX_COLOR.test(hex)) return null
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb
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

/** HSL hue (degrees) and saturation (0-1) of a color. */
function hueSat([r, g, b]: Rgb): { hue: number; sat: number } {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255]
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const d = max - min
  if (d === 0) return { hue: 0, sat: 0 }
  const light = (max + min) / 2
  const sat = d / (1 - Math.abs(2 * light - 1))
  const h = max === rn ? ((gn - bn) / d) % 6 : max === gn ? (bn - rn) / d + 2 : (rn - gn) / d + 4
  return { hue: (h * 60 + 360) % 360, sat }
}

const GRAPHITE = AVATAR_PALETTE[AVATAR_PALETTE.length - 1].value
/** Below this saturation a stored color reads as grey and maps to Graphite. */
const GREY_SATURATION = 0.12
const CHROMATIC = AVATAR_PALETTE.filter((entry) => entry.value !== GRAPHITE).map((entry) => ({
  value: entry.value,
  hue: hueSat(parseHex(entry.value) as Rgb).hue,
}))

/**
 * The background to render behind white initials, always taken from the curated palette.
 * Palette colors are kept. Anything else (colors picked before the palette changed, or the
 * lighter shades the signup trigger assigns) maps to the palette color with the nearest hue,
 * so a red stays red and a stored blue or purple lands on the closest warm ink. Greys map to
 * Graphite; invalid values fall back to the first palette color.
 */
export function avatarPaletteColor(color: string): string {
  const rgb = parseHex(color)
  if (!rgb) return AVATAR_PALETTE[0].value
  const lower = color.toLowerCase()
  if ((AVATAR_COLORS as readonly string[]).includes(lower)) return lower
  const { hue, sat } = hueSat(rgb)
  if (sat < GREY_SATURATION) return GRAPHITE
  let best = CHROMATIC[0]
  let bestDistance = Infinity
  for (const entry of CHROMATIC) {
    const raw = Math.abs(entry.hue - hue)
    const distance = Math.min(raw, 360 - raw)
    if (distance < bestDistance) {
      best = entry
      bestDistance = distance
    }
  }
  return best.value
}

/** The darkroom variant of a palette color (pass the result of avatarPaletteColor). */
export function avatarDarkColor(paletteColor: string): string {
  const lower = paletteColor.toLowerCase()
  return AVATAR_PALETTE.find((entry) => entry.value === lower)?.dark ?? AVATAR_PALETTE[0].dark
}
