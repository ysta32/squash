import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  AnnotationsTooLargeError,
  MAX_ANNOTATION_BYTES,
  MAX_NOTE_LENGTH,
  MAX_PEN_POINTS,
  MAX_SHAPES,
  decimate,
  drawAnnotations,
  flatten,
  jsonbTextBytes,
  nextPinNumber,
  parseAnnotations,
  parseShape,
  pinChecklist,
  renumberPins,
  sanitizeNote,
  serializeAnnotations,
  toClaudeRegions,
  type MarkupShape,
  type PenShape,
} from './annotations'

const pin = (n: number, note?: string): MarkupShape => ({
  type: 'pin',
  color: 'danger',
  n,
  x: 0.5,
  y: 0.25,
  ...(note === undefined ? {} : { note }),
})

describe('parseShape', () => {
  it('accepts each shape type and clamps coordinates to 0..1', () => {
    expect(
      parseShape({ type: 'arrow', color: 'warning', x1: -1, y1: 0.2, x2: 2, y2: 0.4 }),
    ).toEqual({ type: 'arrow', color: 'warning', x1: 0, y1: 0.2, x2: 1, y2: 0.4 })
    expect(parseShape({ type: 'pin', color: 'fg', n: 3, x: 1.5, y: -0.5, note: ' Hi ' })).toEqual({
      type: 'pin',
      color: 'fg',
      n: 3,
      x: 1,
      y: 0,
      note: 'Hi',
    })
    expect(
      parseShape({
        type: 'pen',
        color: 'success',
        points: [
          [0.1, 0.1],
          [1.2, -3],
        ],
      }),
    ).toEqual({
      type: 'pen',
      color: 'success',
      points: [
        [0.1, 0.1],
        [1, 0],
      ],
    })
  })

  it('normalizes boxes drawn up or left and clips them to the image', () => {
    expect(parseShape({ type: 'box', color: 'danger', x: 0.6, y: 0.5, w: -0.2, h: -0.3 })).toEqual({
      type: 'box',
      color: 'danger',
      x: 0.4,
      y: 0.2,
      w: 0.2,
      h: 0.3,
    })
    expect(parseShape({ type: 'box', color: 'danger', x: 0.8, y: -0.2, w: 0.5, h: 0.5 })).toEqual({
      type: 'box',
      color: 'danger',
      x: 0.8,
      y: 0,
      w: 0.2,
      h: 0.3,
    })
  })

  it.each([
    ['NaN', { type: 'arrow', x1: NaN, y1: 0, x2: 0, y2: 0 }],
    ['Infinity', { type: 'box', x: 0, y: 0, w: Infinity, h: 0 }],
    ['-Infinity', { type: 'pin', n: 1, x: -Infinity, y: 0 }],
    ['string coordinate', { type: 'pin', n: 1, x: '0.5', y: 0 }],
    ['missing coordinate', { type: 'arrow', x1: 0, y1: 0, x2: 0 }],
    [
      'non-finite pen point',
      {
        type: 'pen',
        points: [
          [0, 0],
          [NaN, 1],
        ],
      },
    ],
    ['malformed pen point', { type: 'pen', points: [[0, 0], [1]] }],
    ['single pen point', { type: 'pen', points: [[0, 0]] }],
    ['pen without points', { type: 'pen' }],
    ['fractional pin number', { type: 'pin', n: 1.5, x: 0, y: 0 }],
    ['zero pin number', { type: 'pin', n: 0, x: 0, y: 0 }],
    ['huge pin number', { type: 'pin', n: 1000, x: 0, y: 0 }],
    ['unknown type', { type: 'circle', x: 0, y: 0 }],
    ['array', [1, 2]],
    ['null', null],
  ])('rejects %s', (_, value) => {
    expect(parseShape(value)).toBeNull()
  })

  it('falls back to the danger token for unknown colors (never a raw color)', () => {
    expect(parseShape({ type: 'pin', color: '#ff0000', n: 1, x: 0, y: 0 })).toMatchObject({
      color: 'danger',
    })
  })

  it('thins long pen strokes to the point cap, keeping both ends', () => {
    const points = Array.from({ length: 1000 }, (_, i) => [i / 999, 0.5])
    const shape = parseShape({ type: 'pen', color: 'danger', points }) as PenShape
    expect(shape.points).toHaveLength(MAX_PEN_POINTS)
    expect(shape.points[0]).toEqual([0, 0.5])
    expect(shape.points.at(-1)).toEqual([1, 0.5])
  })

  it('rounds coordinates to 4 decimals', () => {
    expect(parseShape({ type: 'pin', n: 1, x: 0.123456789, y: 0.98765 })).toMatchObject({
      x: 0.1235,
      y: 0.9877,
    })
  })
})

