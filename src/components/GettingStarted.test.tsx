import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GettingStarted } from './GettingStarted'
import { BugList, type BugListProps } from './BugList'
import { isMac } from '../lib/utils'

const PASTE = isMac ? '⌘V' : 'Ctrl V'

vi.mock('../lib/supabase', () => ({ supabase: {} }))

const undone = { filed: false, invited: false, claude: false, resolved: false }
const done = { filed: true, invited: true, claude: true, resolved: true }

beforeEach(() => localStorage.clear())
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('GettingStarted', () => {
  it('renders the four unfinished steps, hints, and count', () => {
    render(<GettingStarted workspaceId="one" steps={undone} />)
    const list = screen.getByRole('list', { name: 'Getting started' })
    expect(list.querySelectorAll(':scope > li')).toHaveLength(4)
    expect(within(list).getAllByText('To do')).toHaveLength(4)
    for (const label of [
      'File your first bug',
      'Invite a teammate',
      'Connect Claude Code',
      'Resolve a bug',
    ]) {
      expect(within(list).getByText(label)).not.toHaveClass('line-through')
    }
    expect(screen.getByText('0 of 4')).toBeInTheDocument()
    // The first step carries the how-to: paste, describe, submit with ↵ (never "Enter").
    const guide = within(list).getByRole('list', { name: 'How to file' })
    expect(within(list).getByText('File your first bug').closest('li')).toContainElement(guide)
    expect(Array.from(guide.querySelectorAll('kbd'), (key) => key.textContent)).toEqual([
      PASTE,
      'N',
      '↵',
    ])
    expect(within(list).queryByText('Enter')).not.toBeInTheDocument()
    const resolve = within(list).getByText('Resolve a bug').closest('li')!
    expect(resolve).toHaveTextContent(/Press R$/)
    expect(within(resolve).getByText('R').tagName).toBe('KBD')
  })

  it('marks completed steps and updates the count as progress changes', () => {
    const { rerender } = render(<GettingStarted workspaceId="one" steps={undone} />)
    rerender(<GettingStarted workspaceId="one" steps={{ ...undone, filed: true, claude: true }} />)
    expect(screen.getByText('2 of 4')).toBeInTheDocument()
    expect(screen.getAllByText('Done')).toHaveLength(2)
    expect(screen.getAllByText('To do')).toHaveLength(2)
    expect(screen.getByText('File your first bug')).toHaveClass('line-through', 'text-muted')
    expect(screen.getByText('Connect Claude Code')).toHaveClass('line-through', 'text-muted')
    expect(screen.queryByText(PASTE)).not.toBeInTheDocument()
    rerender(<GettingStarted workspaceId="one" steps={done} />)
    expect(screen.queryByText('Get started')).not.toBeInTheDocument()
  })

  it('renders nothing when all four steps are already complete', () => {
    const { container } = render(<GettingStarted workspaceId="one" steps={done} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('calls the invite and setup callbacks', () => {
    const onInvite = vi.fn()
    const onClaudeSetup = vi.fn()
    render(
      <GettingStarted
        workspaceId="one"
        steps={undone}
        onInvite={onInvite}
        onClaudeSetup={onClaudeSetup}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Invite' }))
    fireEvent.click(screen.getByRole('button', { name: 'Set up' }))
    expect(onInvite).toHaveBeenCalledTimes(1)
    expect(onClaudeSetup).toHaveBeenCalledTimes(1)
  })

  it('persists dismissal only for the selected workspace', () => {
    const { unmount } = render(<GettingStarted workspaceId="one" steps={undone} />)
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss getting started' }))
    expect(screen.queryByText('Get started')).not.toBeInTheDocument()
    expect(localStorage.getItem('squash:getting-started:one')).toBe('true')
    unmount()
    const { rerender } = render(<GettingStarted workspaceId="one" steps={undone} />)
    expect(screen.queryByText('Get started')).not.toBeInTheDocument()
    rerender(<GettingStarted workspaceId="two" steps={undone} />)
    expect(screen.getByText('Get started')).toBeInTheDocument()
    rerender(<GettingStarted workspaceId="one" steps={undone} />)
    expect(screen.queryByText('Get started')).not.toBeInTheDocument()
  })

  it('renders and dismisses when storage reads and writes throw', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Storage unavailable')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Storage unavailable')
    })
    render(<GettingStarted workspaceId="one" steps={undone} />)
    expect(screen.getByText('Get started')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss getting started' }))
    expect(screen.queryByText('Get started')).not.toBeInTheDocument()
  })
})

function RoutedList(props: Partial<BugListProps>) {
  return (
    <MemoryRouter initialEntries={['/app/one']}>
      <Routes>
        <Route
          path="/app/:workspaceId"
          element={
            <BugList
              bugs={[]}
              loading={false}
              counts={{ open: 0, resolved: 0, all: 0 }}
              filters={{
                kind: 'bug',
                tab: 'open',
                query: '',
                filedBy: null,
                resolvedBy: null,
                assignee: null,
                severity: null,
                sort: 'newest',
              }}
              onFilters={vi.fn()}
              selectedId={null}
              onSelect={vi.fn()}
              members={[]}
              viewersOf={() => []}
              highlightIds={new Set()}
              {...props}
            />
          }
        />
      </Routes>
    </MemoryRouter>
  )
}

describe('BugList getting started integration', () => {
  it('makes the checklist the only onboarding in an empty workspace and forwards actions', () => {
    const onInvite = vi.fn()
    const onClaudeSetup = vi.fn()
    render(<RoutedList onInvite={onInvite} onClaudeSetup={onClaudeSetup} />)
    const list = screen.getByRole('list', { name: 'Getting started' })
    expect(screen.getByText('0 of 4')).toBeInTheDocument()
    // "File your first bug" appears once: as the checklist step, not again as an empty state.
    expect(screen.getAllByText(/File your first bug/)).toHaveLength(1)
    expect(screen.queryByRole('heading', { name: 'File your first bug' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('list', { name: 'How to file' })).toHaveLength(1)
    fireEvent.click(within(list).getByRole('button', { name: 'Invite' }))
    fireEvent.click(within(list).getByRole('button', { name: 'Set up' }))
    expect(onInvite).toHaveBeenCalledTimes(1)
    expect(onClaudeSetup).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss getting started' }))
    expect(localStorage.getItem('squash:getting-started:one')).toBe('true')
    // Dismissed: the plain empty state takes over, with the same how-to.
    expect(screen.getByRole('heading', { name: 'File your first bug' })).toBeInTheDocument()
    expect(screen.getAllByRole('list', { name: 'How to file' })).toHaveLength(1)
  })

  it('leaves the onboarding to the detail pane when it shows there', () => {
    render(<RoutedList onboardingInDetail />)
    expect(screen.queryByRole('list', { name: 'Getting started' })).not.toBeInTheDocument()
    expect(screen.queryByText(/File your first bug/)).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('No bugs yet.')
  })

  it('derives progress from membership and the Claude connection', () => {
    const members = ['founder', 'teammate'].map((user_id) => ({
      workspace_id: 'one',
      user_id,
      role: 'member' as const,
      joined_at: '2026-10-01T00:00:00Z',
      profile: {
        id: user_id,
        display_name: user_id,
        avatar_url: null,
        avatar_color: 'var(--color-accent)',
        created_at: '2026-10-01T00:00:00Z',
      },
    }))
    const { rerender } = render(<RoutedList members={members.slice(0, 1)} />)
    expect(screen.getByText('0 of 4')).toBeInTheDocument()
    rerender(<RoutedList members={members} claudeConnected />)
    expect(screen.getByText('2 of 4')).toBeInTheDocument()
    expect(screen.getByText('Invite a teammate', { selector: 'span' })).toHaveClass('line-through')
  })

  it('waits for the list to finish loading', () => {
    render(<RoutedList loading />)
    expect(screen.queryByRole('list', { name: 'Getting started' })).not.toBeInTheDocument()
  })
})
