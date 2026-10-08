import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ClaudeSettings, SETUP_POLL_MS } from './ClaudeSettings'

const mocks = vi.hoisted(() => ({
  pingBridge: vi.fn(),
  getBridgeFolder: vi.fn(),
}))

vi.mock('../../lib/claudeExport', () => ({
  BRIDGE_VERSION: 2,
  HARDENED_VERSION: 6,
  pingBridge: () => mocks.pingBridge(),
  getBridgeFolder: (id: string) => mocks.getBridgeFolder(id),
}))

// The real guide has its own tests; this stand-in shows the status it is handed.
vi.mock('../ClaudeSetupDialog', () => ({
  ClaudeSetupDialog: ({
    open,
    status,
    onClose,
  }: {
    open: boolean
    status: { version: number } | null
    onClose: () => void
  }) =>
    open ? (
      <div role="dialog" aria-label="Setup guide">
        {status ? `Connected v${status.version}` : 'Waiting'}
        <button onClick={onClose}>Close guide</button>
      </div>
    ) : null,
}))

const RUNNING = { version: 6, platform: 'darwin' }

function show() {
  render(
    <MemoryRouter>
      <ClaudeSettings workspaceId="ws" workspaceName="Lumen" />
    </MemoryRouter>,
  )
}

/** Lets pending probe promises settle under fake timers. */
async function flush() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  mocks.pingBridge.mockReset().mockResolvedValue(null)
  mocks.getBridgeFolder.mockReset().mockResolvedValue('/Users/maya/lumen')
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('ClaudeSettings', () => {
  it('polls the helper while the setup guide is open, so it leaves "Waiting" by itself', async () => {
    show()
    await flush()
    expect(screen.getByText('Not running on this computer.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Set up' }))
    await flush()
    expect(screen.getByRole('dialog', { name: 'Setup guide' })).toHaveTextContent('Waiting')

    // The helper gets installed in a terminal while the guide is open.
    mocks.pingBridge.mockResolvedValue(RUNNING)
    const before = mocks.pingBridge.mock.calls.length
    await act(async () => {
      vi.advanceTimersByTime(SETUP_POLL_MS)
    })
    await flush()
    expect(mocks.pingBridge.mock.calls.length).toBeGreaterThan(before)
    expect(screen.getByRole('dialog', { name: 'Setup guide' })).toHaveTextContent('Connected v6')
    expect(screen.getByText(/^Connected · helper v6 · macOS$/)).toBeInTheDocument()
    expect(screen.getByText('/Users/maya/lumen')).toBeInTheDocument()
  })

  it('does not poll while the guide is closed, but rechecks when the window regains focus', async () => {
    show()
    await flush()
    const afterMount = mocks.pingBridge.mock.calls.length
    await act(async () => {
      vi.advanceTimersByTime(SETUP_POLL_MS * 4)
    })
    expect(mocks.pingBridge).toHaveBeenCalledTimes(afterMount)

    mocks.pingBridge.mockResolvedValue(RUNNING)
    act(() => {
      window.dispatchEvent(new Event('focus'))
    })
    await flush()
    expect(mocks.pingBridge).toHaveBeenCalledTimes(afterMount + 1)
    expect(screen.getByText(/^Connected · helper v6/)).toBeInTheDocument()
  })

  it('stops polling once the guide closes', async () => {
    show()
    await flush()
    fireEvent.click(screen.getByRole('button', { name: 'Set up' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close guide' }))
    await flush()
    const afterClose = mocks.pingBridge.mock.calls.length
    await act(async () => {
      vi.advanceTimersByTime(SETUP_POLL_MS * 4)
    })
    expect(mocks.pingBridge).toHaveBeenCalledTimes(afterClose)
  })

  it('keeps a slow, older answer from overwriting a newer one', async () => {
    show()
    await flush()
    let resolveSlow: (value: null) => void = () => {}
    mocks.pingBridge.mockReturnValueOnce(new Promise((resolve) => (resolveSlow = resolve)))
    fireEvent.click(screen.getByRole('button', { name: 'Check again' }))
    expect(screen.getByText('Checking this computer…')).toBeInTheDocument()
    // A focus check starts later and answers first.
    mocks.pingBridge.mockResolvedValue(RUNNING)
    act(() => {
      window.dispatchEvent(new Event('focus'))
    })
    await flush()
    expect(screen.getByText(/^Connected · helper v6/)).toBeInTheDocument()
    await act(async () => resolveSlow(null))
    await flush()
    expect(screen.getByText(/^Connected · helper v6/)).toBeInTheDocument()
  })
})
