import { describe, expect, it } from 'vitest'
import {
  AVATAR_COLORS,
  AVATAR_MIN_CONTRAST,
  AVATAR_PALETTE,
  avatarDarkColor,
  avatarPaletteColor,
  contrastRatio,
} from './avatarColor'

describe('contrastRatio', () => {
  it('matches known WCAG ratios', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5)
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5)
    expect(contrastRatio('#0891b2', '#ffffff')).toBeCloseTo(3.68, 2)
  })

  it('returns NaN for non-hex input', () => {
    expect(contrastRatio('red', '#ffffff')).toBeNaN()
  })
})

describe('AVATAR_COLORS', () => {
  it.each(AVATAR_COLORS)('%s reaches 4.5:1 against white initials', (color) => {
    expect(contrastRatio(color, '#ffffff')).toBeGreaterThanOrEqual(AVATAR_MIN_CONTRAST)
  })

  it('has no duplicates', () => {
    expect(new Set(AVATAR_COLORS).size).toBe(AVATAR_COLORS.length)
  })

  it('is a curated set of 8 with no blue or purple hues', () => {
    expect(AVATAR_COLORS).toHaveLength(8)
    expect(new Set(AVATAR_PALETTE.map((entry) => entry.name)).size).toBe(8)
    for (const color of AVATAR_COLORS) {
      const h = hue(color)
      expect(h < 190 || h > 300, `${color} hue ${h}`).toBe(true)
    }
  })
})

// HSL hue in degrees; 0 for grays.
function hue(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const max = Math.max(r, g, b)
  const d = max - Math.min(r, g, b)
  if (d === 0) return 0
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return (h * 60 + 360) % 360
}

describe('darkroom avatar inks', () => {
  const DARK_PAGE = '#141412'
  it.each(AVATAR_PALETTE.map((entry) => [entry.name, entry.value, entry.dark]))(
    '%s lifts for dark mode and keeps white initials at 4.5:1',
    (_name, light, dark) => {
      expect(contrastRatio(dark, '#ffffff')).toBeGreaterThanOrEqual(AVATAR_MIN_CONTRAST)
      // Stands off the darkroom page better than the light ink, at least 3:1 (non-text contrast).
      expect(contrastRatio(dark, DARK_PAGE)).toBeGreaterThan(contrastRatio(light, DARK_PAGE))
      expect(contrastRatio(dark, DARK_PAGE)).toBeGreaterThanOrEqual(3)
      expect(avatarDarkColor(light)).toBe(dark)
      expect(avatarDarkColor(light.toUpperCase())).toBe(dark)
    },
  )

  it('falls back to the first ink for an unknown color', () => {
    expect(avatarDarkColor('#123456')).toBe(AVATAR_PALETTE[0].dark)
  })
})

describe('avatarPaletteColor', () => {
  it('keeps palette colors, in any case', () => {
    for (const color of AVATAR_COLORS) {
      expect(avatarPaletteColor(color)).toBe(color)
      expect(avatarPaletteColor(color.toUpperCase())).toBe(color)
    }
  })

  it.each(['#0891b2', '#6366f1', '#7c3aed', '#2563eb', '#f59e0b', '#84cc16', '#ff0000'])(
    'maps %s onto the palette color with the nearest hue, which passes 4.5:1',
    (color) => {
      const result = avatarPaletteColor(color)
      expect(AVATAR_COLORS).toContain(result)
      expect(contrastRatio(result, '#ffffff')).toBeGreaterThanOrEqual(AVATAR_MIN_CONTRAST)
      const distance = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b))
      const nearest = Math.min(
        ...AVATAR_COLORS.filter((c) => c !== '#57534b').map((c) => distance(hue(c), hue(color))),
      )
      expect(distance(hue(result), hue(color))).toBe(nearest)
    },
  )

  it('keeps reds red and moves blues and purples onto warm inks', () => {
    expect(avatarPaletteColor('#ef4444')).toBe('#b42318')
    expect(avatarPaletteColor('#7c3aed')).toBe('#b4235a')
    expect(avatarPaletteColor('#2563eb')).toBe('#0d6b57')
  })

  it('maps greys to Graphite', () => {
    expect(avatarPaletteColor('#ffffff')).toBe('#57534b')
    expect(avatarPaletteColor('#6b7280')).toBe('#57534b')
  })

  it('falls back to the first palette color for invalid input', () => {
    expect(avatarPaletteColor('not-a-color')).toBe(AVATAR_COLORS[0])
  })
})