describe('sanitizeNote', () => {
  it('trims, collapses whitespace and drops control characters and lone surrogates', () => {
    expect(sanitizeNote('  Banner\n\toverlaps\u0000 Pay\u007f now ')).toBe(
      'Banner overlaps Pay now',
    )
    expect(sanitizeNote('a\ud800b\udc00c')).toBe('abc')
    expect(sanitizeNote('ok 😀')).toBe('ok 😀')
  })

  it('caps notes at 280 units without splitting a surrogate pair', () => {
    expect(sanitizeNote('x'.repeat(400))).toHaveLength(MAX_NOTE_LENGTH)
    const note = sanitizeNote(`${'x'.repeat(MAX_NOTE_LENGTH - 1)}😀`) as string
    expect(note).toBe('x'.repeat(MAX_NOTE_LENGTH - 1))
  })

  it('returns undefined for empty or non-string notes', () => {
    expect(sanitizeNote('   ')).toBeUndefined()
    expect(sanitizeNote(42)).toBeUndefined()
    expect(sanitizeNote(undefined)).toBeUndefined()
  })
})

describe('parseAnnotations', () => {
  it.each([
    ['null', null],
    ['an array', []],
    ['a string', 'x'],
    ['another version', { v: 2, shapes: [] }],
    ['a string version', { v: '1', shapes: [] }],
    ['missing shapes', { v: 1 }],
    ['object shapes', { v: 1, shapes: {} }],
  ])('rejects %s', (_, value) => {
    expect(parseAnnotations(value)).toBeNull()
  })

  it('drops invalid shapes and keeps at most 50', () => {
    const shapes = [
      { type: 'pin', n: 1, x: NaN, y: 0 },
      ...Array.from({ length: 60 }, (_, i) => pin(i + 1)),
    ]
    const doc = parseAnnotations({ v: 1, shapes })
    expect(doc?.shapes).toHaveLength(MAX_SHAPES)
    expect(doc?.shapes[0]).toMatchObject({ n: 1 })
  })

  it('round-trips a serialized document', () => {
    const shapes: MarkupShape[] = [
      pin(1, 'Banner overlaps Pay now'),
      { type: 'box', color: 'warning', x: 0.1, y: 0.2, w: 0.3, h: 0.4 },
      { type: 'arrow', color: 'fg', x1: 0, y1: 0, x2: 0.5, y2: 0.5 },
      {
        type: 'pen',
        color: 'success',
        points: [
          [0, 0],
          [0.5, 0.5],
        ],
      },
    ]
    const doc = serializeAnnotations(shapes)
    expect(parseAnnotations(JSON.parse(JSON.stringify(doc)))).toEqual(doc)
    expect(doc).toEqual({ v: 1, shapes })
  })
})

describe('jsonbTextBytes', () => {
  it('measures the jsonb text form, with a space after each colon and comma', () => {
    expect(jsonbTextBytes({ v: 1, shapes: [] })).toBe('{"v": 1, "shapes": []}'.length)
    expect(jsonbTextBytes([1, 'é'])).toBe('[1, "é"]'.length + 1)
    expect(jsonbTextBytes({ a: undefined, b: null })).toBe('{"b": null}'.length)
  })
})

