import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { CaptureBar } from './CaptureBar'

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
    box: screen.getByPlaceholderText('Describe the bug…') as HTMLTextAreaElement,
  }
}

describe('CaptureBar', () => {
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

  it('files a feature request when the Features tab is showing', () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(<CaptureBar workspaceId="w1" onSubmit={onSubmit} kind="feature" />)
    const box = screen.getByPlaceholderText('Describe the feature…')
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

  it('adds and removes attachment chips, rejecting oversized files', () => {
    const { onToast } = setup()
    const input = screen.getByTestId('file-input')
    const ok = new File(['a'], 'a.png', { type: 'image/png' })
    const big = new File(['b'], 'big.png', { type: 'image/png' })
    Object.defineProperty(big, 'size', { value: 6 * 1024 * 1024 })
    fireEvent.change(input, { target: { files: [ok, big] } })
    expect(onToast).toHaveBeenCalledWith('Image too large (max 5MB)')
    fireEvent.click(screen.getByLabelText('Remove a.png'))
    expect(screen.queryByLabelText('Remove a.png')).toBeNull()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:x')
  })

  it('hides the mic and shows an info hint when speech is unsupported', () => {
    speechState.supported = false
    setup()
    expect(screen.queryByLabelText('Start dictation')).toBeNull()
    expect(screen.getByTitle('Voice needs Chrome, Edge, or Safari')).toBeTruthy()
  })
})
