// Live markup layers: screenshot annotations stored as vectors next to the untouched original.
// Coordinates are normalized to the image (0..1, origin top left), so they survive resizing and
// compression. Stored in `bug_attachments.annotations` as `{ v: 1, shapes: [...] }`.
import { drawShapes, strokeWidthFor, type Shape as PixelShape } from './annotate'

export const ANNOTATIONS_VERSION = 1
export const MAX_SHAPES = 50
export const MAX_PEN_POINTS = 200
export const MAX_NOTE_LENGTH = 280
export const MAX_PIN_NUMBER = 999
/** Matches the database check: octet_length(annotations::text) <= 32768. */
export const MAX_ANNOTATION_BYTES = 32768

/** Theme tokens a shape may use; rendered as `var(--<color>)`, never a literal color. */
export const MARKUP_COLORS = ['danger', 'warning', 'success', 'fg'] as const
export type MarkupColor = (typeof MARKUP_COLORS)[number]
export type ShapeType = 'arrow' | 'box' | 'pen' | 'pin'

export interface ArrowShape {
  type: 'arrow'
  color: MarkupColor
  x1: number
  y1: number
  /** The tip. */
  x2: number
  y2: number
}
export interface BoxShape {
  type: 'box'
  color: MarkupColor
  x: number
  y: number
  w: number
  h: number
}
export interface PenShape {
  type: 'pen'
  color: MarkupColor
  points: [number, number][]
}
export interface PinShape {
  type: 'pin'
  color: MarkupColor
  /** 1-based number shown on the pin and used for the checklist line. */
  n: number
  x: number
  y: number
  note?: string
}
export type MarkupShape = ArrowShape | BoxShape | PenShape | PinShape

export interface Annotations {
  v: typeof ANNOTATIONS_VERSION
  shapes: MarkupShape[]
}

export class AnnotationsTooLargeError extends Error {
  constructor() {
    super('Too many marks to save. Remove a few drawings or shorten the pin notes.')
    this.name = 'AnnotationsTooLargeError'
  }
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))
const round = (value: number) => Math.round(value * 10000) / 10000
const coord = (value: number) => round(clamp01(value))

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Finite numbers only: NaN, ±Infinity and non-numbers are rejected (null). */
function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function colorOf(value: unknown): MarkupColor {
  return MARKUP_COLORS.includes(value as MarkupColor) ? (value as MarkupColor) : 'danger'
}

/**
 * A single-line note of at most 280 UTF-16 units: no control characters, no lone surrogates
 * (Postgres jsonb rejects them), collapsed whitespace. Undefined when nothing is left.
 */
export function sanitizeNote(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  let printable = ''
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0
    // Control characters become spaces; lone surrogates (iterated as single units) are dropped.
    if (code < 0x20 || (code >= 0x7f && code <= 0x9f)) printable += ' '
    else if (code < 0xd800 || code > 0xdfff) printable += char
  }
  const cleaned = printable.replace(/\s+/g, ' ').trim()
  let note = cleaned.slice(0, MAX_NOTE_LENGTH)
  // Never cut a surrogate pair in half.
  if (/[\ud800-\udbff]$/.test(note)) note = note.slice(0, -1)
  note = note.trimEnd()
  return note || undefined
}

/** Keeps the first and last point and samples evenly in between, down to `max` points. */
export function decimate<T>(points: T[], max: number): T[] {
  if (points.length <= max) return points
  if (max < 2) return points.slice(0, Math.max(0, max))
  const out: T[] = []
  const step = (points.length - 1) / (max - 1)
  for (let i = 0; i < max; i++) out.push(points[Math.round(i * step)])
  return out
}

