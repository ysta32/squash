import { describe, expect, it } from 'vitest'
import { arrowHead, drawShapes, strokeWidthFor, type Shape } from './annotate'

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
    expect(strokeWidthFor(0)).toBe(3)
    expect(strokeWidthFor(100)).toBe(3)
    expect(strokeWidthFor(1500)).toBe(6)
    expect(strokeWidthFor(10000)).toBe(12)
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
