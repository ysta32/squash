import { describe, expect, it } from 'vitest'
import { thumbCrop } from './thumbCrop'

const doc = (...shapes: unknown[]) => ({ v: 1, shapes })
const pin = (n: number, x: number, y: number) => ({ type: 'pin', color: 'danger', n, x, y })
const box = (x: number, y: number, w: number, h: number) => ({
  type: 'box',
  color: 'danger',
  x,
  y,
  w,
  h,
})

/** The visible window, as fractions of the image, for a crop in a frame of this aspect. */
function visible(crop: NonNullable<ReturnType<typeof thumbCrop>>) {
  const x0 = -crop.left / crop.width
  const y0 = -crop.top / crop.height
  return { x0, x1: x0 + 100 / crop.width, y0, y1: y0 + 100 / crop.height }
}

describe('thumbCrop', () => {
  it('returns null without marks or a usable size, so the top-left cover crop stays', () => {
    expect(thumbCrop(null, 1600, 1000, 4 / 3, 0.04)).toBeNull()
    expect(thumbCrop(doc(), 1600, 1000, 4 / 3, 0.04)).toBeNull()
    expect(thumbCrop(doc(pin(1, 0.5, 0.5)), 0, 1000, 4 / 3, 0.04)).toBeNull()
    expect(thumbCrop({ v: 2, shapes: [] }, 1600, 1000, 4 / 3, 0.04)).toBeNull()
  })

  it('centres a cover crop on a pin near the right edge of a wide shot', () => {
    const crop = thumbCrop(doc(pin(1, 0.9, 0.5)), 1600, 1000, 4 / 3, 0.04)!
    // Cover: 1.6 aspect in a 4:3 frame is 120% wide and exactly full height.
    expect(crop.width).toBeCloseTo(120)
    expect(crop.height).toBeCloseTo(100)
    expect(crop.top).toBeCloseTo(0)
    // Pushed all the way right (clamped), never past the image edge.
    expect(crop.left).toBeCloseTo(-20)
    const v = visible(crop)
    expect(v.x1).toBeCloseTo(1)
    expect(v.x0).toBeLessThan(0.9 - 0.064)
  })

  it('keeps the cover crop centred on marks that fit', () => {
    const crop = thumbCrop(doc(pin(1, 0.5, 0.5)), 1600, 1000, 4 / 3, 0.04)!
    expect(crop.left).toBeCloseTo(-10)
    expect(crop.width).toBeCloseTo(120)
  })

  it('zooms out until a box and a pin far apart are both in frame, never past contain', () => {
    // Highlight box at the right edge and a pin at the bottom, as on the seeded Fig. 1.
    const crop = thumbCrop(
      doc(box(0.7, 0.1, 0.29, 0.2), pin(2, 0.1, 0.95)),
      1600,
      1000,
      4 / 3,
      0.04,
    )!
    const v = visible(crop)
    expect(v.x0).toBeLessThanOrEqual(0.1 - 0.064 + 1e-6)
    expect(v.x1).toBeGreaterThanOrEqual(0.99)
    expect(v.y1).toBeGreaterThanOrEqual(0.95 + 0.064 - 1e-6)
    // Contain is the floor: the image is at least as wide as the frame here.
    expect(crop.width).toBeGreaterThanOrEqual(100 - 1e-6)
  })

  it('letterboxes (centred) rather than cut marks off when they span the whole shot', () => {
    const crop = thumbCrop(doc(pin(1, 0, 0), pin(2, 1, 1)), 1000, 2000, 4 / 3, 0.04)!
    // A portrait shot contained in a 4:3 frame: full height, centred horizontally.
    expect(crop.height).toBeCloseTo(100)
    expect(crop.top).toBeCloseTo(0)
    expect(crop.width).toBeCloseTo(37.5)
    expect(crop.left).toBeCloseTo((100 - 37.5) / 2)
  })

  it('shows a pin overhanging the bottom edge in the letterbox', () => {
    // Pin 2 sits on the cookie banner at the very bottom; its circle overhangs the image.
    const crop = thumbCrop(
      doc(box(0.6, 0.4, 0.3, 0.2), pin(2, 0.3, 0.98)),
      1600,
      1000,
      4 / 3,
      0.04,
    )!
    expect(crop.height).toBeLessThan(100)
    const v = visible(crop)
    expect(v.y1).toBeGreaterThanOrEqual(0.98 + 0.064)
    // The image itself stays inside the frame.
    expect(crop.top).toBeGreaterThanOrEqual(0)
    expect(crop.top + crop.height).toBeLessThanOrEqual(100 + 1e-6)
  })

  it('pans a tall shot down to a pin near its bottom', () => {
    const crop = thumbCrop(doc(pin(1, 0.5, 0.9)), 1000, 1500, 4 / 3, 0.04)!
    expect(crop.width).toBeCloseTo(100)
    const v = visible(crop)
    expect(v.y0).toBeGreaterThan(0)
    expect(v.y0).toBeLessThan(0.9 - 0.04)
    expect(v.y1).toBeGreaterThan(0.9 + 0.04)
  })
})
