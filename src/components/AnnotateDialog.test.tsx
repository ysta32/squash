import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { AnnotateDialog } from './AnnotateDialog'
import type { MarkupShape } from '../lib/annotations'

let loaded: HTMLImageElement
const ctx = {
  save: vi.fn(),
  restore: vi.fn(),
  clearRect: vi.fn(),
  drawImage: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  strokeRect: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  fillText: vi.fn(),
}

beforeEach(() => {
  vi.clearAllMocks()
  URL.createObjectURL = vi.fn(() => 'blob:editor')
  URL.revokeObjectURL = vi.fn()
  vi.stubGlobal(
    'Image',
    class {
      constructor() {
        loaded = document.createElement('img')
        Object.defineProperties(loaded, {
          naturalWidth: { value: 1000 },
          naturalHeight: { value: 500 },
        })
        return loaded
      }
    },
  )
  vi.stubGlobal(
    'PointerEvent',
    class extends MouseEvent {
      pointerId: number
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init)
        this.pointerId = init.pointerId ?? 1
      }
    },
  )
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    ctx as unknown as CanvasRenderingContext2D,
  )
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) =>
    callback(new Blob(['png'], { type: 'image/png' })),
  )
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function setup(initialShapes?: MarkupShape[]) {
  const onSave = vi.fn()
  const onClose = vi.fn()
  const file = new File(['source'], 'screen.shot.jpg', { type: 'image/jpeg' })
  render(
    <AnnotateDialog file={file} initialShapes={initialShapes} onSave={onSave} onClose={onClose} />,
  )
  fireEvent.load(loaded)
  const canvas = screen.getByLabelText('Image annotation canvas') as HTMLCanvasElement
  canvas.setPointerCapture = vi.fn()
  canvas.releasePointerCapture = vi.fn()
  vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
    x: 10,
    y: 20,
    left: 10,
    top: 20,
    width: 500,
    height: 250,
    right: 510,
    bottom: 270,
    toJSON: () => ({}),
  })
  return { canvas, onSave, onClose, file }
}

function click(canvas: HTMLCanvasElement, clientX: number, clientY: number) {
  fireEvent.pointerDown(canvas, { pointerId: 3, clientX, clientY, button: 0 })
  fireEvent.pointerUp(canvas, { pointerId: 3, clientX, clientY })
}

const saveButton = () => screen.getByRole('button', { name: 'Use marked-up image' })

function drag(canvas: HTMLCanvasElement) {
  fireEvent.pointerDown(canvas, { pointerId: 7, clientX: 20, clientY: 30, button: 0 })
  fireEvent.pointerMove(canvas, { pointerId: 7, clientX: 60, clientY: 70 })
  fireEvent.pointerUp(canvas, { pointerId: 7, clientX: 110, clientY: 120 })
}