describe('serializeAnnotations', () => {
  it('thins pen strokes until the document fits in 32 KB', () => {
    const pen = (): MarkupShape => ({
      type: 'pen',
      color: 'danger',
      points: Array.from({ length: MAX_PEN_POINTS }, (_, i) => [0.1234 + i / 10000, 0.5678]) as [
        number,
        number,
      ][],
    })
    const shapes = Array.from({ length: 20 }, pen)
    expect(jsonbTextBytes({ v: 1, shapes })).toBeGreaterThan(MAX_ANNOTATION_BYTES)
    const doc = serializeAnnotations(shapes)
    expect(jsonbTextBytes(doc)).toBeLessThanOrEqual(MAX_ANNOTATION_BYTES)
    expect(doc.shapes).toHaveLength(20)
    const first = doc.shapes[0] as PenShape
    expect(first.points.length).toBeLessThan(MAX_PEN_POINTS)
    expect(first.points[0][0]).toBe(0.1234)
  })

  it('throws when notes alone exceed the size cap', () => {
    const shapes = Array.from({ length: MAX_SHAPES }, (_, i) => pin(i + 1, '漢'.repeat(280)))
    expect(() => serializeAnnotations(shapes)).toThrow(AnnotationsTooLargeError)
  })

  it('refuses more than 50 shapes instead of silently dropping marks', () => {
    const shapes = Array.from({ length: MAX_SHAPES + 1 }, (_, i) => pin(i + 1))
    expect(() => serializeAnnotations(shapes)).toThrow(AnnotationsTooLargeError)
  })
})

describe('decimate', () => {
  it('keeps short lists and samples long ones evenly', () => {
    expect(decimate([1, 2, 3], 5)).toEqual([1, 2, 3])
    expect(decimate([0, 1, 2, 3, 4, 5, 6, 7, 8], 3)).toEqual([0, 4, 8])
    expect(decimate([0, 1, 2], 1)).toEqual([0])
  })
})

describe('pin numbering', () => {
  const box: MarkupShape = { type: 'box', color: 'danger', x: 0, y: 0, w: 0.1, h: 0.1 }

  it('numbers a new pin after the highest existing one', () => {
    expect(nextPinNumber([])).toBe(1)
    expect(nextPinNumber([box, pin(1), pin(4)])).toBe(5)
  })

  it('renumbers pins 1..k in drawing order and leaves other shapes alone', () => {
    const renumbered = renumberPins([pin(2), box, pin(5), pin(3)])
    expect(renumbered.map((s) => (s.type === 'pin' ? s.n : s.type))).toEqual([1, 'box', 2, 3])
    expect(renumbered[1]).toBe(box)
  })

  it('lists one checklist line per pin, by number', () => {
    expect(pinChecklist({ v: 1, shapes: [pin(2, 'Second'), box, pin(1)] })).toEqual([
      { n: 1, note: null, color: 'danger' },
      { n: 2, note: 'Second', color: 'danger' },
    ])
    expect(pinChecklist(null)).toEqual([])
  })
})

describe('toClaudeRegions', () => {
  it('lists pins by number, then boxes, arrows and drawings with normalized bounds', () => {
    const regions = toClaudeRegions({
      v: 1,
      shapes: [
        { type: 'arrow', color: 'danger', x1: 0.8, y1: 0.9, x2: 0.2, y2: 0.1 },
        pin(2),
        { type: 'box', color: 'danger', x: 0.1, y: 0.2, w: 0.3, h: 0.4 },
        pin(1, 'Banner overlaps Pay now'),
        {
          type: 'pen',
          color: 'danger',
          points: [
            [0.5, 0.6],
            [0.3, 0.9],
            [0.4, 0.7],
          ],
        },
        { type: 'box', color: 'danger', x: 0.5, y: 0.5, w: 0.1, h: 0.1 },
      ],
    })
    expect(regions).toEqual([
      { label: 'Pin 1', kind: 'pin', x: 0.5, y: 0.25, w: 0, h: 0, note: 'Banner overlaps Pay now' },
      { label: 'Pin 2', kind: 'pin', x: 0.5, y: 0.25, w: 0, h: 0 },
      { label: 'Box 1', kind: 'box', x: 0.1, y: 0.2, w: 0.3, h: 0.4 },
      { label: 'Box 2', kind: 'box', x: 0.5, y: 0.5, w: 0.1, h: 0.1 },
      {
        label: 'Arrow 1',
        kind: 'arrow',
        x: 0.2,
        y: 0.1,
        w: 0.6,
        h: 0.8,
        tip: { x: 0.2, y: 0.1 },
      },
      { label: 'Drawing 1', kind: 'pen', x: 0.3, y: 0.6, w: 0.2, h: 0.3 },
    ])
  })

  it('returns nothing without annotations', () => {
    expect(toClaudeRegions(null)).toEqual([])
    expect(toClaudeRegions({ v: 1, shapes: [] })).toEqual([])
  })
})

