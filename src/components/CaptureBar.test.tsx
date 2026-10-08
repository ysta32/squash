import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { CaptureBar } from './CaptureBar'
import { MAX_ORIGINAL_BYTES } from '../hooks/useImageCompression'

const speechState = vi.hoisted(() => ({
  supported: true,
  listening: false,
  onFinal: (_t: string) => {},
  onInterim: (_t: string) => {},
  stop: vi.fn(),
}))

vi.mock('../hooks/useSpeech', () => ({
  useSpeech: (opts: { onFinal: (t: string) => void; onInterim: (t: string) => void }) => {
    speechState.onFinal = opts.onFinal
    speechState.onInterim = opts.onInterim
    return {
      supported: speechState.supported,
      listening: speechState.listening,
      start: () => {},
      stop: speechState.stop,
      toggle: () => {},
      error: null,
    }
  },
}))

const pasteState = vi.hoisted(() => ({ onFiles: (_f: File[]) => {} }))
vi.mock('../hooks/usePasteImage', () => ({
  usePasteImage: (onFiles: (f: File[]) => void) => {
    pasteState.onFiles = onFiles
  },
}))

function setup(onSubmit = vi.fn().mockResolvedValue(undefined), onToast = vi.fn()) {
  render(<CaptureBar workspaceId="w1" onSubmit={onSubmit} onToast={onToast} />)
  return {
    onSubmit,
    onToast,
    box: screen.getByPlaceholderText(
      'Paste a screenshot or describe the bug',
    ) as HTMLTextAreaElement,
  }
}