describe('AnnotateDialog', () => {
  it('switches tools with hotkeys and disables saving until a drag is complete', () => {
    const { canvas } = setup()
    expect(screen.getByRole('button', { name: 'Use marked-up image' })).toBeDisabled()
    for (const [key, name] of [
      ['b', 'Box'],
      ['p', 'Pen'],
      ['a', 'Arrow'],
    ]) {
      fireEvent.keyDown(window, { key })
      expect(screen.getByRole('button', { name: new RegExp(name) })).toHaveAttribute(
        'aria-pressed',
        'true',
      )
    }
    drag(canvas)
    expect(screen.getByRole('button', { name: 'Use marked-up image' })).toBeEnabled()
    expect(canvas.setPointerCapture).toHaveBeenCalledWith(7)
    expect(canvas.releasePointerCapture).toHaveBeenCalledWith(7)
    expect(ctx.moveTo).toHaveBeenCalledWith(20, 20)
    expect(ctx.lineTo).toHaveBeenCalledWith(200, 200)
  })

  it.each(['ctrlKey', 'metaKey'])('undoes a stroke with %s+Z', (modifier) => {
    const { canvas } = setup()
    drag(canvas)
    fireEvent.keyDown(window, { key: 'z', [modifier]: true })
    expect(screen.getByRole('button', { name: 'Use marked-up image' })).toBeDisabled()
  })

  it('clears strokes and ignores a cancelled drag or another pointer', () => {
    const { canvas } = setup()
    fireEvent.pointerDown(canvas, { pointerId: 7, clientX: 20, clientY: 30 })
    fireEvent.pointerUp(canvas, { pointerId: 8, clientX: 50, clientY: 60 })
    fireEvent.pointerCancel(canvas, { pointerId: 7 })
    expect(screen.getByRole('button', { name: 'Use marked-up image' })).toBeDisabled()
    drag(canvas)
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(screen.getByRole('button', { name: 'Use marked-up image' })).toBeDisabled()
  })

  it('asks before discarding changes and lets the user keep editing', () => {
    const { canvas, onClose } = setup()
    drag(canvas)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.getByText('Discard changes?')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
    expect(screen.getByRole('button', { name: 'Use marked-up image' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('closes immediately on Escape without changes', () => {
    const { onClose } = setup()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it.each([false, true])('Escape cancels a drag with existing strokes: %s', (hasStroke) => {
    const { canvas, onClose } = setup()
    if (hasStroke) drag(canvas)
    fireEvent.pointerDown(canvas, { pointerId: 7, clientX: 20, clientY: 30, button: 0 })
    fireEvent.pointerMove(canvas, { pointerId: 7, clientX: 60, clientY: 70 })
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByText('Discard changes?')).not.toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
    expect(canvas.releasePointerCapture).toHaveBeenCalledWith(7)
    fireEvent.pointerUp(canvas, { pointerId: 7, clientX: 110, clientY: 120 })
    if (hasStroke) {
      expect(screen.getByRole('button', { name: 'Use marked-up image' })).toBeEnabled()
      fireEvent.keyDown(window, { key: 'z', ctrlKey: true })
    }
    expect(screen.getByRole('button', { name: 'Use marked-up image' })).toBeDisabled()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it.each(['click', 'Enter', 'Mod+Enter'])(
    'exports the original image and strokes at natural size using %s',
    async (method) => {
      const { canvas, onSave, onClose } = setup()
      drag(canvas)
      ctx.drawImage.mockClear()
      ctx.lineTo.mockClear()
      await act(async () => {
        if (method === 'click')
          fireEvent.click(screen.getByRole('button', { name: 'Use marked-up image' }))
        else fireEvent.keyDown(window, { key: 'Enter', metaKey: method === 'Mod+Enter' })
      })
      expect(onSave).toHaveBeenCalledOnce()
      const file: File = onSave.mock.calls[0][0]
      expect(file).toBeInstanceOf(File)
      expect(file.name).toBe('screen.shot-marked.png')
      expect(file.type).toBe('image/png')
      expect(ctx.drawImage).toHaveBeenCalledWith(loaded, 0, 0)
      expect(ctx.lineTo).toHaveBeenCalledWith(200, 200)
      const output = vi.mocked(HTMLCanvasElement.prototype.toBlob).mock
        .contexts[0] as HTMLCanvasElement
      expect(output.width).toBe(1000)
      expect(output.height).toBe(500)
      expect(HTMLCanvasElement.prototype.toBlob).toHaveBeenCalledWith(
        expect.any(Function),
        'image/png',
      )
      expect(onClose.mock.invocationCallOrder[0]).toBeGreaterThan(
        onSave.mock.invocationCallOrder[0],
      )
    },
  )

  it('keeps edits and shows an error when PNG encoding fails', async () => {
    const { canvas, onSave, onClose } = setup()
    drag(canvas)
    vi.mocked(HTMLCanvasElement.prototype.toBlob).mockImplementation((callback) => callback(null))
    await act(async () =>
      fireEvent.click(screen.getByRole('button', { name: 'Use marked-up image' })),
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Could not save')
    expect(onSave).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Use marked-up image' })).toBeEnabled()
  })

  it('stays open with the marks when the caller rejects the saved image', async () => {
    const { canvas, onSave, onClose } = setup()
    drag(canvas)
    onSave.mockRejectedValue(new Error('The marked-up image is too large to upload (max 5MB).'))
    await act(async () =>
      fireEvent.click(screen.getByRole('button', { name: 'Use marked-up image' })),
    )
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('alert')).toHaveTextContent('too large to upload')
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Use marked-up image' })).toBeEnabled()
  })

  it('keeps focus inside while saving and ignores an export completed after unmount', async () => {
    const { canvas, onSave, onClose } = setup()
    let complete: BlobCallback | undefined
    vi.mocked(HTMLCanvasElement.prototype.toBlob).mockImplementation((callback) => {
      complete = callback
    })
    drag(canvas)
    fireEvent.keyDown(window, { key: 'Enter' })
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(HTMLCanvasElement.prototype.toBlob).toHaveBeenCalledOnce()
    fireEvent.keyDown(window, { key: 'Tab' })
    expect(screen.getByRole('dialog')).toHaveFocus()
    cleanup()
    if (!complete) throw new Error('Expected PNG encoding callback')
    await act(async () => complete?.(new Blob(['png'], { type: 'image/png' })))
    expect(onSave).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('traps and restores focus and releases its image URL', () => {
    const trigger = document.createElement('button')
    document.body.append(trigger)
    trigger.focus()
    setup()
    const first = screen.getByRole('button', { name: /Arrow/ })
    expect(first).toHaveFocus()
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true })
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
    fireEvent.keyDown(window, { key: 'Tab' })
    expect(first).toHaveFocus()
    cleanup()
    expect(trigger).toHaveFocus()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:editor')
    trigger.remove()
  })
})

describe('AnnotateDialog live markup layers', () => {
  it('places numbered pins with the pin tool and saves their notes as vector layers', async () => {
    const { canvas, onSave } = setup()
    fireEvent.keyDown(window, { key: 'n' })
    expect(screen.getByRole('button', { name: /^Pin/ })).toHaveAttribute('aria-pressed', 'true')
    click(canvas, 60, 145) // (0.1, 0.5) of the image
    const note = screen.getByLabelText('Note for pin 1')
    expect(note).toHaveFocus()
    // Typing a note never switches tools, undoes or saves.
    for (const key of ['b', 'Enter', 'z']) {
      fireEvent.keyDown(note, { key, ctrlKey: key === 'z' })
    }
    expect(screen.getByRole('button', { name: /^Pin/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('Note for pin 1')).toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
    fireEvent.change(note, { target: { value: 'Banner overlaps Pay now' } })
    // Escape leaves the note for the tools instead of closing the editor.
    fireEvent.keyDown(note, { key: 'Escape' })
    expect(screen.getByRole('dialog')).toHaveFocus()
    expect(screen.queryByText('Discard changes?')).toBeNull()
    click(canvas, 260, 70)
    expect(screen.getByLabelText('Note for pin 2')).toHaveFocus()
    ctx.fillText.mockClear()
    await act(async () =>
      fireEvent.keyDown(screen.getByLabelText('Note for pin 2'), { key: 'Enter', metaKey: true }),
    )
    expect(onSave).toHaveBeenCalledOnce()
    const [file, annotations] = onSave.mock.calls[0]
    expect(file.name).toBe('screen.shot-marked.png')
    expect(annotations).toEqual({
      v: 1,
      shapes: [
        { type: 'pin', color: 'danger', n: 1, x: 0.1, y: 0.5, note: 'Banner overlaps Pay now' },
        { type: 'pin', color: 'danger', n: 2, x: 0.5, y: 0.2 },
      ],
    })
    // The flattened render has the numbered pins baked in at natural size.
    expect(ctx.fillText).toHaveBeenCalledWith('1', 100, 250)
    expect(ctx.fillText).toHaveBeenCalledWith('2', 500, 100)
  })

  it('saves drags as normalized shapes in the chosen color', async () => {
    const { canvas, onSave } = setup()
    fireEvent.keyDown(window, { key: 'b' })
    fireEvent.click(screen.getByRole('button', { name: 'Warning' }))
    // Drawn up and left: stored as a positive box.
    fireEvent.pointerDown(canvas, { pointerId: 7, clientX: 260, clientY: 145, button: 0 })
    fireEvent.pointerUp(canvas, { pointerId: 7, clientX: 60, clientY: 70 })
    await act(async () => fireEvent.click(saveButton()))
    expect(onSave.mock.calls[0][1]).toEqual({
      v: 1,
      shapes: [{ type: 'box', color: 'warning', x: 0.1, y: 0.2, w: 0.4, h: 0.3 }],
    })
  })

  it('removes a layer and renumbers the remaining pins', () => {
    const { canvas } = setup()
    fireEvent.keyDown(window, { key: 'n' })
    click(canvas, 60, 70)
    click(canvas, 160, 70)
    click(canvas, 260, 70)
    fireEvent.click(screen.getByRole('button', { name: 'Remove Pin 2' }))
    expect(screen.queryByLabelText('Note for pin 3')).toBeNull()
    expect(screen.getByLabelText('Note for pin 1')).toBeInTheDocument()
    expect(screen.getByLabelText('Note for pin 2')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })

  it('edits existing layers and only enables saving after a change', async () => {
    const initial: MarkupShape[] = [
      { type: 'pin', color: 'fg', n: 1, x: 0.2, y: 0.2, note: 'Old' },
      { type: 'arrow', color: 'danger', x1: 0, y1: 0, x2: 0.5, y2: 0.5 },
    ]
    const { onSave } = setup(initial)
    expect(screen.getByLabelText('Note for pin 1')).toHaveValue('Old')
    expect(screen.getByRole('button', { name: 'Remove Arrow 1' })).toBeInTheDocument()
    expect(saveButton()).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Note for pin 1'), { target: { value: 'New' } })
    expect(saveButton()).toBeEnabled()
    await act(async () => fireEvent.click(saveButton()))
    expect(onSave.mock.calls[0][1].shapes[0]).toEqual({ ...initial[0], note: 'New' })
  })

  it('closes unchanged existing layers without asking', () => {
    const { onClose } = setup([{ type: 'pin', color: 'fg', n: 1, x: 0.2, y: 0.2 }])
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('hands back the unmarked original when every layer is removed', async () => {
    const { onSave, onClose, file } = setup([{ type: 'pin', color: 'fg', n: 1, x: 0.2, y: 0.2 }])
    fireEvent.click(screen.getByRole('button', { name: 'Remove Pin 1' }))
    await act(async () => fireEvent.click(saveButton()))
    expect(onSave).toHaveBeenCalledWith(file, { v: 1, shapes: [] })
    expect(HTMLCanvasElement.prototype.toBlob).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('caps an image at 50 marks', () => {
    const pins = Array.from({ length: 50 }, (_, i): MarkupShape => ({
      type: 'pin',
      color: 'danger',
      n: i + 1,
      x: 0.5,
      y: 0.5,
    }))
    const { canvas } = setup(pins)
    fireEvent.keyDown(window, { key: 'n' })
    click(canvas, 60, 70)
    expect(screen.getByRole('alert')).toHaveTextContent('Up to 50 marks per image')
    expect(screen.queryByLabelText('Note for pin 51')).toBeNull()
  })

  it('keeps the marks and explains when the layers are too large to store', async () => {
    const pins = Array.from({ length: 50 }, (_, i): MarkupShape => ({
      type: 'pin',
      color: 'danger',
      n: i + 1,
      x: 0.5,
      y: 0.5,
      note: '漢'.repeat(279),
    }))
    const { onSave, onClose } = setup(pins)
    fireEvent.change(screen.getByLabelText('Note for pin 1'), {
      target: { value: '漢'.repeat(280) },
    })
    await act(async () => fireEvent.click(saveButton()))
    expect(screen.getByRole('alert')).toHaveTextContent('Too many marks to save')
    expect(onSave).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    expect(saveButton()).toBeEnabled()
  })
})
