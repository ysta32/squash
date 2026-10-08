import { describe, expect, it } from 'vitest'
import { initialSplit } from './initialSplit'
import type { Json } from './database.types'

const doc = (...shapes: Json[]): Json => ({ v: 1, shapes })
const box = (x: number, w: number) => ({ type: 'box', color: 'danger', x, y: 0.4, w, h: 0.2 })

describe('initialSplit', () => {
  it('starts in the middle without usable markup', () => {
    expect(initialSplit(undefined)).toBe(50)
    expect(initialSplit(null)).toBe(50)
    expect(initialSplit({ v: 2, shapes: [] })).toBe(50)
    expect(initialSplit(doc())).toBe(50)
  })

  it('starts just right of the marked subject when there is room', () => {
    expect(initialSplit(doc(box(0.35, 0.14)))).toBe(53)
    // A subject near the left edge still leaves the before image a usable strip.
    expect(initialSplit(doc(box(0, 0.05)))).toBe(15)
  })

  it('takes the union of every mark, pins included', () => {
    const pin = { type: 'pin', color: 'danger', n: 1, x: 0.6, y: 0.5 }
    // Pin at 0.6 reaches 0.63, plus the 4% gap.
    expect(initialSplit(doc(box(0.2, 0.1), pin))).toBe(67)
  })

  it('starts left of a subject that sits near the right edge', () => {
    expect(initialSplit(doc(box(0.7, 0.2)))).toBe(66)
  })

  it('falls back to the middle when the marks span the whole shot', () => {
    expect(initialSplit(doc(box(0.1, 0.85)))).toBe(50)
  })
})