describe('CaptureBar', () => {
  it('attaches environment and the detected URL', async () => {
    const { box, onSubmit } = setup()
    fireEvent.change(box, { target: { value: 'Broken https://example.com/checkout' } })
    expect(
      screen.getByRole('button', { name: 'Remove URL https://example.com/checkout' }),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'File bug' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
    expect(onSubmit.mock.calls[0][0].context).toMatchObject({
      url: 'https://example.com/checkout',
      viewport: { w: window.innerWidth, h: window.innerHeight },
    })
  })
  it.each(['click', 'Backspace'])(
    'removes the URL with %s and preserves removal after failure',
    async (method) => {
      const { box, onSubmit, onToast } = setup(vi.fn().mockRejectedValue(new Error('offline')))
      fireEvent.change(box, { target: { value: 'Broken https://example.com/checkout' } })
      const chip = screen.getByRole('button', { name: 'Remove URL https://example.com/checkout' })
      if (method === 'click') fireEvent.click(chip)
      else fireEvent.keyDown(chip, { key: method })
      expect(screen.queryByRole('button', { name: /Remove URL/ })).not.toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'File bug' }))
      await waitFor(() => expect(onToast).toHaveBeenCalledWith('offline'))
      expect(onSubmit.mock.calls[0][0].context.url).toBeUndefined()
      expect(box.value).toContain('https://example.com/checkout')
      expect(screen.queryByRole('button', { name: /Remove URL/ })).not.toBeInTheDocument()
    },
  )

  beforeEach(() => {
    speechState.supported = true
    speechState.listening = false
    speechState.stop = vi.fn()
    URL.createObjectURL = vi.fn(() => 'blob:x')
    URL.revokeObjectURL = vi.fn()
  })
  afterEach(cleanup)

  it('pasting a screenshot from the page focuses the bar so you can type', () => {
    const { box } = setup()
    expect(document.activeElement).not.toBe(box)
    act(() => pasteState.onFiles([new File(['x'], 'shot.png', { type: 'image/png' })]))
    expect(document.activeElement).toBe(box)
    expect(screen.getByAltText('shot.png')).toBeInTheDocument()
  })

  it('pasting a screenshot while typing elsewhere keeps that focus', () => {
    setup()
    const other = document.createElement('textarea')
    document.body.appendChild(other)
    other.focus()
    act(() => pasteState.onFiles([new File(['x'], 'shot.png', { type: 'image/png' })]))
    expect(document.activeElement).toBe(other)
    other.remove()
  })

  it('pasting a screenshot puts the cursor after text already typed', () => {
    const { box } = setup()
    fireEvent.change(box, { target: { value: 'Login is broken' } })
    box.setSelectionRange(0, 0)
    box.blur()
    act(() => pasteState.onFiles([new File(['x'], 'shot.png', { type: 'image/png' })]))
    expect(document.activeElement).toBe(box)
    expect(box.selectionStart).toBe('Login is broken'.length)
  })

  it('pasting a screenshot while a dialog is open leaves focus alone', () => {
    const { box } = setup()
    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    document.body.appendChild(dialog)
    act(() => pasteState.onFiles([new File(['x'], 'shot.png', { type: 'image/png' })]))
    expect(document.activeElement).not.toBe(box)
    expect(screen.getByAltText('shot.png')).toBeInTheDocument()
    dialog.remove()
  })

  it('files a feature request when the Features tab is showing', () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(<CaptureBar workspaceId="w1" onSubmit={onSubmit} kind="feature" />)
    const box = screen.getByPlaceholderText('Paste a screenshot or describe the feature')
    fireEvent.change(box, { target: { value: 'Dark mode' } })
    fireEvent.click(screen.getByRole('button', { name: 'File feature request' }))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ kind: 'feature' }))
  })

  it('Enter submits with medium severity and clears', async () => {
    const { onSubmit, box } = setup()
    fireEvent.change(box, { target: { value: '  Broken login  ' } })
    fireEvent.keyDown(box, { key: 'Enter' })
    expect(onSubmit).toHaveBeenCalledWith({
      description: 'Broken login',
      context: {
        viewport: { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio },
      },
      transcript: null,
      severity: 'medium',
      kind: 'bug',
      files: [],
    })
    expect(box.value).toBe('')
  })

  it('Shift+Enter does not submit', () => {
    const { onSubmit, box } = setup()
    fireEvent.change(box, { target: { value: 'a' } })
    fireEvent.keyDown(box, { key: 'Enter', shiftKey: true })
    expect(onSubmit).not.toHaveBeenCalled()
    expect(box.value).toBe('a')
  })

  it('restores text and toasts when submit rejects', async () => {
    const { onToast, box } = setup(vi.fn().mockRejectedValue(new Error('boom')))
    fireEvent.change(box, { target: { value: 'keep me' } })
    fireEvent.keyDown(box, { key: 'Enter' })
    await waitFor(() => expect(box.value).toBe('keep me'))
    expect(onToast).toHaveBeenCalledWith('boom')
  })

  it('keeps a newer draft and prepends the failed text when submit rejects', async () => {
    let reject: (e: Error) => void = () => {}
    const { box } = setup(vi.fn(() => new Promise<void>((_, r) => (reject = r))))
    fireEvent.change(box, { target: { value: 'first' } })
    fireEvent.keyDown(box, { key: 'Enter' })
    fireEvent.change(box, { target: { value: 'second' } })
    await act(async () => reject(new Error('boom')))
    expect(box.value).toBe('first\n\nsecond')
  })

  it('flushes late final speech into the submitted bug', async () => {
    speechState.listening = true
    const { onSubmit, box } = setup()
    fireEvent.change(box, { target: { value: 'hello' } })
    fireEvent.keyDown(box, { key: 'Enter' })
    expect(speechState.stop).toHaveBeenCalled()
    expect(onSubmit).not.toHaveBeenCalled()
    await act(async () => speechState.onFinal('world'))
    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      description: 'hello world',
      transcript: 'world',
    })
    expect(box.value).toBe('')
  })

  it('ignores a second Enter while a submit is in flight and keeps the new draft', async () => {
    let resolve: () => void = () => {}
    const { onSubmit, box } = setup(vi.fn(() => new Promise<void>((r) => (resolve = r))))
    fireEvent.change(box, { target: { value: 'once' } })
    fireEvent.keyDown(box, { key: 'Enter' })
    expect(onSubmit).toHaveBeenCalledTimes(1)
    fireEvent.change(box, { target: { value: 'next draft' } })
    fireEvent.keyDown(box, { key: 'Enter' })
    await act(async () => {})
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(box.value).toBe('next draft')
    await act(async () => resolve())
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(box.value).toBe('next draft')
  })

  it('uses severity changed during the speech flush wait', async () => {
    speechState.listening = true
    const { onSubmit, box } = setup()
    fireEvent.change(box, { target: { value: 'sev' } })
    fireEvent.keyDown(box, { key: 'Enter' })
    expect(onSubmit).not.toHaveBeenCalled()
    fireEvent.keyDown(box, { key: '1', code: 'Digit1', altKey: true })
    await act(async () => speechState.onFinal(''))
    await act(async () => new Promise((r) => setTimeout(r, 350)))
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit.mock.calls[0][0].severity).toBe('low')
  })

  it('Alt+digit changes severity', () => {
    const { onSubmit, box } = setup()
    fireEvent.change(box, { target: { value: 'x' } })
    fireEvent.keyDown(box, { key: '4', code: 'Digit4', altKey: true })
    fireEvent.keyDown(box, { key: 'Enter' })
    expect(onSubmit.mock.calls[0][0].severity).toBe('critical')
  })

  it('severity control shows the label, picks from its menu, and resets after filing', async () => {
    const { onSubmit, box } = setup()
    const send = screen.getByRole('button', { name: 'File bug' })
    expect(send).toHaveAttribute('aria-disabled', 'true')
    fireEvent.change(box, { target: { value: 'x' } })
    expect(send).not.toHaveAttribute('aria-disabled')
    fireEvent.click(screen.getByRole('button', { name: 'Severity: Medium' }))
    fireEvent.click(screen.getByRole('option', { name: /High/ }))
    expect(screen.getByRole('button', { name: 'Severity: High' })).toBeInTheDocument()
    fireEvent.click(send)
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    expect(onSubmit.mock.calls[0][0].severity).toBe('high')
    expect(screen.getByRole('button', { name: 'Severity: Medium' })).toBeInTheDocument()
  })

  it('adds and removes attachment chips, rejecting oversized files', () => {
    const { onToast } = setup()
    const input = screen.getByTestId('file-input')
    const ok = new File(['a'], 'a.png', { type: 'image/png' })
    const big = new File(['b'], 'big.png', { type: 'image/png' })
    Object.defineProperty(big, 'size', { value: 6 * 1024 * 1024 })
    fireEvent.change(input, { target: { files: [ok, big] } })
    // The size error shows inline at the bar, not as a toast.
    expect(screen.getByRole('status')).toHaveTextContent(
      'Screenshot not added: the file is over 5 MB. Try a smaller crop.',
    )
    expect(onToast).not.toHaveBeenCalled()
    expect(screen.getByAltText('a.png')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Remove a.png'))
    expect(screen.queryByLabelText('Remove a.png')).toBeNull()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:x')
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('keeps an empty live region mounted before any error', () => {
    setup()
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('clears the attach error on dismiss and on the next keystroke', () => {
    const { box } = setup()
    const big = new File(['b'], 'big.png', { type: 'image/png' })
    Object.defineProperty(big, 'size', { value: 6 * 1024 * 1024 })
    const input = screen.getByTestId('file-input')
    fireEvent.change(input, { target: { files: [big] } })
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss error' }))
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
    fireEvent.change(input, { target: { files: [big] } })
    expect(screen.getByRole('status')).toHaveTextContent('over 5 MB')
    fireEvent.change(box, { target: { value: 'x' } })
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('falls back to a toast for attach errors while the bar is hidden', () => {
    const original = HTMLElement.prototype.checkVisibility
    HTMLElement.prototype.checkVisibility = () => false
    try {
      const { onToast } = setup()
      const big = new File(['b'], 'big.png', { type: 'image/png' })
      Object.defineProperty(big, 'size', { value: 6 * 1024 * 1024 })
      fireEvent.change(screen.getByTestId('file-input'), { target: { files: [big] } })
      expect(onToast).toHaveBeenCalledWith(
        'Screenshot not added: the file is over 5 MB. Try a smaller crop.',
      )
    } finally {
      HTMLElement.prototype.checkVisibility = original
    }
  })

  it('an idle File button files nothing', () => {
    const { onSubmit } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'File bug' }))
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('shows a fixed-width Filing… state while the submit is in flight', async () => {
    let finish!: () => void
    const { box, onSubmit } = setup()
    onSubmit.mockImplementation(() => new Promise<void>((r) => (finish = r)))
    fireEvent.change(box, { target: { value: 'pending' } })
    fireEvent.keyDown(box, { key: 'Enter' })
    const send = screen.getByRole('button', { name: 'File bug' })
    await waitFor(() => expect(send).toHaveAttribute('aria-busy', 'true'))
    expect(within(send).getByText('Filing…')).not.toHaveClass('invisible')
    expect(within(send).getByText('File')).toHaveClass('invisible')
    await act(async () => finish())
    expect(send).not.toHaveAttribute('aria-busy')
    expect(within(send).getByText('Filing…')).toHaveClass('invisible')
  })

  it('hides the mic and shows an info hint when speech is unsupported', () => {
    speechState.supported = false
    setup()
    expect(screen.queryByLabelText('Start dictation')).toBeNull()
    expect(screen.getByTitle('Voice needs Chrome, Edge, or Safari')).toBeTruthy()
  })

  it.each(['png', 'jpeg', 'too-large'])('saves a staged annotation: %s', async (scenario) => {
    let loaded: HTMLImageElement | undefined
    vi.stubGlobal(
      'Image',
      class {
        constructor() {
          loaded = document.createElement('img')
          Object.defineProperties(loaded, {
            naturalWidth: { value: 100 },
            naturalHeight: { value: 100 },
          })
          return loaded
        }
      },
    )
    vi.stubGlobal('PointerEvent', MouseEvent)
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
      fillRect: vi.fn(),
    }
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      ctx as unknown as CanvasRenderingContext2D,
    )
    const oversized = new Uint8Array(MAX_ORIGINAL_BYTES + 1)
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback, type) => {
      const large = type === 'image/png' ? scenario !== 'png' : scenario === 'too-large'
      callback(new Blob([large ? oversized : 'marked'], { type }))
    })
    try {
      vi.mocked(URL.createObjectURL)
        .mockReturnValueOnce('blob:first')
        .mockReturnValueOnce('blob:second')
        .mockReturnValueOnce('blob:editor')
        .mockReturnValueOnce(scenario === 'png' ? 'blob:marked' : 'blob:conversion')
        .mockReturnValueOnce('blob:marked')
      const { box, onSubmit, onToast } = setup()
      const first = new File(['first'], 'first.png', { type: 'image/png' })
      const second = new File(['second'], 'second.png', { type: 'image/png' })
      fireEvent.change(screen.getByTestId('file-input'), { target: { files: [first, second] } })
      fireEvent.change(box, { target: { value: 'Annotated screenshot' } })
      fireEvent.click(screen.getByRole('button', { name: 'Mark up first.png' }))
      expect(screen.getByRole('dialog', { name: 'Mark up first.png' })).toHaveAttribute(
        'aria-modal',
        'true',
      )
      if (!loaded) throw new Error('Expected editor image')
      fireEvent.load(loaded)
      const canvas = screen.getByLabelText('Image annotation canvas') as HTMLCanvasElement
      canvas.setPointerCapture = vi.fn()
      canvas.releasePointerCapture = vi.fn()
      vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        width: 100,
        height: 100,
        right: 100,
        bottom: 100,
        toJSON: () => ({}),
      })
      fireEvent.pointerDown(canvas, { clientX: 10, clientY: 10, button: 0 })
      fireEvent.pointerUp(canvas, { clientX: 80, clientY: 80 })
      await act(async () => fireEvent.keyDown(window, { key: 'Enter' }))
      if (scenario !== 'png') {
        if (!loaded) throw new Error('Expected conversion image')
        await act(async () => fireEvent.load(loaded!))
      }
      if (scenario === 'too-large') {
        // The editor stays open with the marks and explains why, instead of dropping the work.
        const dialog = await screen.findByRole('dialog', { name: 'Mark up first.png' })
        await waitFor(() => expect(dialog).toHaveTextContent('too large'))
        expect(dialog).toHaveTextContent('The marked-up image is too large to upload (max 5MB).')
        expect(onToast).not.toHaveBeenCalled()
        expect(screen.getByAltText('first.png')).toHaveAttribute('src', 'blob:first')
        expect(URL.revokeObjectURL).not.toHaveBeenCalledWith('blob:first')
        fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
        const discard = screen.queryByRole('button', { name: /^Discard/ })
        if (discard) fireEvent.click(discard)
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        await act(async () => fireEvent.keyDown(box, { key: 'Enter' }))
        expect(onSubmit.mock.calls[0][0].files).toEqual([first, second])
        return
      }
      expect(onToast).not.toHaveBeenCalled()
      const name = scenario === 'png' ? 'first-marked.png' : 'first-marked.jpg'
      expect(onSubmit).not.toHaveBeenCalled()
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: `Mark up ${name}` })).toBeInTheDocument()
      expect(screen.getByAltText(name)).toHaveAttribute('src', 'blob:marked')
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:first')
      expect(screen.getAllByRole('img').map((img) => img.getAttribute('alt'))).toEqual([
        name,
        'second.png',
      ])
      await act(async () => fireEvent.keyDown(box, { key: 'Enter' }))
      const files: File[] = onSubmit.mock.calls[0][0].files
      expect(files[0].name).toBe(name)
      expect(files[0].type).toBe(scenario === 'png' ? 'image/png' : 'image/jpeg')
      expect(files[0].size).toBeLessThanOrEqual(MAX_ORIGINAL_BYTES)
      expect(files[1]).toBe(second)
    } finally {
      cleanup()
      vi.restoreAllMocks()
      vi.unstubAllGlobals()
    }
  })
})