/** Validates one shape: unknown types and non-finite values are rejected; coordinates are clamped. */
export function parseShape(value: unknown): MarkupShape | null {
  if (!isRecord(value)) return null
  const color = colorOf(value.color)
  switch (value.type) {
    case 'arrow': {
      const [x1, y1, x2, y2] = [value.x1, value.y1, value.x2, value.y2].map(finite)
      if (x1 === null || y1 === null || x2 === null || y2 === null) return null
      return { type: 'arrow', color, x1: coord(x1), y1: coord(y1), x2: coord(x2), y2: coord(y2) }
    }
    case 'box': {
      let [x, y, w, h] = [value.x, value.y, value.w, value.h].map(finite)
      if (x === null || y === null || w === null || h === null) return null
      // Normalize a box drawn up or left, then clip it to the image.
      if (w < 0) [x, w] = [x + w, -w]
      if (h < 0) [y, h] = [y + h, -h]
      const left = coord(x)
      const top = coord(y)
      return {
        type: 'box',
        color,
        x: left,
        y: top,
        w: round(Math.max(0, clamp01(x + w) - left)),
        h: round(Math.max(0, clamp01(y + h) - top)),
      }
    }
    case 'pen': {
      if (!Array.isArray(value.points)) return null
      const points: [number, number][] = []
      for (const point of value.points as unknown[]) {
        if (!Array.isArray(point) || point.length !== 2) return null
        const x = finite(point[0])
        const y = finite(point[1])
        if (x === null || y === null) return null
        points.push([coord(x), coord(y)])
      }
      if (points.length < 2) return null
      return { type: 'pen', color, points: decimate(points, MAX_PEN_POINTS) }
    }
    case 'pin': {
      const x = finite(value.x)
      const y = finite(value.y)
      const n = finite(value.n)
      if (x === null || y === null || n === null) return null
      if (!Number.isInteger(n) || n < 1 || n > MAX_PIN_NUMBER) return null
      const note = sanitizeNote(value.note)
      return note === undefined
        ? { type: 'pin', color, n, x: coord(x), y: coord(y) }
        : { type: 'pin', color, n, x: coord(x), y: coord(y), note }
    }
    default:
      return null
  }
}

/**
 * Parses stored or received annotations. Null when the envelope is wrong (not an object, v ≠ 1,
 * shapes not an array). Invalid shapes are dropped and at most 50 are kept.
 */
export function parseAnnotations(value: unknown): Annotations | null {
  if (!isRecord(value) || value.v !== ANNOTATIONS_VERSION || !Array.isArray(value.shapes)) {
    return null
  }
  const shapes: MarkupShape[] = []
  for (const raw of value.shapes as unknown[]) {
    if (shapes.length >= MAX_SHAPES) break
    const shape = parseShape(raw)
    if (shape) shapes.push(shape)
  }
  return { v: ANNOTATIONS_VERSION, shapes }
}

/** UTF-8 size of the value as Postgres prints jsonb (`{"k": v, ...}`, `[a, b]`). */
export function jsonbTextBytes(value: unknown): number {
  return new TextEncoder().encode(jsonbText(value)).length
}

