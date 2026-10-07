import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, act } from '@testing-library/react'
import { StatsPopover } from './StatsPopover'
import { ShortcutsSheet } from './ShortcutsSheet'
import { Lightbox } from './Lightbox'

interface Row {
  user_id: string
  filed_total: number
  resolved_total: number
  filed_7d: number
  resolved_7d: number
}
type Result = { data: Row[]; error: null }

const rpc = vi.fn<(name: string, args: { p_workspace_id: string }) => Promise<Result>>()
vi.mock('../lib/supabase', () => ({
  supabase: { rpc: (name: string, args: { p_workspace_id: string }) => rpc(name, args) },
}))

const row = (n: number): Row => ({
  user_id: 'u',
  filed_total: n,
  resolved_total: 0,
  filed_7d: 0,
  resolved_7d: 0,
})

describe('StatsPopover', () => {
  afterEach(() => {
    cleanup()
    rpc.mockReset()
  })

  it('focuses the dialog, traps Tab, and restores focus on unmount', async () => {
    rpc.mockResolvedValue({ data: [], error: null })
    const trigger = render(<button>Stats</button>)
    const opener = screen.getByRole('button', { name: 'Stats' })
    opener.focus()
    const { unmount } = render(<StatsPopover workspaceId="a" members={[]} />)
    const dialog = screen.getByRole('dialog', { name: 'Team stats' })
    expect(document.activeElement).toBe(dialog)
    await screen.findByText('No activity yet.')
    expect(fireEvent.keyDown(dialog, { key: 'Tab' })).toBe(false)
    expect(document.activeElement).toBe(dialog)
    expect(fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })).toBe(false)
    expect(document.activeElement).toBe(dialog)
    unmount()
    expect(document.activeElement).toBe(opener)
    trigger.unmount()
  })

  it('ignores stale responses and shows skeleton on workspace change', async () => {
    const resolvers: Record<string, (r: Result) => void> = {}
    rpc.mockImplementation(
      (_n, args) =>
        new Promise<Result>((res) => {
          resolvers[args.p_workspace_id] = res
        }),
    )
    const { rerender } = render(<StatsPopover workspaceId="a" members={[]} />)
    rerender(<StatsPopover workspaceId="b" members={[]} />)
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull()

    await act(async () => {
      resolvers.a({ data: [row(111)], error: null })
    })
    expect(screen.queryByText(/111/)).toBeNull()
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull()

    await act(async () => {
      resolvers.b({ data: [row(222)], error: null })
    })
    await waitFor(() => expect(screen.getByText(/222/)).toBeTruthy())
    expect(document.querySelector('[aria-busy="true"]')).toBeNull()
  })
})

describe('dialog focus lifecycle', () => {
  afterEach(cleanup)

  it('focuses ShortcutsSheet on open, traps Tab, and restores focus on close', () => {
    render(<button>Shortcuts</button>)
    const opener = screen.getByRole('button', { name: 'Shortcuts' })
    opener.focus()
    const onClose = vi.fn()
    const { rerender } = render(<ShortcutsSheet open={false} onClose={onClose} />)
    expect(document.activeElement).toBe(opener)
    rerender(<ShortcutsSheet open onClose={onClose} />)
    const close = screen.getByRole('button', { name: 'Close' })
    expect(document.activeElement).toBe(close)
    expect(fireEvent.keyDown(close, { key: 'Tab' })).toBe(false)
    expect(document.activeElement).toBe(close)
    expect(fireEvent.keyDown(close, { key: 'Tab', shiftKey: true })).toBe(false)
    expect(document.activeElement).toBe(close)
    fireEvent.keyDown(close, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
    rerender(<ShortcutsSheet open={false} onClose={onClose} />)
    expect(document.activeElement).toBe(opener)
  })

  it('focuses Lightbox on open, wraps Tab in both directions, and restores focus on close', () => {
    render(<button>Screenshots</button>)
    const opener = screen.getByRole('button', { name: 'Screenshots' })
    opener.focus()
    const onClose = vi.fn()
    const onIndex = vi.fn()
    const { rerender, unmount } = render(
      <Lightbox urls={[]} index={0} onClose={onClose} onIndex={onIndex} />,
    )
    expect(document.activeElement).toBe(opener)
    rerender(
      <Lightbox urls={['/one.png', '/two.png']} index={0} onClose={onClose} onIndex={onIndex} />,
    )
    const close = screen.getByRole('button', { name: 'Close' })
    const next = screen.getByRole('button', { name: 'Next screenshot' })
    expect(document.activeElement).toBe(close)
    expect(fireEvent.keyDown(close, { key: 'Tab', shiftKey: true })).toBe(false)
    expect(document.activeElement).toBe(next)
    expect(fireEvent.keyDown(next, { key: 'Tab' })).toBe(false)
    expect(document.activeElement).toBe(close)
    fireEvent.keyDown(close, { key: 'ArrowRight' })
    expect(onIndex).toHaveBeenCalledWith(1)
    fireEvent.click(close)
    expect(onClose).toHaveBeenCalledOnce()
    unmount()
    expect(document.activeElement).toBe(opener)
  })
})
