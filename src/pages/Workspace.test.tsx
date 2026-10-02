import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { ToastProvider } from '../components/Toast'
import type { Bug, BugWithMeta, Workspace as WorkspaceRow, WorkspaceMember } from '../lib/types'
import { useRef, type ReactNode } from 'react'
import type * as UseBugsModule from '../hooks/useBugs'
import { useDismiss } from '../hooks/useDismiss'
import Workspace from './Workspace'

const NOW = new Date().toISOString()

const mocks = vi.hoisted(() => ({
  bugs: [] as BugWithMeta[],
  notFound: false,
  onRemoteInsert: null as ((bug: Bug) => void) | null,
  setLastWorkspace: vi.fn(),
  getBugByNumber: vi.fn(),
}))

const workspace: WorkspaceRow = {
  id: 'ws',
  name: 'Acme',
  invite_code: 'INVITE01',
  owner_id: 'u1',
  created_at: NOW,
}

const members: WorkspaceMember[] = [
  {
    workspace_id: 'ws',
    user_id: 'u1',
    role: 'owner',
    joined_at: NOW,
    profile: {
      id: 'u1',
      display_name: 'Ada',
      avatar_url: null,
      avatar_color: '#f00',
      created_at: NOW,
    },
  },
  {
    workspace_id: 'ws',
    user_id: 'u2',
    role: 'member',
    joined_at: NOW,
    profile: {
      id: 'u2',
      display_name: 'Grace',
      avatar_url: null,
      avatar_color: '#00f',
      created_at: NOW,
    },
  },
]

vi.mock('../lib/supabase', () => ({ supabase: {} }))
vi.mock('../lib/auth', () => ({
  useAuth: () => ({ user: { id: 'u1' }, profile: members[0].profile, loading: false }),
}))
vi.mock('../hooks/useWorkspaces', () => ({
  setLastWorkspace: mocks.setLastWorkspace,
  useWorkspaces: () => ({ workspaces: [workspace], loading: false, error: null }),
  useWorkspace: () => ({
    workspace: mocks.notFound ? null : workspace,
    members,
    role: 'owner',
    loading: false,
    notFound: mocks.notFound,
    regenerateInviteCode: vi.fn(),
  }),
}))
vi.mock('../hooks/useBugs', async (importOriginal) => {
  const actual = await importOriginal<typeof UseBugsModule>()
  return {
    filterBugs: actual.filterBugs,
    useBugs: (_ws: string, opts?: { onRemoteInsert?: (bug: Bug) => void }) => {
      mocks.onRemoteInsert = opts?.onRemoteInsert ?? null
      return {
        bugs: mocks.bugs,
        loading: false,
        counts: { open: mocks.bugs.length, resolved: 0, all: mocks.bugs.length },
        fileBug: vi.fn(),
        updateBug: vi.fn(),
        resolveBug: vi.fn(),
        reopenBug: vi.fn(),
        retryUploads: vi.fn(),
        getBugByNumber: mocks.getBugByNumber,
      }
    },
  }
})
vi.mock('../hooks/useBug', () => ({
  useBug: () => ({ comments: [], events: [], addComment: vi.fn(), loading: false }),
}))
vi.mock('../hooks/useSignedUrl', () => ({ useSignedUrl: () => null }))
vi.mock('../hooks/usePresence', () => ({
  usePresence: () => ({ online: [], viewers: () => [] }),
}))
vi.mock('../hooks/useRealtimeStatus', () => ({ useRealtimeStatus: () => 'connected' }))
vi.mock('../components/Header', () => ({
  Header: ({ onInvite }: { onInvite: () => void }) => (
    <header>
      <button type="button" onClick={onInvite}>
        Invite
      </button>
    </header>
  ),
}))
vi.mock('../components/CaptureBar', () => ({
  CaptureBar: ({ focusRef }: { focusRef?: { current: HTMLTextAreaElement | null } }) => (
    <textarea
      aria-label="Capture"
      ref={(el) => {
        if (focusRef) focusRef.current = el
      }}
    />
  ),
}))

function makeBug(n: number, over: Partial<BugWithMeta> = {}): BugWithMeta {
  return {
    id: `b${n}`,
    workspace_id: 'ws',
    number: n,
    title: `Bug number ${n}`,
    description: '',
    transcript: null,
    severity: 'medium',
    status: 'open',
    filed_by: 'u1',
    created_at: NOW,
    resolved_by: null,
    resolved_at: null,
    resolution_note: null,
    updated_at: NOW,
    attachments: [],
    ...over,
  }
}

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="path">{location.pathname}</output>
}

/** Stand-in for a Header menu: an open popover dismissed by Esc through useDismiss. */
function OpenMenu({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useDismiss(ref, onClose)
  return <div ref={ref}>menu</div>
}

function show(path: string, extra?: ReactNode) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <ToastProvider>
        <Routes>
          <Route path="/app/:workspaceId" element={<Workspace />} />
          <Route path="/app/:workspaceId/bug/:number" element={<Workspace />} />
          <Route path="/app" element={<p>Workspace picker</p>} />
        </Routes>
        <LocationProbe />
        {extra}
      </ToastProvider>
    </MemoryRouter>,
  )
}

const path = () => screen.getByTestId('path').textContent
const press = (key: string, target: Element = document.body) => fireEvent.keyDown(target, { key })

