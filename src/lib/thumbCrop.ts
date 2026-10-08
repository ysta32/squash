import { parseAnnotations } from './annotations'

/** Where the scaled image sits inside its frame, in percent of the frame's width and height. */
export interface ThumbCrop {
  left: number
  top: number
  width: number
  height: number
}

/** Breathing room kept around the marks, as a fraction of the image's side. */
const MARGIN = 0.04

/**
 * Frames a screenshot thumbnail on its markup. With no marks the shot fills the frame from its
 * top-left corner (what `object-cover object-left-top` does) and this returns null. With marks,
 * the crop is centred on their bounding box (pins counted with their drawn radius); when the box
 * is larger than a cover crop shows, the shot zooms out, never further than fitting whole, so no
 * pin or highlight is cut off at the frame's edge. Draw the overlay with visible overflow so a pin
 * overhanging the image's edge shows in the letterbox.
 *
 * @param frameAspect the frame's width / height (thumbnails are 4:3)
 * @param pinSize pin radius as a fraction of the image's longer side, as AnnotationOverlay draws it
 */
export function thumbCrop(
  annotations: unknown,
  width: number,
  height: number,
  frameAspect: number,
  pinSize: number,
): ThumbCrop | null {
  if (!(width > 0) || !(height > 0) || !(frameAspect > 0)) return null
  const doc = parseAnnotations(annotations)
  if (!doc || doc.shapes.length === 0) return null

  const rx = (pinSize * Math.max(width, height)) / width
  const ry = (pinSize * Math.max(width, height)) / height
  const xs: number[] = []
  const ys: number[] = []
  for (const shape of doc.shapes) {
    switch (shape.type) {
      case 'box':
        xs.push(shape.x, shape.x + shape.w)
        ys.push(shape.y, shape.y + shape.h)
        break
      case 'arrow':
        xs.push(shape.x1, shape.x2)
        ys.push(shape.y1, shape.y2)
        break
      case 'pen':
        for (const [x, y] of shape.points) {
          xs.push(x)
          ys.push(y)
        }
        break
      case 'pin':
        xs.push(shape.x - rx, shape.x + rx)
        ys.push(shape.y - ry, shape.y + ry)
        break
    }
  }
  // Not clamped to the image: a pin on its edge overhangs it, and that overhang must show too.
  const x0 = Math.min(...xs) - MARGIN
  const x1 = Math.max(...xs) + MARGIN
  const y0 = Math.min(...ys) - MARGIN
  const y1 = Math.max(...ys) + MARGIN

  // Units: the frame is 1 wide and `fh` tall; the image drawn `k` wide is `k / aspect` tall.
  const aspect = width / height
  const fh = 1 / frameAspect
  const cover = Math.max(1, fh * aspect)
  const contain = Math.min(1, fh * aspect)

  // Centre the box, clamped so the image never leaves a gap it could fill, nor leaves the frame.
  const place = (size: number, frame: number, centre: number) => {
    const ideal = frame / 2 - centre * size
    return size >= frame
      ? Math.min(0, Math.max(frame - size, ideal))
      : Math.max(0, Math.min(frame - size, ideal))
  }
  const layout = (k: number) => {
    const w = k
    const h = k / aspect
    return { w, h, left: place(w, 1, (x0 + x1) / 2), top: place(h, fh, (y0 + y1) / 2) }
  }
  // Whether the frame shows the whole box (in image fractions; it may overhang the image).
  const EPS = 1e-9
  const fits = (k: number) => {
    const { w, h, left, top } = layout(k)
    return (
      -left / w <= x0 + EPS &&
      (1 - left) / w >= x1 - EPS &&
      -top / h <= y0 + EPS &&
      (fh - top) / h >= y1 - EPS
    )
  }
  // The largest zoom between cover and contain that shows every mark (contain if none does).
  let k = cover
  if (!fits(cover)) {
    let lo = contain
    let hi = cover
    for (let i = 0; i < 32; i++) {
      const mid = (lo + hi) / 2
      if (fits(mid)) lo = mid
      else hi = mid
    }
    k = lo
  }
  const { w, h, left, top } = layout(k)

  const pct = (n: number) => Math.round(n * 100_000) / 1000
  return { left: pct(left), top: pct(top / fh), width: pct(w), height: pct(h / fh) }
}
