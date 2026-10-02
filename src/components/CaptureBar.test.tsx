import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { CaptureBar } from './CaptureBar'

const speechState = vi.hoisted(() => ({
  supported: true,
  listening: false,
  onFinal: (_t: string) => {},
  onInterim: (_t: string) => {},
}))

vi.mock('../hooks/useSpeech', () => ({
  useSpeech: (opts: { onFinal: (t: string) => void; onInterim: (t: string) => void }) => {
    speechState.onFinal = opts.onFinal
    speechState.onInterim = opts.onInterim
    return {
      supported: speechState.supported,
      listening: speechState.listening,
      start: () => {},
      stop: () => {},
      toggle: () => {},
      error: null,
    }
  },
}))

vi.mock('../hooks/usePasteImage', () => ({ usePasteImage: () => {} }))

function setup(onSubmit = vi.fn().mockResolvedValue(undefined), onToast = vi.fn()) {
  render(<CaptureBar workspaceId="w1" onSubmit={onSubmit} onToast={onToast} />)
  return { onSubmit, onToast, box: screen.getByPlaceholderText('Describe the bug…') as HTMLTextAreaElement }
}

describe('CaptureBar', () => {
  beforeEach(() => {
    speechState.supported = true
    speechState.listening = false
    URL.createObjectURL = vi.fn(() => 'blob:x')
    URL.revokeObjectURL = vi.fn()
  })
  afterEach(cleanup)

  it('Enter submits with medium severity and clears', async () => {
    const { onSubmit, box } = setup()
    fireEvent.change(box, { target: { value: '  Broken login  ' } })
    fireEvent.keyDown(box, { key: 'Enter' })
    expect(onSubmit).toHaveBeenCalledWith({
      description: 'Broken login',
      transcript: null,
      severity: 'medium',
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