describe('rendering', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    document.documentElement.style.cssText = ''
  })

  function fakeContext() {
    const calls: [string, ...unknown[]][] = []
    const record =
      (name: string) =>
      (...args: unknown[]) =>
        calls.push([name, ...args])
    const ctx = {
      save: record('save'),
      restore: record('restore'),
      beginPath: record('beginPath'),
      moveTo: record('moveTo'),
      lineTo: record('lineTo'),
      stroke: record('stroke'),
      strokeRect: record('strokeRect'),
      arc: record('arc'),
      fill: record('fill'),
      fillText: record('fillText'),
      drawImage: record('drawImage'),
    } as unknown as CanvasRenderingContext2D
    return { ctx, calls }
  }

  it('scales shapes to pixels and draws numbered pins with theme tokens', () => {
    document.documentElement.style.setProperty('--danger', 'rgb(200, 0, 0)')
    document.documentElement.style.setProperty('--bg', 'rgb(255, 255, 255)')
    const { ctx, calls } = fakeContext()
    drawAnnotations(
      ctx,
      [
        { type: 'box', color: 'danger', x: 0.1, y: 0.2, w: 0.5, h: 0.5 },
        { type: 'arrow', color: 'danger', x1: 0, y1: 0, x2: 1, y2: 1 },
        pin(7),
      ],
      1000,
      500,
    )
    expect(calls).toContainEqual(['strokeRect', 100, 100, 500, 250])
    expect(calls).toContainEqual(['moveTo', 0, 0])
    expect(calls).toContainEqual(['lineTo', 1000, 500])
    const arc = calls.find((c) => c[0] === 'arc')
    expect(arc?.slice(1, 3)).toEqual([500, 125])
    expect(calls).toContainEqual(['fillText', '7', 500, 125])
    // Pins render after the box and arrow: drawing order is layer order.
    expect(calls.findIndex((c) => c[0] === 'arc')).toBeGreaterThan(
      calls.findIndex((c) => c[0] === 'strokeRect'),
    )
    expect(ctx.fillStyle).toBe('rgb(255, 255, 255)')
  })

  it('flattens the image and marks at natural size', () => {
    const { ctx, calls } = fakeContext()
    const canvas = document.createElement('canvas')
    vi.spyOn(canvas, 'getContext').mockReturnValue(ctx)
    const image = document.createElement('img')
    Object.defineProperties(image, {
      naturalWidth: { value: 800 },
      naturalHeight: { value: 600 },
    })
    expect(flatten(canvas, image, [pin(1)])).toBe(canvas)
    expect(canvas.width).toBe(800)
    expect(canvas.height).toBe(600)
    expect(calls[0]).toEqual(['drawImage', image, 0, 0])
    expect(calls).toContainEqual(['fillText', '1', 400, 150])
  })

  it('throws when the canvas has no 2D context', () => {
    const canvas = document.createElement('canvas')
    vi.spyOn(canvas, 'getContext').mockReturnValue(null)
    expect(() => flatten(canvas, document.createElement('img'), [])).toThrow(
      'Could not create the marked-up image.',
    )
  })
})
