import { createRef, useState } from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BugFilters } from '../hooks/useBugs'
import { useSignedUrl } from '../hooks/useSignedUrl'
import type { BugWithMeta, WorkspaceMember } from '../lib/types'
import * as bugExport from '../lib/export'
import { BugList } from './BugList'
import type { BugListProps } from './BugList'

vi.mock('../lib/supabase', () => ({ supabase: {} }))
vi.mock('../hooks/useSignedUrl', () => ({ useSignedUrl: vi.fn(() => null) }))
vi.mock('../hooks/useWorkspaces', () => ({
  useWorkspaces: () => ({
    workspaces: [
      { id: 'other-workspace', name: 'Other Team' },
      { id: 'workspace', name: 'Acme Team' },
    ],
  }),
}))

const filters: BugFilters = {
  kind: 'bug',
  tab: 'open',
  filedBy: null,
  resolvedBy: null,
  severity: null,
  query: '',
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

describe('BugList', () => {
  beforeEach(() => {
    vi.mocked(useSignedUrl).mockReturnValue(null)
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

  it.each(['CSV', 'Markdown'])('offers %s export for the visible bugs and workspace', (format) => {
    const download = vi.spyOn(bugExport, 'downloadText').mockImplementation(() => {})
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Resolved 1' }))
    fireEvent.click(screen.getByRole('button', { name: 'Export' }))
    expect(screen.getByRole('menuitem', { name: 'CSV' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Markdown' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('menuitem', { name: format }))
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
        '⌘V',
        'type',
        'Enter',
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
    fireEvent.change(screen.getByRole('combobox', { name: 'Filed by' }), {
      target: { value: 'grace' },
    })
    expect(screen.queryByRole('option', { name: '#1 Broken login' })).not.toBeInTheDocument()
    fireEvent.change(screen.getByRole('combobox', { name: 'Resolved by' }), {
      target: { value: 'ada' },
    })
    expect(screen.getByRole('option', { name: '#2 Fixed layout' })).toBeInTheDocument()
    fireEvent.change(screen.getByRole('combobox', { name: 'Severity' }), {
      target: { value: 'high' },
    })
    expect(screen.getByRole('heading', { name: 'No matches' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(screen.getByRole('button', { name: 'All 2' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(screen.getByRole('listbox')).getAllByRole('option')).toHaveLength(2)
    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument()
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
    expect(searchRef.current).toHaveAttribute('placeholder', 'Search  /')
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
    expect(within(open).getByTitle('High severity')).toHaveClass('bg-sev-high')
    expect(within(open).getByTitle('Filed by Ada')).toBeInTheDocument()
    expect(open.querySelector('time')).toHaveAttribute('datetime', bugs[0].created_at)
    const resolved = screen.getByRole('option', { name: '#2 Fixed layout' })
    expect(resolved).toHaveClass('opacity-60')
    expect(within(resolved).getByTitle('Resolved by Ada')).toBeInTheDocument()
  })

  it('prefers signed attachments for saved rows and pending previews for optimistic rows', () => {
    vi.mocked(useSignedUrl).mockReturnValue('https://example.test/signed')
    const attachment = {
      id: 'image',
      bug_id: 'open',
      storage_path: 'workspace/open/image.webp',
      width: 32,
      height: 32,
      size_bytes: 100,
      created_at: bugs[0].created_at,
    }
    const pending = [{ localId: 'pending', previewUrl: 'blob:preview', progress: 0 }]
    const { rerender } = render(<Harness bugs={[bug({ attachments: [attachment], pending })]} />)
    expect(useSignedUrl).toHaveBeenCalledWith(attachment.storage_path)
    expect(screen.getByAltText('Screenshot preview')).toHaveAttribute(
      'src',
      'https://example.test/signed',
    )
    rerender(
      <Harness
        bugs={[
          bug({
            optimistic: true,
            number: 0,
            attachments: [attachment],
            pending,
          }),
        ]}
      />,
    )
    expect(screen.getByAltText('Screenshot preview')).toHaveAttribute('src', 'blob:preview')
    const row = screen.getByRole('option', { name: '#… Broken login' })
    expect(within(row).getByText('#…')).toBeInTheDocument()
    expect(within(row).queryByText('#0')).not.toBeInTheDocument()
    vi.mocked(useSignedUrl).mockReturnValue(null)
    rerender(<Harness bugs={[bug({ pending })]} />)
    expect(screen.getByAltText('Screenshot preview')).toHaveAttribute('src', 'blob:preview')
    vi.mocked(useSignedUrl).mockReturnValue('https://example.test/signed')
    rerender(<Harness bugs={[bug({ optimistic: true, attachments: [attachment] })]} />)
    expect(screen.getByAltText('Screenshot preview')).toHaveAttribute(
      'src',
      'https://example.test/signed',
    )
  })

  it('updates highlight and viewer presence from props', () => {
    const viewersOf = vi.fn(() => [
      { user_id: 'grace', viewing: 'open', online_at: bugs[0].created_at },
    ])
    const { rerender } = render(<Harness highlightIds={new Set(['open'])} viewersOf={viewersOf} />)
    const row = screen.getByRole('option', { name: '#1 Broken login' })
    expect(row).toHaveClass('bg-accent/10')
    expect(viewersOf).toHaveBeenCalledWith('open')
    expect(within(row).getByTitle('Grace is viewing').firstChild).toHaveClass('ring-green-500')
    rerender(<Harness />)
    expect(row).not.toHaveClass('bg-accent/10')
    expect(screen.queryByLabelText('Currently viewing')).not.toBeInTheDocument()
  })
})
