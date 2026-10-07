import { describe, expect, it } from 'vitest'
import {
  AVATAR_COLORS,
  AVATAR_MIN_CONTRAST,
  contrastRatio,
  readableAvatarColor,
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

describe('readableAvatarColor', () => {
  it('keeps colors that already pass', () => {
    for (const color of AVATAR_COLORS) expect(readableAvatarColor(color)).toBe(color)
  })

  it.each(['#0891b2', '#6366f1', '#f59e0b', '#84cc16', '#ffffff', '#ff0000'])(
    'darkens %s until it reaches 4.5:1 without changing its hue',
    (color) => {
      const result = readableAvatarColor(color)
      expect(result).toMatch(/^#[0-9a-f]{6}$/)
      expect(contrastRatio(result, '#ffffff')).toBeGreaterThanOrEqual(AVATAR_MIN_CONTRAST)
      expect(Math.abs(hue(result) - hue(color))).toBeLessThan(3)
    },
  )

  it('falls back to the first palette color for invalid input', () => {
    expect(readableAvatarColor('not-a-color')).toBe(AVATAR_COLORS[0])
  })
})
