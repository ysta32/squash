import { createRef, useState } from 'react'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BugFilters } from '../hooks/useBugs'
import type { BugWithMeta, WorkspaceMember } from '../lib/types'
import * as bugExport from '../lib/export'
import { isMac } from '../lib/utils'
import { BugList } from './BugList'
import type { BugListProps } from './BugList'

vi.mock('../lib/supabase', () => ({ supabase: {} }))

const filters: BugFilters = {
  kind: 'bug',
  tab: 'open',
  filedBy: null,
  resolvedBy: null,
  assignee: null,
  severity: null,
  query: '',
  sort: 'newest',
}
const members: WorkspaceMember[] = ['Ada', 'Grace'].map((name) => ({
  workspace_id: 'workspace',
  user_id: name.toLowerCase(),
  role: 'member',
  joined_at: '2026-10-01T10:00:00Z',
  profile: {
    id: name.toLowerCase(),
    display_name: name,
    avatar_url: null,
    avatar_color: '#7c3aed',
    created_at: '2026-10-01T10:00:00Z',
  },
}))

function bug(overrides: Partial<BugWithMeta> = {}): BugWithMeta {
  return {
    id: 'open',
    workspace_id: 'workspace',
    number: 1,
    title: 'Broken login',
    description: 'Password form fails',
    transcript: null,
    severity: 'high',
    status: 'open',
    kind: 'bug',
    filed_by: 'ada',
    created_at: '2026-10-01T10:00:00Z',
    resolved_by: null,
    resolved_at: null,
    resolution_note: null,
    assignee_id: null,
    updated_at: '2026-10-01T10:00:00Z',
    attachments: [],
    ...overrides,
  }
}

const bugs = [
  bug(),
  bug({
    id: 'resolved',
    number: 2,
    title: 'Fixed layout',
    status: 'resolved',
    severity: 'low',
    filed_by: 'grace',
    resolved_by: 'ada',
  }),
]
const scrollIntoView = vi.fn()

function Harness(props: Partial<BugListProps>) {
  const [currentFilters, setFilters] = useState(props.filters ?? filters)
  return (
    <BugList
      bugs={bugs}
      workspaceName="Acme Team"
      loading={false}
      counts={{ open: 1, resolved: 1, all: 2 }}
      selectedId={null}
      onSelect={vi.fn()}
      members={members}
      viewersOf={() => []}
      highlightIds={new Set()}
      {...props}
      filters={currentFilters}
      onFilters={(next) => {
        setFilters(next)
        props.onFilters?.(next)
      }}
    />
  )
}

/** Opens the Filter popover unless it is already open. */
function openFilters() {
  if (screen.queryByRole('dialog', { name: 'Filters' })) return
  fireEvent.click(screen.getByRole('button', { name: /^Filter(,|$)/ }))
}

/** A filter row's trigger inside the Filter popover, opening the popover first. */
function filterButton(name: string | RegExp) {
  openFilters()
  return screen.getByRole('button', { name })
}

