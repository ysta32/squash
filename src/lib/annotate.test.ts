import { afterEach, describe, expect, it, vi } from 'vitest'
import { arrowHead, drawShapes, fitUnder, strokeWidthFor, type Shape } from './annotate'

describe('annotation geometry', () => {
  it('puts arrow wings behind a horizontal tip and mirrors them', () => {
    const [left, right] = arrowHead({ x: 0, y: 10 }, { x: 100, y: 10 }, 20)
    expect(left.x).toBeCloseTo(100 - Math.sqrt(3) * 10)
    expect(right.x).toBeCloseTo(left.x)
    expect(left.y).toBeCloseTo(20)
    expect(right.y).toBeCloseTo(0)
  })

  it('rotates the arrow wings for a vertical arrow', () => {
    const [left, right] = arrowHead({ x: 5, y: 0 }, { x: 5, y: 100 }, 20)
    expect(left.x).toBeCloseTo(-5)
    expect(right.x).toBeCloseTo(15)
    expect(left.y).toBeCloseTo(100 - Math.sqrt(3) * 10)
    expect(right.y).toBeCloseTo(left.y)
  })

  it('keeps coincident endpoints finite', () => {
    expect(arrowHead({ x: 0, y: 0 }, { x: 0, y: 0 }, 0)).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 0 },
    ])
  })

  it('scales the stroke width and clamps it to 3..12', () => {
    expect(strokeWidthFor(0)).toBe(4)
    expect(strokeWidthFor(100)).toBe(4)
    expect(strokeWidthFor(1500)).toBe(12)
    expect(strokeWidthFor(10000)).toBe(16)
  })
})

describe('drawShapes', () => {
  it('draws each tool in order and resolves theme tokens at draw time', () => {
    const calls: unknown[][] = []
    const record =
      (name: string) =>
      (...args: number[]) => {
        calls.push([name, ...args])
      }
    const ctx = {
      save: record('save'),
      restore: record('restore'),
      beginPath: record('beginPath'),
      moveTo: record('moveTo'),
      lineTo: record('lineTo'),
      stroke: record('stroke'),
      strokeRect: record('strokeRect'),
      strokeStyle: '',
      lineWidth: 0,
      lineCap: '',
      lineJoin: '',
    }
    const shape = (tool: Shape['tool'], points: Shape['points']): Shape => ({
      tool,
      points,
      width: 3,
      color: 'var(--danger)',
    })
    document.documentElement.style.setProperty('--danger', 'rgb(200, 10, 20)')
    try {
      drawShapes(ctx as unknown as CanvasRenderingContext2D, [
        shape('pen', [
          { x: 1, y: 2 },
          { x: 3, y: 4 },
          { x: 5, y: 6 },
        ]),
        shape('box', [
          { x: 10, y: 20 },
          { x: 7, y: 12 },
        ]),
        shape('arrow', [
          { x: 0, y: 0 },
          { x: 99, y: 99 },
          { x: 20, y: 0 },
        ]),
        shape('pen', []),
      ])
      expect(calls).toEqual([
        ['save'],
        ['beginPath'],
        ['moveTo', 1, 2],
        ['lineTo', 3, 4],
        ['lineTo', 5, 6],
        ['stroke'],
        ['strokeRect', 10, 20, -3, -8],
        ['beginPath'],
        ['moveTo', 0, 0],
        ['lineTo', 20, 0],
        ['moveTo', expect.closeTo(20 - 6 * Math.sqrt(3)), expect.closeTo(6)],
        ['lineTo', 20, 0],
        ['lineTo', expect.closeTo(20 - 6 * Math.sqrt(3)), expect.closeTo(-6)],
        ['stroke'],
        ['restore'],
      ])
      expect(ctx.strokeStyle).toBe('rgb(200, 10, 20)')
      expect(ctx.lineWidth).toBe(3)
      document.documentElement.style.setProperty('--danger', 'rgb(240, 30, 40)')
      drawShapes(ctx as unknown as CanvasRenderingContext2D, [
        shape('box', [
          { x: 0, y: 0 },
          { x: 5, y: 5 },
        ]),
      ])
      expect(ctx.strokeStyle).toBe('rgb(240, 30, 40)')
    } finally {
      document.documentElement.style.removeProperty('--danger')
    }
  })
})

describe('fitUnder', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it.each([9, 10])('returns a file of %i bytes unchanged when within the limit', async (size) => {
    const file = new File([new Uint8Array(size)], 'shot.png', { type: 'image/png' })
    expect(await fitUnder(file, 10)).toBe(file)
  })

  function setupConversion(blob: Blob | null, decodeFails = false, contextMissing = false) {
    const image = document.createElement('img')
    Object.defineProperties(image, {
      naturalWidth: { value: 100 },
      naturalHeight: { value: 80 },
    })
    vi.stubGlobal(
      'Image',
      class {
        constructor() {
          queueMicrotask(() => image.dispatchEvent(new Event(decodeFails ? 'error' : 'load')))
          return image
        }
      },
    )
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:conversion'),
      revokeObjectURL: vi.fn(),
    })
    const context = { fillStyle: '', fillRect: vi.fn(), drawImage: vi.fn() }
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      contextMissing ? null : (context as unknown as CanvasRenderingContext2D),
    )
    const toBlob = vi
      .spyOn(HTMLCanvasElement.prototype, 'toBlob')
      .mockImplementation((callback) => callback(blob))
    return { image, context, toBlob }
  }

  it.each(['shot.png', 'shot'])(
    'converts %s to a white-backed JPEG at quality 0.9',
    async (name) => {
      const { image, context, toBlob } = setupConversion(
        new Blob(['1234567890'], { type: 'image/jpeg' }),
      )
      const file = new File(['12345678901'], name, { type: 'image/png' })
      const result = await fitUnder(file, 10)
      expect(result).not.toBe(file)
      expect(result.name).toBe('shot.jpg')
      expect(result.type).toBe('image/jpeg')
      expect(result.size).toBe(10)
      expect(context.fillStyle).toBe('white')
      expect(context.fillRect).toHaveBeenCalledWith(0, 0, 100, 80)
      expect(context.drawImage).toHaveBeenCalledWith(image, 0, 0)
      expect(context.fillRect.mock.invocationCallOrder[0]).toBeLessThan(
        context.drawImage.mock.invocationCallOrder[0],
      )
      expect(toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.9)
      const canvas = toBlob.mock.contexts[0] as HTMLCanvasElement
      expect([canvas.width, canvas.height]).toEqual([100, 80])
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:conversion')
    },
  )

  it.each([
    { blob: new Blob(['12345678901'], { type: 'image/jpeg' }), message: 'too-large' },
    { blob: null, message: 'Could not save the marked-up image.' },
    {
      blob: new Blob(['x'], { type: 'image/png' }),
      message: 'Could not save the marked-up image.',
    },
    { blob: null, decodeFails: true, message: 'Could not load the marked-up image.' },
    { blob: null, contextMissing: true, message: 'Could not create the marked-up image.' },
  ])(
    'rejects with $message and releases the conversion URL',
    async ({ blob, decodeFails, contextMissing, message }) => {
      setupConversion(blob, decodeFails, contextMissing)
      const file = new File(['12345678901'], 'shot.png', { type: 'image/png' })
      await expect(fitUnder(file, 10)).rejects.toThrow(message)
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:conversion')
    },
  )
})