beforeEach(() => {
  // jsdom has no layout; BugRow scrolls the selected row into view.
  Element.prototype.scrollIntoView = vi.fn()
  mocks.bugs = [makeBug(3), makeBug(2), makeBug(1)]
  mocks.notFound = false
  mocks.onRemoteInsert = null
  mocks.getBugByNumber.mockResolvedValue(null)
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.useRealTimers()
})

describe('Workspace', () => {
  it('J/K move the selection through the filtered list', () => {
    show('/app/ws/bug/2')
    expect(screen.getByDisplayValue('Bug number 2')).toBeInTheDocument()

    press('j')
    expect(path()).toBe('/app/ws/bug/1')
    expect(screen.getByDisplayValue('Bug number 1')).toBeInTheDocument()

    press('j') // already at the end
    expect(path()).toBe('/app/ws/bug/1')

    press('k')
    press('k')
    expect(path()).toBe('/app/ws/bug/3')
  })

  it('J selects the first visible bug when nothing is selected, skipping filtered-out bugs', () => {
    mocks.bugs = [makeBug(3, { status: 'resolved' }), makeBug(2), makeBug(1)]
    show('/app/ws')
    press('j')
    expect(path()).toBe('/app/ws/bug/2')
  })

  it('ignores shortcuts while typing in an input', () => {
    show('/app/ws/bug/2')
    press('j', screen.getByLabelText('Capture'))
    expect(path()).toBe('/app/ws/bug/2')
  })

  it('R opens the resolve popover for a selected open bug; O does not', () => {
    show('/app/ws/bug/2')
    expect(screen.queryByRole('dialog')).toBeNull()
    press('o')
    expect(screen.queryByRole('dialog')).toBeNull()
    press('r')
    expect(screen.getByRole('dialog', { name: 'Resolve bug' })).toBeInTheDocument()
  })

  it('O opens the reopen popover for a selected resolved bug', () => {
    mocks.bugs = [makeBug(2, { status: 'resolved', resolved_by: 'u1', resolved_at: NOW })]
    show('/app/ws/bug/2')
    press('r')
    expect(screen.queryByRole('dialog')).toBeNull()
    press('o')
    expect(screen.getByRole('dialog', { name: 'Reopen bug' })).toBeInTheDocument()
  })

  it('suspends navigation shortcuts while any dialog is open', () => {
    show('/app/ws/bug/2')
    const overlay = document.createElement('div')
    overlay.setAttribute('role', 'dialog')
    document.body.appendChild(overlay)
    try {
      press('j')
      press('k')
      press('n')
      expect(path()).toBe('/app/ws/bug/2')
      expect(document.activeElement).toBe(document.body)
    } finally {
      overlay.remove()
    }
    press('j')
    expect(path()).toBe('/app/ws/bug/1')
  })

  it('suspends shortcuts while the resolve popover is open', () => {
    show('/app/ws/bug/2')
    press('r')
    expect(screen.getByRole('dialog', { name: 'Resolve bug' })).toBeInTheDocument()
    ;(document.activeElement as HTMLElement).blur()
    press('j')
    expect(path()).toBe('/app/ws/bug/2')
  })

  it('Esc consumed by an open menu does not also close the mobile detail', () => {
    const onClose = vi.fn()
    show('/app/ws/bug/2', <OpenMenu onClose={onClose} />)
    press('Escape')
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(path()).toBe('/app/ws/bug/2')
  })

  it('Esc closes the mobile detail when nothing else handles it', () => {
    show('/app/ws/bug/2')
    press('Escape')
    expect(path()).toBe('/app/ws')
  })

  it('N from the mobile detail returns to the list and focuses capture after commit', () => {
    show('/app/ws/bug/2')
    press('n')
    expect(path()).toBe('/app/ws')
    expect(document.activeElement).toBe(screen.getByLabelText('Capture'))
  })

  it('N focuses the capture box and ? opens the shortcut sheet', () => {
    show('/app/ws')
    press('n')
    expect(document.activeElement).toBe(screen.getByLabelText('Capture'))
    ;(document.activeElement as HTMLElement).blur()
    fireEvent.keyDown(document.body, { key: '?', shiftKey: true })
    expect(screen.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeInTheDocument()
  })

  it('remote inserts toast the filer and highlight the row', () => {
    vi.useFakeTimers()
    show('/app/ws')
    expect(mocks.setLastWorkspace).toHaveBeenCalledWith('ws')
    const remote = makeBug(4, { filed_by: 'u2' })
    mocks.bugs = [remote, ...mocks.bugs]
    act(() => mocks.onRemoteInsert?.(remote))
    expect(screen.getByText('Grace filed #4')).toBeInTheDocument()
    const row = screen.getByRole('option', { name: '#4 Bug number 4' })
    expect(row).toHaveClass('bg-accent/10')
    act(() => vi.advanceTimersByTime(4000))
    expect(screen.queryByText('Grace filed #4')).toBeNull()
    expect(row).not.toHaveClass('bg-accent/10')
  })

  it('shows a not-found message for an unknown bug number', async () => {
    show('/app/ws/bug/99')
    expect(await screen.findByText('Bug #99 not found')).toBeInTheDocument()
    expect(mocks.getBugByNumber).toHaveBeenCalledWith(99)
  })

  it('tells non-members they are not in the workspace', () => {
    mocks.notFound = true
    show('/app/ws')
    expect(screen.getByText("You're not a member of this workspace")).toBeInTheDocument()
  })
})
