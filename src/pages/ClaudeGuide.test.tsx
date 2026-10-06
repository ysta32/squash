import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
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
})

describe('ClaudeGuide', () => {
  it('shows the install and uninstall commands for this site', () => {
    setup()
    const origin = window.location.origin
    expect(screen.getByLabelText('Install command')).toHaveValue(
      `curl -fsSL ${origin}/bridge/install.sh | sh -s -- ${origin}`,
    )
    expect(screen.getByLabelText('Uninstall command')).toHaveValue(
      `curl -fsSL ${origin}/bridge/install.sh | sh -s -- --uninstall`,
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
    [{ version: 4, platform: 'darwin' }, /up to date/],
  ])('reports %o', async (status, text) => {
    pingBridge.mockResolvedValue(status)
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'Check this computer' }))
    expect(await screen.findByText(text)).toBeInTheDocument()
  })
})
