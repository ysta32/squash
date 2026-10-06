import { createRef, useState } from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BugFilters } from '../hooks/useBugs'
import { useSignedUrl } from '../hooks/useSignedUrl'
import type { BugWithMeta, WorkspaceMember } from '../lib/types'
import { BugList } from './BugList'
import type { BugListProps } from './BugList'

vi.mock('../lib/supabase', () => ({ supabase: {} }))
vi.mock('../hooks/useSignedUrl', () => ({ useSignedUrl: vi.fn(() => null) }))

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
    render(<Harness bugs={[]} filters={{ ...filters, kind: 'feature' }} />)
    expect(screen.getByText('No open feature requests.')).toBeInTheDocument()
  })

  it.each([
    ['open', 'No open bugs. Ship it.'],
    ['resolved', 'Nothing resolved yet.'],
    ['all', 'File your first bug above.'],
  ] as const)('shows the %s empty state', (tab, message) => {
    render(<Harness bugs={[]} filters={{ ...filters, tab }} />)
    expect(screen.getByText(message)).toBeInTheDocument()
  })

  it('shows six skeleton rows while loading and hides stale rows and empty messages', () => {
    render(<Harness loading />)
    const status = screen.getByRole('status', { name: 'Loading bugs' })
    expect(status.querySelectorAll(':scope > div[aria-hidden="true"]')).toHaveLength(6)
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(screen.queryByText('No open bugs. Ship it.')).not.toBeInTheDocument()
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
    expect(screen.getByText('No bugs match.')).toBeInTheDocument()
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
    expect(screen.getByText('No bugs match.')).toBeInTheDocument()
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
    expect(within(open).getByTitle('High severity')).toHaveClass('bg-amber-500')
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
