import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type * as ClaudeExport from '../lib/claudeExport'
import ClaudeGuide from './ClaudeGuide'

const pingBridge = vi.fn()
vi.mock('../lib/supabase', () => ({ supabase: {} }))
vi.mock('../lib/claudeExport', async (load) => ({
  ...(await load<typeof ClaudeExport>()),
  pingBridge: () => pingBridge(),
}))

function setup() {
  return render(
    <MemoryRouter>
      <ClaudeGuide />
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
  pingBridge.mockReset()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('ClaudeGuide', () => {
  it('shows the install and uninstall commands for this site', () => {
    setup()
    const origin = window.location.origin
    expect(screen.getByLabelText('Install command').textContent).toBe(
      `curl -fsSL ${origin}/bridge/install.sh | sh -s -- ${origin}`,
    )
    expect(screen.getByLabelText('Uninstall command').textContent).toBe(
      `curl -fsSL ${origin}/bridge/install.sh | sh -s -- --uninstall`,
    )
  })

  it.each(['Install command', 'Uninstall command'])('copies the %s', async (label) => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    setup()
    const block = within(screen.getByRole('group', { name: `${label} block` }))
    fireEvent.click(block.getByRole('button', { name: 'Copy' }))
    expect(await block.findByRole('button', { name: 'Copied' })).toBeInTheDocument()
    expect(writeText).toHaveBeenCalledExactlyOnceWith(screen.getByLabelText(label).textContent)
  })

  it('resets the copied confirmation after two seconds', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
    setup()
    const block = within(screen.getByRole('group', { name: 'Install command block' }))
    await act(async () => {
      fireEvent.click(block.getByRole('button', { name: 'Copy' }))
    })
    expect(block.getByRole('button', { name: 'Copied' })).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(2000))
    expect(block.getByRole('button', { name: 'Copy' })).toBeInTheDocument()
  })

  it('offers manual copying after a clipboard error and clears the error on retry', async () => {
    const writeText = vi
      .fn()
      .mockRejectedValueOnce(new Error('Permission denied'))
      .mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    setup()
    const block = within(screen.getByRole('group', { name: 'Install command block' }))
    fireEvent.click(block.getByRole('button', { name: 'Copy' }))
    expect(await block.findByRole('alert')).toHaveTextContent(
      'Select the command and copy it manually.',
    )
    expect(block.queryByRole('button', { name: 'Copied' })).not.toBeInTheDocument()
    fireEvent.click(block.getByRole('button', { name: 'Copy' }))
    expect(await block.findByRole('button', { name: 'Copied' })).toBeInTheDocument()
    expect(block.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('offers manual copying when the clipboard API is unavailable', async () => {
    vi.stubGlobal('navigator', {})
    setup()
    const block = within(screen.getByRole('group', { name: 'Install command block' }))
    fireEvent.click(block.getByRole('button', { name: 'Copy' }))
    expect(await block.findByRole('alert')).toHaveTextContent(
      'Select the command and copy it manually.',
    )
  })

  it('only reaches the helper after asking, then reports its version', async () => {
    pingBridge.mockResolvedValue({ version: 2, platform: 'darwin' })
    setup()
    expect(pingBridge).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Check this computer' }))
    expect(await screen.findByText(/Helper v2 is running/)).toBeInTheDocument()
  })

  it.each([
    [null, /No helper found/],
    [{ version: 3, platform: 'darwin' }, /resolves bugs on its own/],
    [
      { version: 4, platform: 'darwin' },
      /pins screenshot downloads to this app’s Supabase storage host/,
    ],
    [{ version: 5, platform: 'darwin' }, /pins screenshot downloads/],
    [{ version: 6, platform: 'darwin' }, /records its commit, branch, pull request and diff/],
    [{ version: 7, platform: 'darwin' }, /up to date/],
  ])('reports %o', async (status, text) => {
    pingBridge.mockResolvedValue(status)
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'Check this computer' }))
    expect(await screen.findByText(text)).toBeInTheDocument()
  })
})
