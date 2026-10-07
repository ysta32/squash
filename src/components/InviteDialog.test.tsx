import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { InviteDialog } from './InviteDialog'
import type { Workspace } from '../lib/types'

vi.mock('../hooks/useWorkspaces', () => ({
  inviteUrl: (code: string) => `https://squash.test/join/${code}`,
  friendlyError: (e: unknown) => (e instanceof Error ? e.message : 'unknown'),
}))

const workspace: Workspace = {
  id: 'ws',
  name: 'Acme',
  owner_id: 'u1',
  invite_code: 'ABC123',
  created_at: '',
}

function setup(props: Partial<React.ComponentProps<typeof InviteDialog>> = {}) {
  const onClose = vi.fn()
  const utils = render(
    <InviteDialog workspace={workspace} open onClose={onClose} canRegenerate={false} {...props} />,
  )
  return { onClose, ...utils }
}

const writeText = vi.fn()

beforeEach(() => {
  writeText.mockReset()
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  })
  Object.defineProperty(navigator, 'share', { configurable: true, value: undefined })
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('InviteDialog', () => {
  it('renders nothing when closed', () => {
    setup({ open: false })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows the invite link and code', () => {
    setup()
    expect(screen.getByLabelText('Invite link')).toHaveValue('https://squash.test/join/ABC123')
    expect(screen.getByText('ABC123')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Invite to Acme' })).toBeInTheDocument()
  })

  it('copies the link, shows confirmation, then resets', async () => {
    vi.useFakeTimers()
    writeText.mockResolvedValue(undefined)
    setup()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy link' }))
    })
    expect(writeText).toHaveBeenCalledWith('https://squash.test/join/ABC123')
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(screen.getByRole('button', { name: 'Copy link' })).toBeInTheDocument()
  })

  it('shows an error when the clipboard write fails', async () => {
    writeText.mockRejectedValue(new Error('denied'))
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not copy')
    expect(screen.queryByRole('button', { name: 'Copied' })).not.toBeInTheDocument()
  })

  it('only offers Share when the Web Share API exists, and ignores AbortError', async () => {
    const { unmount } = setup()
    expect(screen.queryByRole('button', { name: 'Share' })).not.toBeInTheDocument()
    unmount()
    const share = vi.fn().mockRejectedValue(new DOMException('cancelled', 'AbortError'))
    Object.defineProperty(navigator, 'share', { configurable: true, value: share })
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'Share' }))
    await vi.waitFor(() =>
      expect(share).toHaveBeenCalledWith({
        title: 'Join Acme on Squash',
        url: 'https://squash.test/join/ABC123',
      }),
    )
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('reports non-abort share failures', async () => {
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: vi.fn().mockRejectedValue(new Error('share broke')),
    })
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'Share' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('share broke')
  })

  it('hides Regenerate unless allowed', () => {
    setup({ canRegenerate: false, onRegenerate: vi.fn() })
    expect(screen.queryByRole('button', { name: /Regenerate/ })).not.toBeInTheDocument()
  })

  it('requires confirmation before regenerating and then shows the new code', async () => {
    const onRegenerate = vi.fn().mockResolvedValue('NEW999')
    setup({ canRegenerate: true, onRegenerate })
    fireEvent.click(screen.getByRole('button', { name: /Regenerate/ }))
    expect(onRegenerate).not.toHaveBeenCalled()
    expect(screen.getByText(/invalidates the current link/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Yes, regenerate' }))
    expect(await screen.findByText('NEW999')).toBeInTheDocument()
    expect(onRegenerate).toHaveBeenCalledTimes(1)
    expect(screen.getByLabelText('Invite link')).toHaveValue('https://squash.test/join/NEW999')
    expect(screen.queryByText(/invalidates the current link/)).not.toBeInTheDocument()
  })

  it('cancel aborts regeneration', () => {
    const onRegenerate = vi.fn()
    setup({ canRegenerate: true, onRegenerate })
    fireEvent.click(screen.getByRole('button', { name: /Regenerate/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onRegenerate).not.toHaveBeenCalled()
    expect(screen.getByText('ABC123')).toBeInTheDocument()
  })

  it('keeps the old code and shows an error when regeneration fails', async () => {
    const onRegenerate = vi.fn().mockRejectedValue(new Error('nope'))
    setup({ canRegenerate: true, onRegenerate })
    fireEvent.click(screen.getByRole('button', { name: /Regenerate/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Yes, regenerate' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('nope')
    expect(screen.getByText('ABC123')).toBeInTheDocument()
  })

  it('closes via Escape, the close button and the backdrop but not panel clicks', () => {
    const { onClose } = setup()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(2)
    fireEvent.click(screen.getByRole('dialog'))
    expect(onClose).toHaveBeenCalledTimes(2)
    fireEvent.click(screen.getByRole('dialog').parentElement as HTMLElement)
    expect(onClose).toHaveBeenCalledTimes(3)
  })
})