function jsonbText(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(jsonbText).join(', ')}]`
  if (isRecord(value)) {
    return `{${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${JSON.stringify(k)}: ${jsonbText(v)}`)
      .join(', ')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

/**
 * Builds the stored document: validated, rounded, at most 50 shapes. Pen strokes are thinned
 * until the document fits in 32 KB; throws AnnotationsTooLargeError when even that is not enough.
 */
export function serializeAnnotations(shapes: readonly MarkupShape[]): Annotations {
  const parsed = parseAnnotations({ v: ANNOTATIONS_VERSION, shapes })
  if (!parsed) throw new Error('Invalid annotations.')
  if (shapes.length > MAX_SHAPES) throw new AnnotationsTooLargeError()
  let doc = parsed
  let maxPoints = MAX_PEN_POINTS
  while (jsonbTextBytes(doc) > MAX_ANNOTATION_BYTES) {
    if (maxPoints <= 2) throw new AnnotationsTooLargeError()
    maxPoints = Math.max(2, Math.floor(maxPoints / 2))
    doc = {
      v: ANNOTATIONS_VERSION,
      shapes: doc.shapes.map((shape) =>
        shape.type === 'pen' ? { ...shape, points: decimate(shape.points, maxPoints) } : shape,
      ),
    }
  }
  return doc
}

/** The number for a new pin: one more than the highest existing pin. */
export function nextPinNumber(shapes: readonly MarkupShape[]): number {
  return shapes.reduce((max, shape) => (shape.type === 'pin' ? Math.max(max, shape.n) : max), 0) + 1
}

/** Renumbers pins 1..k in drawing order (after a pin is removed, the checklist has no gaps). */
export function renumberPins(shapes: readonly MarkupShape[]): MarkupShape[] {
  let n = 0
  return shapes.map((shape) => (shape.type === 'pin' ? { ...shape, n: ++n } : shape))
}

export interface ChecklistItem {
  n: number
  note: string | null
  color: MarkupColor
}

/** One checklist line per pin, by pin number. */
export function pinChecklist(doc: Annotations | null): ChecklistItem[] {
  if (!doc) return []
  return doc.shapes
    .filter((shape): shape is PinShape => shape.type === 'pin')
    .sort((a, b) => a.n - b.n)
    .map((pin) => ({ n: pin.n, note: pin.note ?? null, color: pin.color }))
}

export interface ClaudeRegion {
  /** e.g. "Pin 1", "Box 2". */
  label: string
  kind: ShapeType
  /** Bounding box, normalized to the image (0..1, origin top left). A pin is a point (w = h = 0). */
  x: number
  y: number
  w: number
  h: number
  /** Where an arrow points. */
  tip?: { x: number; y: number }
  note?: string
}

function bounds(xs: number[], ys: number[]) {
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, w: round(Math.max(...xs) - x), h: round(Math.max(...ys) - y) }
}

/** Structured regions for Claude: pins first (by number), then boxes, arrows and pen strokes. */
export function toClaudeRegions(doc: Annotations | null): ClaudeRegion[] {
  if (!doc) return []
  const counts: Record<ShapeType, number> = { arrow: 0, box: 0, pen: 0, pin: 0 }
  const kindLabel: Record<ShapeType, string> = {
    arrow: 'Arrow',
    box: 'Box',
    pen: 'Drawing',
    pin: 'Pin',
  }
  const order: ShapeType[] = ['pin', 'box', 'arrow', 'pen']
  const sorted = [...doc.shapes].sort((a, b) => {
    const byKind = order.indexOf(a.type) - order.indexOf(b.type)
    if (byKind !== 0) return byKind
    return a.type === 'pin' && b.type === 'pin' ? a.n - b.n : 0
  })
  return sorted.map((shape): ClaudeRegion => {
    const index = shape.type === 'pin' ? shape.n : ++counts[shape.type]
    const label = `${kindLabel[shape.type]} ${index}`
    switch (shape.type) {
      case 'pin':
        return shape.note
          ? { label, kind: 'pin', x: shape.x, y: shape.y, w: 0, h: 0, note: shape.note }
          : { label, kind: 'pin', x: shape.x, y: shape.y, w: 0, h: 0 }
      case 'box':
        return { label, kind: 'box', x: shape.x, y: shape.y, w: shape.w, h: shape.h }
      case 'arrow':
        return {
          label,
          kind: 'arrow',
          ...bounds([shape.x1, shape.x2], [shape.y1, shape.y2]),
          tip: { x: shape.x2, y: shape.y2 },
        }
      case 'pen':
        return {
          label,
          kind: 'pen',
          ...bounds(
            shape.points.map((p) => p[0]),
            shape.points.map((p) => p[1]),
          ),
        }
    }
  })
}

/** Pin radius in pixels for an image of this width. */
export function pinRadiusFor(imageWidth: number): number {
  return Math.max(12, strokeWidthFor(imageWidth) * 2.5)
}

function toPixelShape(shape: MarkupShape, width: number, height: number): PixelShape | null {
  const stroke = strokeWidthFor(width)
  const color = `var(--${shape.color})`
  switch (shape.type) {
    case 'arrow':
      return {
        tool: 'arrow',
        color,
        width: stroke,
        points: [
          { x: shape.x1 * width, y: shape.y1 * height },
          { x: shape.x2 * width, y: shape.y2 * height },
        ],
      }
    case 'box':
      return {
        tool: 'box',
        color,
        width: stroke,
        points: [
          { x: shape.x * width, y: shape.y * height },
          { x: (shape.x + shape.w) * width, y: (shape.y + shape.h) * height },
        ],
      }
    case 'pen':
      return {
        tool: 'pen',
        color,
        width: stroke,
        points: shape.points.map(([x, y]) => ({ x: x * width, y: y * height })),
      }
    case 'pin':
      return null
  }
}

function resolveToken(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

/** Draws the shapes onto a context whose pixel size is width × height (in drawing order). */
export function drawAnnotations(
  ctx: CanvasRenderingContext2D,
  shapes: readonly MarkupShape[],
  width: number,
  height: number,
): void {
  const radius = pinRadiusFor(width)
  for (const shape of shapes) {
    const pixel = toPixelShape(shape, width, height)
    if (pixel) {
      drawShapes(ctx, [pixel])
      continue
    }
    if (shape.type !== 'pin') continue
    const x = shape.x * width
    const y = shape.y * height
    ctx.save()
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fillStyle = resolveToken(`--${shape.color}`)
    ctx.fill()
    ctx.lineWidth = Math.max(2, radius / 6)
    ctx.strokeStyle = resolveToken('--bg')
    ctx.stroke()
    ctx.fillStyle = resolveToken('--bg')
    ctx.font = `500 ${Math.round(radius * 1.1)}px ${resolveToken('--font-mono') || 'monospace'}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(shape.n), x, y)
    ctx.restore()
  }
}

/**
 * Renders the image with its marks baked in, at the image's natural size, onto `canvas`
 * (resized to fit). Used for export and for servers without the annotations column.
 */
export function flatten(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  shapes: readonly MarkupShape[],
): HTMLCanvasElement {
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not create the marked-up image.')
  ctx.drawImage(image, 0, 0)
  drawAnnotations(ctx, shapes, canvas.width, canvas.height)
  return canvas
}