/** Opens the filter menu named `label` in the Filter popover and picks `option` from its listbox. */
function pickFilter(label: string, option: string) {
  openFilters()
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${label}(:|$)`) }))
  fireEvent.click(
    within(screen.getByRole('listbox', { name: label })).getByRole('option', { name: option }),
  )
}

describe('BugList', () => {
  it('shows a load error and retries instead of showing an empty list', () => {
    const onRetry = vi.fn()
    render(
      <MemoryRouter>
        <Harness bugs={[]} error="Couldn't load bugs" onRetry={onRetry} />
      </MemoryRouter>,
    )
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load bugs")
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('listbox', { name: 'Bugs' })).not.toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('keeps saved rows usable after a failed refresh and offers retry in a status banner', () => {
    const onRetry = vi.fn()
    const onSelect = vi.fn()
    const { rerender } = render(<Harness onRetry={onRetry} onSelect={onSelect} />)
    rerender(<Harness error="Couldn't load bugs" onRetry={onRetry} onSelect={onSelect} />)

    const banner = screen.getByRole('status')
    expect(banner).toHaveTextContent("Couldn't refresh — showing saved results")
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    const row = within(screen.getByRole('listbox', { name: 'Bugs' })).getByRole('option', {
      name: '#1 Broken login',
    })
    fireEvent.click(row)
    expect(onSelect).toHaveBeenCalledWith('open')
    fireEvent.click(within(banner).getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalledTimes(1)

    rerender(<Harness onRetry={onRetry} onSelect={onSelect} />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByRole('option', { name: '#1 Broken login' })).toBeInTheDocument()
  })

  it('shows the refresh banner when saved bugs are excluded by the current filter', () => {
    render(<Harness error="Couldn't load bugs" filters={{ ...filters, query: 'no match' }} />)
    expect(
      screen.getByText("Couldn't refresh — showing saved results").closest('[role="status"]'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByRole('option')).not.toBeInTheDocument()
  })

  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    })
  })
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  it('marks checklist steps from the whole workspace, not the current tab', () => {
    render(
      <MemoryRouter initialEntries={['/app/ws-1']}>
        <Routes>
          <Route
            path="/app/:workspaceId"
            element={
              <Harness
                filters={{ ...filters, kind: 'feature' }}
                counts={{ open: 0, resolved: 0, all: 0 }}
              />
            }
          />
        </Routes>
      </MemoryRouter>,
    )
    const list = screen.getByRole('list', { name: 'Getting started' })
    const filed = within(list).getByText('File your first bug').closest('li')!
    const resolved = within(list).getByText('Resolve a bug').closest('li')!
    expect(within(filed).getByText('Done')).toBeInTheDocument()
    expect(within(resolved).getByText('Done')).toBeInTheDocument()
  })

  it.each(['CSV', 'Markdown'])('offers %s export for the visible bugs and workspace', (format) => {
    const download = vi.spyOn(bugExport, 'downloadText').mockImplementation(() => {})
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Resolved 1' }))
    fireEvent.click(screen.getByRole('button', { name: 'List actions' }))
    expect(screen.getByRole('menuitem', { name: 'Export as CSV' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Export as Markdown' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('menuitem', { name: `Export as ${format}` }))
    expect(download).toHaveBeenCalledWith(
      expect.stringMatching(
        format === 'CSV'
          ? /^squash-acme-team-\d{4}-\d{2}-\d{2}\.csv$/
          : /^squash-acme-team-\d{4}-\d{2}-\d{2}\.md$/,
      ),
      expect.stringContaining('Fixed layout'),
      format === 'CSV' ? 'text/csv;charset=utf-8' : 'text/markdown;charset=utf-8',
    )
    expect(download.mock.calls[0][1]).not.toContain('Broken login')
    if (format === 'Markdown') {
      expect(download.mock.calls[0][1]).toContain('# Acme Team bugs')
    }
  })

  it('renders open rows by default and switches status tabs using counts from props', () => {
    render(<Harness counts={{ open: 8, resolved: 4, all: 12 }} />)
    expect(screen.getByRole('button', { name: 'Open 8' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('option', { name: '#1 Broken login' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: '#2 Fixed layout' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Resolved 4' }))
    expect(screen.getByRole('option', { name: '#2 Fixed layout' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: '#1 Broken login' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'All 12' }))
    expect(within(screen.getByRole('listbox')).getAllByRole('option')).toHaveLength(2)
  })

  it('switches between Bugs and Features', () => {
    const onFilters = vi.fn()
    const feature = bug({ id: 'feat', number: 3, title: 'Dark mode', kind: 'feature' })
    render(
      <Harness
        bugs={[...bugs, feature]}
        openByKind={{ bug: 1, feature: 1 }}
        onFilters={onFilters}
      />,
    )
    expect(screen.getByRole('tab', { name: /Bugs/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByRole('option', { name: '#3 Dark mode' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: /Features/ }))
    expect(onFilters).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'feature' }))
    expect(screen.getByRole('option', { name: '#3 Dark mode' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: '#1 Broken login' })).not.toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: 'Search features' })).toBeInTheDocument()
  })

  it('shows feature wording when there are no feature requests', () => {
    render(
      <Harness
        bugs={[]}
        counts={{ open: 0, resolved: 0, all: 0 }}
        filters={{ ...filters, kind: 'feature' }}
      />,
    )
    expect(
      screen.getByRole('heading', { name: 'File your first feature request' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Paste a screenshot anywhere, describe your feature request, press Enter.'),
    ).toBeInTheDocument()
  })

  it.each([
    ['open', 'File your first bug'],
    ['resolved', 'Nothing resolved yet'],
    ['all', 'File your first bug'],
  ] as const)('shows the %s empty state', (tab, message) => {
    render(
      <Harness bugs={[]} counts={{ open: 0, resolved: 0, all: 0 }} filters={{ ...filters, tab }} />,
    )
    expect(screen.getByRole('heading', { name: message })).toBeInTheDocument()
    if (tab === 'resolved') {
      expect(screen.queryByRole('list', { name: 'How to file' })).not.toBeInTheDocument()
    } else {
      expect(
        screen.getByText("Paste a screenshot anywhere, describe what's wrong, press Enter."),
      ).toBeInTheDocument()
      const guide = screen.getByRole('list', { name: 'How to file' })
      expect(within(guide).getAllByRole('listitem')).toHaveLength(3)
      expect(Array.from(guide.querySelectorAll('kbd'), (key) => key.textContent)).toEqual([
        isMac ? '⌘V' : 'Ctrl V',
        'N',
        '↵',
      ])
    }
  })

  it.each(['bug', 'feature'] as const)('shows a resolved backlog for %s items', (kind) => {
    render(
      <Harness
        bugs={[bug({ kind, status: 'resolved' })]}
        counts={{ open: 0, resolved: 1, all: 1 }}
        filters={{ ...filters, kind }}
      />,
    )
    expect(screen.getByRole('heading', { name: 'Nothing open' })).toBeInTheDocument()
    expect(
      screen.getByText(
        `Every ${kind === 'feature' ? 'feature request' : 'bug'} here has been resolved.`,
      ),
    ).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'How to file' })).not.toBeInTheDocument()
  })

  it('shows the resolved empty state when only open bugs exist', () => {
    render(
      <Harness
        bugs={[bug()]}
        counts={{ open: 1, resolved: 0, all: 1 }}
        filters={{ ...filters, tab: 'resolved' }}
      />,
    )
    expect(screen.getByRole('heading', { name: 'Nothing resolved yet' })).toBeInTheDocument()
  })

  it.each(['bug', 'feature'] as const)(
    'clears all unmatched %s filters and preserves kind and tab',
    (kind) => {
      const onFilters = vi.fn()
      render(
        <Harness
          bugs={[bug({ kind })]}
          counts={{ open: 1, resolved: 0, all: 1 }}
          filters={{
            ...filters,
            kind,
            tab: 'all',
            query: 'missing',
            filedBy: 'grace',
            resolvedBy: 'ada',
            assignee: 'grace',
            severity: 'low',
          }}
          onFilters={onFilters}
        />,
      )
      expect(screen.getByRole('heading', { name: 'No matches' })).toBeInTheDocument()
      expect(
        screen.getByText(
          `No ${kind === 'feature' ? 'feature requests' : 'bugs'} match these filters.`,
        ),
      ).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
      expect(onFilters).toHaveBeenLastCalledWith({ ...filters, kind, tab: 'all' })
      expect(screen.getByRole('option', { name: '#1 Broken login' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument()
    },
  )

  it('prioritizes unmatched filters in a new workspace', () => {
    render(
      <Harness
        bugs={[]}
        counts={{ open: 0, resolved: 0, all: 0 }}
        filters={{ ...filters, query: 'missing' }}
      />,
    )
    expect(screen.getByRole('heading', { name: 'No matches' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(screen.getByRole('heading', { name: 'File your first bug' })).toBeInTheDocument()
  })

  it('shows six skeleton rows while loading and hides stale rows and empty messages', () => {
    render(<Harness loading />)
    const status = screen.getByRole('status', { name: 'Loading bugs' })
    expect(status.querySelectorAll(':scope > div[aria-hidden="true"]')).toHaveLength(6)
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  })

  it('searches descriptions and bug numbers and reports unmatched queries', () => {
    render(<Harness filters={{ ...filters, tab: 'all' }} />)
    const search = screen.getByRole('searchbox')
    fireEvent.change(search, { target: { value: '#2' } })
    expect(screen.getByRole('option', { name: '#2 Fixed layout' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: '#1 Broken login' })).not.toBeInTheDocument()
    fireEvent.change(search, { target: { value: 'Password' } })
    expect(screen.getByRole('option', { name: '#1 Broken login' })).toBeInTheDocument()
    fireEvent.change(search, { target: { value: 'no match' } })
    expect(screen.getByRole('heading', { name: 'No matches' })).toBeInTheDocument()
  })

  it('combines member and severity filters and clears them while preserving the tab', () => {
    render(<Harness filters={{ ...filters, tab: 'all' }} />)
    pickFilter('Filed by', 'Grace')
    expect(filterButton('Filed by: Grace')).toHaveAttribute('aria-haspopup', 'listbox')
    expect(screen.queryByRole('option', { name: '#1 Broken login' })).not.toBeInTheDocument()
    pickFilter('Resolved by', 'Ada')
    expect(screen.getByRole('option', { name: '#2 Fixed layout' })).toBeInTheDocument()
    pickFilter('Severity', 'High')
    expect(filterButton('Severity: High')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'No matches' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(screen.getByRole('button', { name: 'All 2' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(screen.getByRole('listbox')).getAllByRole('option')).toHaveLength(2)
    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument()
    expect(filterButton('Filed by')).toBeInTheDocument()
  })

  it('clears a single filter from its chip', () => {
    const onFilters = vi.fn()
    render(<Harness filters={{ ...filters, tab: 'all', severity: 'low' }} onFilters={onFilters} />)
    expect(within(screen.getByRole('listbox')).getAllByRole('option')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Clear Severity filter' }))
    expect(onFilters).toHaveBeenLastCalledWith({ ...filters, tab: 'all' })
    expect(within(screen.getByRole('listbox')).getAllByRole('option')).toHaveLength(2)
    expect(filterButton('Severity')).toBeInTheDocument()
  })

  it('operates filter menus from the keyboard', () => {
    render(<Harness filters={{ ...filters, tab: 'all' }} />)
    const trigger = filterButton('Severity')
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    const menu = screen.getByRole('listbox', { name: 'Severity' })
    expect(menu).toHaveFocus()
    expect(trigger).toHaveAttribute('aria-controls', menu.id)
    const active = () => document.getElementById(menu.getAttribute('aria-activedescendant')!)
    expect(active()).toHaveAccessibleName('Any severity')
    expect(active()).toHaveAttribute('aria-selected', 'true')
    fireEvent.keyDown(menu, { key: 'ArrowDown' })
    expect(active()).toHaveAccessibleName('Low')
    fireEvent.keyDown(menu, { key: 'End' })
    expect(active()).toHaveAccessibleName('Critical')
    fireEvent.keyDown(menu, { key: 'ArrowDown' })
    expect(active()).toHaveAccessibleName('Critical')
    fireEvent.keyDown(menu, { key: 'Home' })
    fireEvent.keyDown(menu, { key: 'ArrowDown' })
    fireEvent.keyDown(menu, { key: 'Enter' })
    expect(screen.queryByRole('listbox', { name: 'Severity' })).not.toBeInTheDocument()
    const chosen = filterButton('Severity: Low')
    expect(chosen).toHaveFocus()
    expect(screen.getByRole('option', { name: '#2 Fixed layout' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: '#1 Broken login' })).not.toBeInTheDocument()

    fireEvent.click(chosen)
    const reopened = screen.getByRole('listbox', { name: 'Severity' })
    expect(within(reopened).getByRole('option', { name: 'Low' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    act(() => {
      reopened.dispatchEvent(escape)
    })
    expect(escape.defaultPrevented).toBe(true)
    expect(screen.queryByRole('listbox', { name: 'Severity' })).not.toBeInTheDocument()
    expect(chosen).toHaveFocus()
    expect(chosen).toHaveAttribute('aria-expanded', 'false')
  })

  it('closes a filter menu on an outside pointer press without changing the filter', () => {
    const onFilters = vi.fn()
    render(<Harness onFilters={onFilters} />)
    fireEvent.click(filterButton('Filed by'))
    expect(screen.getByRole('listbox', { name: 'Filed by' })).toBeInTheDocument()
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('listbox', { name: 'Filed by' })).not.toBeInTheDocument()
    expect(onFilters).not.toHaveBeenCalled()
  })

  it('filters by assignee: Me first, then Unassigned, and clears with the other filters', () => {
    const assigned = [
      bug({ assignee_id: 'grace' }),
      bug({ id: 'mine', number: 2, title: 'Slow search', assignee_id: 'ada' }),
      bug({ id: 'nobody', number: 3, title: 'Typo on pricing' }),
    ]
    render(<Harness bugs={assigned} selfId="ada" />)
    fireEvent.click(filterButton('Assignee'))
    expect(
      within(screen.getByRole('listbox', { name: 'Assignee' }))
        .getAllByRole('option')
        .map((o) => o.getAttribute('aria-label')),
    ).toEqual(['Anyone', 'Unassigned', 'Me', 'Grace'])
    fireEvent.click(filterButton('Assignee'))
    const rows = () =>
      within(screen.getByRole('listbox', { name: /bugs/i }))
        .getAllByRole('option')
        .map((o) => o.getAttribute('aria-label'))

    pickFilter('Assignee', 'Me')
    expect(rows()).toEqual(['#2 Slow search'])
    pickFilter('Assignee', 'Unassigned')
    expect(filterButton('Assignee: Unassigned')).toBeInTheDocument()
    expect(rows()).toEqual(['#3 Typo on pricing'])
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(filterButton('Assignee')).not.toHaveAttribute('aria-expanded', 'true')
    expect(
      (openFilters(), screen.queryByRole('button', { name: /^Assignee:/ })),
    ).not.toBeInTheDocument()
    expect(rows()).toHaveLength(3)
  })

  it('asks once before sending every bug in view to Claude Code', () => {
    const onSend = vi.fn()
    render(<Harness filters={{ ...filters, tab: 'all' }} onSend={onSend} />)
    const send = () => screen.getByRole('button', { name: 'Send 2 to Claude Code' })
    fireEvent.click(send())
    expect(onSend).not.toHaveBeenCalled()
    expect(screen.getByText(/Start Claude Code on/)).toHaveTextContent(
      'Start Claude Code on 2 bugs?',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(send()).toHaveFocus()
    fireEvent.click(send())
    fireEvent.keyDown(screen.getByRole('button', { name: 'Send' }), { key: 'Escape' })
    expect(screen.queryByText(/Start Claude Code on/)).not.toBeInTheDocument()
    expect(send()).toHaveFocus()
    expect(onSend).not.toHaveBeenCalled()
    fireEvent.click(send())
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(onSend).toHaveBeenCalledTimes(1)
    expect(onSend.mock.calls[0][0]).toHaveLength(2)
    expect(send()).toHaveFocus()
    // The footer only labels the view when it differs from the tab count.
    expect(screen.queryByText(/in view/)).not.toBeInTheDocument()
  })

  it('sends a single bug in view without confirming and labels a narrowed view', () => {
    const onSend = vi.fn()
    render(<Harness filters={{ ...filters, tab: 'all', severity: 'low' }} onSend={onSend} />)
    expect(screen.getByText('1 bug in view')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Send 1 to Claude Code' }))
    expect(onSend).toHaveBeenCalledWith([expect.objectContaining({ id: 'resolved' })])
  })

  it('switches status from the narrow-pane status menu', () => {
    render(<Harness />)
    // The segmented control and the menu swap on the list pane's width (a container query), not
    // the viewport's: the desktop pane is 400–480px wide at any window size.
    expect(screen.getByRole('region', { name: 'Bug list' })).toHaveClass('@container')
    expect(screen.getByRole('group', { name: 'Bug status' })).toHaveClass(
      'hidden',
      '@min-[440px]:flex',
    )
    expect(
      screen.getByRole('button', { name: 'Status: Open' }).parentElement?.parentElement,
    ).toHaveClass('@min-[440px]:hidden')
    fireEvent.click(screen.getByRole('button', { name: 'Status: Open' }))
    const menu = screen.getByRole('menu', { name: 'Status' })
    const open = within(menu).getByRole('menuitemradio', { name: /^Open/ })
    expect(open).toHaveAttribute('aria-checked', 'true')
    expect(open).toHaveFocus()
    fireEvent.keyDown(open, { key: 'ArrowDown' })
    const resolved = within(menu).getByRole('menuitemradio', { name: /^Resolved/ })
    expect(resolved).toHaveFocus()
    fireEvent.click(resolved)
    expect(screen.queryByRole('menu', { name: 'Status' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Status: Resolved' })).toHaveFocus()
    expect(screen.getByRole('button', { name: 'Resolved 1' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('shows the open count only on the inactive kind tab', () => {
    render(<Harness openByKind={{ bug: 1, feature: 3 }} />)
    expect(screen.getByRole('tab', { name: 'Bugs' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Features 3' })).toHaveAttribute(
      'aria-selected',
      'false',
    )
  })

  it('binds the external search ref and clears and blurs on Escape', () => {
    const searchRef = createRef<HTMLInputElement>()
    const onFilters = vi.fn()
    const { container } = render(
      <Harness
        searchRef={searchRef}
        onFilters={onFilters}
        filters={{ ...filters, query: 'login' }}
      />,
    )
    expect(searchRef.current).toBe(screen.getByRole('searchbox'))
    expect(searchRef.current).toHaveAttribute('placeholder', 'Search')
    expect(searchRef.current?.parentElement?.querySelector('kbd')).toHaveTextContent('/')
    searchRef.current?.focus()
    const shortcut = vi.fn()
    container.addEventListener('keydown', shortcut)
    document.addEventListener('keydown', shortcut)
    try {
      fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Escape' })
      expect(shortcut).not.toHaveBeenCalled()
    } finally {
      container.removeEventListener('keydown', shortcut)
      document.removeEventListener('keydown', shortcut)
    }
    expect(screen.getByRole('searchbox')).toHaveValue('')
    expect(screen.getByRole('searchbox')).not.toHaveFocus()
    expect(onFilters).toHaveBeenLastCalledWith(filters)
  })

  it('selects rows and scrolls each newly selected row into view', () => {
    const onSelect = vi.fn()
    const { rerender } = render(
      <Harness filters={{ ...filters, tab: 'all' }} onSelect={onSelect} />,
    )
    fireEvent.click(screen.getByRole('option', { name: '#1 Broken login' }))
    expect(onSelect).toHaveBeenCalledWith('open')
    rerender(<Harness filters={{ ...filters, tab: 'all' }} selectedId="open" onSelect={onSelect} />)
    expect(screen.getByRole('option', { name: '#1 Broken login' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByRole('option', { name: '#1 Broken login' })).toHaveClass(
      'bg-accent-tint',
      'shadow-[inset_2px_0_0_var(--accent)]',
    )
    expect(screen.getByRole('option', { name: '#2 Fixed layout' })).not.toHaveClass(
      'bg-accent-tint',
    )
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' })
    expect(scrollIntoView.mock.instances[0]).toBe(
      screen.getByRole('option', { name: '#1 Broken login' }),
    )
    rerender(
      <Harness filters={{ ...filters, tab: 'all' }} selectedId="resolved" onSelect={onSelect} />,
    )
    expect(scrollIntoView.mock.instances[1]).toBe(
      screen.getByRole('option', { name: '#2 Fixed layout' }),
    )
  })

  it('renders severity, filer, timestamp and muted resolved rows with resolver', () => {
    render(<Harness filters={{ ...filters, tab: 'all' }} />)
    const open = screen.getByRole('option', { name: '#1 Broken login' })
    const ticks = within(open).getByRole('img', { name: 'High severity' })
    expect(ticks).toHaveAttribute('title', 'High severity')
    expect(ticks.querySelectorAll('.bg-sev-high')).toHaveLength(3)
    expect(within(open).getByTitle('Filed by Ada')).toBeInTheDocument()
    expect(open.querySelector('time')).toHaveAttribute('datetime', bugs[0].created_at)
    const resolved = screen.getByRole('option', { name: '#2 Fixed layout' })
    expect(resolved).toHaveAttribute('data-status', 'resolved')
    expect(within(resolved).getByTitle('Fixed layout')).toHaveClass(
      'text-ink-3',
      'after:scale-x-100',
    )
    expect(within(open).getByTitle('Broken login')).toHaveClass('text-ink', 'after:scale-x-0')
    expect(within(resolved).getByTitle('Resolved by Ada')).toBeInTheDocument()
    expect(within(resolved).getByLabelText('Resolved')).toBeInTheDocument()
    expect(within(resolved).getByTitle('Filed by Grace')).toBeInTheDocument()
    expect(within(open).queryByLabelText('Resolved')).not.toBeInTheDocument()
  })

  it('summarizes screenshots as a muted icon with a count instead of thumbnails', () => {
    const attachment = (id: string) => ({
      id,
      bug_id: 'open',
      storage_path: `workspace/open/${id}.webp`,
      width: 32,
      height: 32,
      size_bytes: 100,
      created_at: bugs[0].created_at,
    })
    const pending = [{ localId: 'pending', previewUrl: 'blob:preview', progress: 0 }]
    const { rerender } = render(<Harness bugs={[bug({ attachments: [attachment('a')] })]} />)
    let row = screen.getByRole('option', { name: '#1 Broken login' })
    expect(row.querySelector('img')).toBeNull()
    expect(within(row).getByLabelText('1 screenshot')).toBeInTheDocument()
    expect(within(row).getByTitle('1 screenshot')).not.toHaveTextContent('1')

    rerender(<Harness bugs={[bug({ attachments: [attachment('a'), attachment('b')], pending })]} />)
    row = screen.getByRole('option', { name: '#1 Broken login' })
    expect(within(row).getByLabelText('3 screenshots')).toBeInTheDocument()
    expect(within(row).getByTitle('Uploading screenshots')).toHaveTextContent('3')

    rerender(
      <Harness
        bugs={[
          bug({
            optimistic: true,
            number: 0,
            pending: [{ ...pending[0], error: 'Upload failed.' }],
          }),
        ]}
      />,
    )
    row = screen.getByRole('option', { name: '#… Broken login' })
    expect(within(row).getByText('#…')).toBeInTheDocument()
    expect(within(row).queryByText('#0')).not.toBeInTheDocument()
    expect(within(row).getByTitle('A screenshot failed to upload')).toHaveClass('text-danger')

    rerender(<Harness bugs={[bug()]} />)
    row = screen.getByRole('option', { name: '#1 Broken login' })
    expect(within(row).queryByLabelText(/screenshot/)).not.toBeInTheDocument()
  })

  it('updates highlight and viewer presence from props', () => {
    const viewersOf = vi.fn(() => [
      { user_id: 'grace', viewing: 'open', online_at: bugs[0].created_at },
    ])
    const { rerender } = render(<Harness highlightIds={new Set(['open'])} viewersOf={viewersOf} />)
    const row = screen.getByRole('option', { name: '#1 Broken login' })
    expect(row).toHaveAttribute('data-highlighted', 'true')
    expect(viewersOf).toHaveBeenCalledWith('open')
    const viewing = within(row).getByLabelText('Currently viewing')
    expect(within(row).getByTitle('Grace is viewing')).toBe(viewing)
    // Viewers sit in the meta column, before the time; the person stays pinned right.
    expect(viewing.nextElementSibling).toBe(row.querySelector('time'))
    expect(row.querySelector('time')?.nextElementSibling).toBe(
      within(row).getByTitle('Filed by Ada'),
    )
    rerender(<Harness />)
    expect(row).not.toHaveAttribute('data-highlighted')
    expect(screen.queryByLabelText('Currently viewing')).not.toBeInTheDocument()
  })
})
