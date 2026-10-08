import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { FixRun } from '../lib/fixRuns'
import type { BugEvent, BugWithMeta, Comment, WorkspaceMember } from '../lib/types'
import { BugDetail } from './BugDetail'

const addComment = vi.fn<(body: string) => Promise<void>>()
const editComment = vi.fn<(id: string, body: string) => Promise<void>>()
const deleteComment = vi.fn<(id: string) => Promise<void>>()
const thread: { comments: Comment[]; events: BugEvent[] } = { comments: [], events: [] }

vi.mock('../hooks/useBug', () => ({
  useBug: () => ({ ...thread, addComment, editComment, deleteComment, loading: false }),
}))
vi.mock('../hooks/useSignedUrl', () => ({
  useSignedUrl: (path: string | null) => (path ? `https://cdn.test/${path}` : null),
}))
// Fix runs have their own tests (FixRecord.test.tsx); by default the server has none.
const fixRuns = vi.hoisted(() => ({
  runs: [] as FixRun[],
  available: false,
  bugIds: [] as (string | null)[],
}))
vi.mock('../hooks/useFixRuns', () => ({
  useFixRuns: (bugId: string | null) => {
    fixRuns.bugIds.push(bugId)
    return { runs: fixRuns.runs, loading: false, available: fixRuns.available, error: null }
  },
}))

const NOW = new Date().toISOString()

const members: WorkspaceMember[] = [
  {
    workspace_id: 'w1',
    user_id: 'u1',
    role: 'owner',
    joined_at: NOW,
    profile: {
      id: 'u1',
      display_name: 'Ada Lovelace',
      avatar_url: null,
      avatar_color: '#f00',
      created_at: NOW,
    },
  },
  {
    workspace_id: 'w1',
    user_id: 'u2',
    role: 'member',
    joined_at: NOW,
    profile: {
      id: 'u2',
      display_name: 'Grace Hopper',
      avatar_url: null,
      avatar_color: '#00f',
      created_at: NOW,
    },
  },
]

function makeBug(over: Partial<BugWithMeta> = {}): BugWithMeta {
  return {
    id: 'b1',
    workspace_id: 'w1',
    number: 42,
    title: 'Login button broken',
    description: 'Clicking login does nothing',
    transcript: null,
    severity: 'high',
    status: 'open',
    kind: 'bug',
    filed_by: 'u1',
    created_at: NOW,
    resolved_by: null,
    resolved_at: null,
    resolution_note: null,
    assignee_id: null,
    updated_at: NOW,
    attachments: [],
    ...over,
  }
}

function attachment(id: string) {
  return {
    id,
    bug_id: 'b1',
    storage_path: `w1/b1/${id}.webp`,
    width: 10,
    height: 10,
    size_bytes: 1,
    created_at: NOW,
  }
}

/** Opens the … menu and returns the named item (or null when `optional` and it is absent). */
function menuItem(name: string, optional = false): HTMLElement | null {
  fireEvent.click(screen.getByRole('button', { name: 'More actions' }))
  const menu = screen.getByRole('menu', { name: 'More actions' })
  return optional
    ? within(menu).queryByRole('menuitem', { name })
    : within(menu).getByRole('menuitem', { name })
}

function openMenuItem(name: string) {
  const item = menuItem(name)
  if (!item) throw new Error(`no menu item ${name}`)
  fireEvent.click(item)
}

function setup(bug: BugWithMeta | null, extra: Partial<Parameters<typeof BugDetail>[0]> = {}) {
  const handlers = {
    onUpdate: vi.fn(),
    onResolve: vi.fn(),
    onReopen: vi.fn(),
    onBack: vi.fn(),
  }
  const utils = render(
    <BugDetail bug={bug} members={members} selfId="u1" {...handlers} {...extra} />,
  )
  return { ...handlers, ...utils }
}

describe('BugDetail', () => {
  it('shows a context label with a safe external URL', () => {
    setup(
      makeBug({
        context: {
          url: 'https://example.com/checkout',
          viewport: { w: 1440, h: 900, dpr: 2 },
          browser: 'Chrome 131',
          os: 'macOS',
        },
      }),
    )
    expect(screen.getByLabelText('Bug context')).toHaveTextContent(
      'example.com/checkout · 1440×900 @2x · Chrome 131 · macOS',
    )
    const link = screen.getByRole('link', { name: 'example.com/checkout' })
    expect(link).toHaveAttribute('href', 'https://example.com/checkout')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })
  it.each([null, {}, { url: 'javascript:alert(1)' }])(
    'hides empty or invalid context %j',
    (context) => {
      setup(makeBug({ context }))
      expect(screen.queryByLabelText('Bug context')).not.toBeInTheDocument()
    },
  )

  beforeEach(() => {
    thread.comments = []
    thread.events = []
    addComment.mockReset()
    fixRuns.runs = []
    fixRuns.available = false
    fixRuns.bugIds = []
  })
  afterEach(cleanup)

  it('deletes a bug only after the user confirms', async () => {
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.open = true
      },
    })
    const onDelete = vi.fn<(id: string) => Promise<void>>().mockResolvedValue()
    setup(makeBug(), { onDelete })
    openMenuItem('Delete bug')
    const dialog = screen.getByRole('dialog', { name: 'Delete bug #42?' })
    expect(dialog).toHaveTextContent('Login button broken')

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(onDelete).not.toHaveBeenCalled()

    openMenuItem('Delete bug')
    await act(async () => {
      fireEvent.click(
        within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete bug' }),
      )
    })
    expect(onDelete).toHaveBeenCalledWith('b1')
  })

  it('shows why a delete failed and keeps the dialog open', async () => {
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.open = true
      },
    })
    const onDelete = vi
      .fn<(id: string) => Promise<void>>()
      .mockRejectedValue(new Error('Could not delete the bug. Try again.'))
    setup(makeBug({ kind: 'feature' }), { onDelete })
    openMenuItem('Delete feature')
    const dialog = screen.getByRole('dialog', { name: 'Delete feature #42?' })
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Delete feature' }))
    })
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Could not delete the bug.')
  })

  it('disables delete for an optimistic bug and hides it without a handler', () => {
    setup(makeBug({ number: 0, optimistic: true }), { onDelete: vi.fn() })
    expect(menuItem('Delete bug')).toBeDisabled()
    cleanup()
    setup(makeBug())
    expect(menuItem('Delete bug', true)).toBeNull()
  })

  it('offers delete only to the filer and the workspace owner', () => {
    // Filer who is not the owner (u2 filed it).
    setup(makeBug({ filed_by: 'u2' }), { onDelete: vi.fn(), selfId: 'u2' })
    expect(menuItem('Delete bug')).toBeEnabled()
    cleanup()
    // Workspace owner (u1) on someone else's bug.
    setup(makeBug({ filed_by: 'u2' }), { onDelete: vi.fn(), selfId: 'u1' })
    expect(menuItem('Delete bug')).toBeEnabled()
    cleanup()
    // Ordinary member (u2) on a bug they did not file.
    setup(makeBug({ filed_by: 'u1' }), { onDelete: vi.fn(), selfId: 'u2' })
    expect(menuItem('Delete bug', true)).toBeNull()
  })

  it('shows a placeholder when no bug is selected', () => {
    setup(null)
    expect(screen.getByText('Select a bug to see its details')).toBeTruthy()
  })

  it('renders title, number and filed attribution', () => {
    setup(makeBug())
    expect((screen.getByLabelText('Title') as HTMLTextAreaElement).value).toBe(
      'Login button broken',
    )
    expect(screen.getByText('No. 042')).toBeTruthy()
    expect(screen.getByText(/Coll\./).closest('p')?.textContent).toMatch(/^Coll\. Ada Lovelace · /)
  })

  it('shows Claude progress only when a run is passed', () => {
    setup(makeBug())
    expect(screen.queryByRole('region', { name: 'Claude progress' })).not.toBeInTheDocument()
    cleanup()
    setup(makeBug(), {
      claudeRun: {
        id: 'r1',
        bugs: [42],
        folder: '/repo',
        startedAt: NOW,
        updatedAt: NOW,
        state: 'working',
        activity: 'Running the tests',
        message: null,
        todos: null,
        steps: [],
        stepCount: 0,
      },
    })
    const panel = screen.getByRole('region', { name: 'Claude progress' })
    expect(panel).toHaveTextContent('Claude is working')
    expect(panel).toHaveTextContent('Running the tests')
  })

  it('shows "#…" for optimistic bugs', () => {
    setup(makeBug({ number: 0, optimistic: true }))
    expect(screen.getByText('No. …')).toBeTruthy()
  })

  it('opens the resolve popover and confirms with a note', async () => {
    const { onResolve } = setup(makeBug())
    fireEvent.click(screen.getByRole('button', { name: 'Resolve' }))
    const dialog = screen.getByRole('dialog', { name: 'Resolve bug' })
    fireEvent.change(within(dialog).getByPlaceholderText('Add a note (optional)'), {
      target: { value: '  fixed in v2  ' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Resolve' }))
    await act(async () => {})
    expect(onResolve).toHaveBeenCalledWith('b1', 'fixed in v2')
    expect(screen.queryByRole('dialog', { name: 'Resolve bug' })).toBeNull()
  })

  it('confirms with Cmd+Enter and resolves without note', async () => {
    const { onResolve } = setup(makeBug())
    fireEvent.click(screen.getByRole('button', { name: 'Resolve' }))
    fireEvent.click(screen.getByRole('button', { name: 'Resolve without note' }))
    await act(async () => {})
    expect(onResolve).toHaveBeenLastCalledWith('b1', null)

    fireEvent.click(screen.getByRole('button', { name: 'Resolve' }))
    const box = screen.getByPlaceholderText('Add a note (optional)')
    fireEvent.change(box, { target: { value: 'dup' } })
    fireEvent.keyDown(box, { key: 'Enter', metaKey: true })
    await act(async () => {})
    expect(onResolve).toHaveBeenLastCalledWith('b1', 'dup')
  })

  it('Esc closes the popover', () => {
    setup(makeBug())
    fireEvent.click(screen.getByRole('button', { name: 'Resolve' }))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('resolved bug shows Reopen, resolver and note', async () => {
    const { onReopen } = setup(
      makeBug({
        status: 'resolved',
        resolved_by: 'u2',
        resolved_at: NOW,
        resolution_note: 'Fixed it',
      }),
    )
    expect(screen.queryByRole('button', { name: 'Resolve' })).toBeNull()
    expect(screen.getByText(/Resolved by/).textContent).toMatch(
      /Resolved by Grace Hopper · just now/,
    )
    expect(screen.getByText('“Fixed it”')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Reopen' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reopen without note' }))
    await act(async () => {})
    expect(onReopen).toHaveBeenCalledWith('b1', null)
  })

  it('opens the popover when resolveRequest changes, not on mount', () => {
    const bug = makeBug()
    const { rerender, onUpdate, onResolve, onReopen, onBack } = setup(bug, { resolveRequest: 3 })
    expect(screen.queryByRole('dialog')).toBeNull()
    rerender(
      <BugDetail
        bug={bug}
        members={members}
        selfId="u1"
        onUpdate={onUpdate}
        onResolve={onResolve}
        onReopen={onReopen}
        onBack={onBack}
        resolveRequest={4}
      />,
    )
    expect(screen.getByRole('dialog', { name: 'Resolve bug' })).toBeTruthy()
  })

  it('saves the title on Enter only when changed', async () => {
    const { onUpdate } = setup(makeBug())
    const input = screen.getByLabelText('Title')
    input.focus()
    fireEvent.change(input, { target: { value: 'New title' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await act(async () => {})
    expect(onUpdate).toHaveBeenCalledWith('b1', { title: 'New title' })
    fireEvent.blur(input)
    expect(onUpdate).toHaveBeenCalledTimes(1)
  })

  it('Enter in the title saves without inserting a newline', async () => {
    const { onUpdate } = setup(makeBug())
    const input = screen.getByLabelText('Title') as HTMLTextAreaElement
    input.focus()
    fireEvent.change(input, { target: { value: 'Wrapped title' } })
    const notPrevented = fireEvent.keyDown(input, { key: 'Enter' })
    await act(async () => {})
    expect(notPrevented).toBe(false)
    expect(input.value).not.toContain('\n')
    expect(onUpdate).toHaveBeenCalledWith('b1', { title: 'Wrapped title' })
  })

  it('keeps the title draft when the save fails, clears it after success', async () => {
    const onUpdate = vi
      .fn<(id: string, patch: object) => Promise<void>>()
      .mockRejectedValueOnce(new Error('Could not save changes.'))
      .mockResolvedValueOnce()
    const onToast = vi.fn()
    setup(makeBug(), { onUpdate, onToast })
    const input = screen.getByLabelText('Title') as HTMLTextAreaElement
    input.focus()
    fireEvent.change(input, { target: { value: 'Retitled' } })
    fireEvent.blur(input)
    await act(async () => {})
    expect(onUpdate).toHaveBeenCalledWith('b1', { title: 'Retitled' })
    expect(input.value).toBe('Retitled')
    expect(screen.getByRole('alert').textContent).toContain('Could not save changes.')
    expect(onToast).toHaveBeenCalledWith('Could not save changes.')

    input.focus()
    fireEvent.blur(input)
    await act(async () => {})
    expect(onUpdate).toHaveBeenCalledTimes(2)
    // Draft cleared: the input shows the prop title again (parent hasn't updated it in this test).
    expect(input.value).toBe('Login button broken')
  })

  it('offers Retry inline when an action fails, and retries that action', async () => {
    const onResolve = vi
      .fn<(id: string, note: string | null) => Promise<void>>()
      .mockRejectedValueOnce(new Error('Could not resolve #42.'))
      .mockResolvedValueOnce()
    setup(makeBug(), { onResolve })
    fireEvent.click(screen.getByRole('button', { name: 'Resolve' }))
    fireEvent.click(screen.getByRole('button', { name: 'Resolve without note' }))
    await act(async () => {})
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Could not resolve #42.')
    await act(async () => {
      fireEvent.click(within(alert).getByRole('button', { name: 'Retry' }))
    })
    expect(onResolve).toHaveBeenCalledTimes(2)
    expect(onResolve).toHaveBeenLastCalledWith('b1', null)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('keeps Send to Claude Code and the Claude copy prompt reachable', () => {
    const onSend = vi.fn()
    const onCopy = vi.fn()
    setup(makeBug(), { onSend, onCopy })
    fireEvent.click(screen.getByRole('button', { name: 'Send to Claude Code' }))
    expect(onSend).toHaveBeenCalledTimes(1)
    fireEvent.click(menuItem('Copy prompt for Claude Code')!)
    expect(onCopy).toHaveBeenCalledTimes(1)
    // Send is always a visible button (icon-only on phones), never hidden in the menu.
    expect(menuItem('Send to Claude Code', true)).toBeNull()
    expect(screen.getByRole('button', { name: 'Send to Claude Code' })).toBeEnabled()
  })

  it('quotes the resolution note once: in the header, not again on the timeline', () => {
    thread.events = [
      {
        id: 'e1',
        bug_id: 'b1',
        actor_id: 'u2',
        type: 'resolved',
        note: 'Fixed it',
        created_at: NOW,
      },
    ]
    setup(
      makeBug({
        status: 'resolved',
        resolved_by: 'u2',
        resolved_at: NOW,
        resolution_note: 'Fixed it',
      }),
    )
    expect(screen.getByText('“Fixed it”')).toBeTruthy()
    expect(screen.queryByText('Fixed it')).toBeNull()
    const timeline = screen.getByRole('list', { name: 'Timeline' })
    expect(within(timeline).getByText(/resolved/)).toBeTruthy()
  })

  it('captions the open screenshot with its size and file name', () => {
    setup(makeBug({ attachments: [attachment('a1')] }))
    fireEvent.click(screen.getByRole('button', { name: 'Open screenshot 1' }))
    const viewer = screen.getByRole('dialog', { name: 'Screenshot viewer' })
    expect(viewer).toHaveTextContent('Fig. 1 / 1 · 10×10 · a1.webp')
  })

  it('shows live markup layers on thumbnails, in the viewer and as a pin checklist', () => {
    const annotations = {
      v: 1,
      shapes: [
        { type: 'box', color: 'danger', x: 0.1, y: 0.1, w: 0.2, h: 0.2 },
        { type: 'pin', color: 'danger', n: 1, x: 0.5, y: 0.5, note: 'Banner overlaps Pay now' },
      ],
    }
    setup(
      makeBug({
        attachments: [attachment('a1'), { ...attachment('a2'), annotations }],
      }),
    )
    const thumbs = screen.getAllByRole('button', { name: /^Open screenshot/ })
    expect(within(thumbs[0]).queryByTestId('annotation-overlay')).toBeNull()
    const overlay = within(thumbs[1]).getByTestId('annotation-overlay')
    expect(overlay).toHaveAttribute('preserveAspectRatio', 'xMinYMin slice')
    expect(overlay.querySelector('[data-pin="1"]')).not.toBeNull()

    const checklist = screen.getByRole('list', { name: 'Pinned issues' })
    expect(checklist).toHaveTextContent('Pin 1: Banner overlaps Pay now')
    expect(screen.getByText('Fig. 2 · Pins')).toBeInTheDocument()
    expect(screen.queryByText('Fig. 1 · Pins')).toBeNull()

    fireEvent.click(thumbs[1])
    const viewer = screen.getByRole('dialog', { name: 'Screenshot viewer' })
    expect(within(viewer).getByTestId('annotation-overlay')).toHaveAttribute(
      'preserveAspectRatio',
      'xMidYMid meet',
    )
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(within(viewer).queryByTestId('annotation-overlay')).toBeNull()
  })

  it('asks for no fix runs while the bug is still being filed', () => {
    setup(makeBug({ number: 0, optimistic: true }))
    expect(fixRuns.bugIds.length).toBeGreaterThan(0)
    expect(fixRuns.bugIds.every((id) => id === null)).toBe(true)
  })

  it('labels a fix run’s after screenshot in the strip and the viewer', () => {
    fixRuns.available = true
    fixRuns.runs = [
      {
        id: 'r1',
        bug_id: 'b1',
        workspace_id: 'w1',
        run_id: 'run-1',
        status: 'succeeded',
        branch: 'fix/login',
        commit_sha: 'e3f9a12c4b',
        pr_url: null,
        files_changed: 1,
        additions: 2,
        deletions: 1,
        summary: null,
        after_attachment_id: 'a2',
        created_by: 'u1',
        started_at: NOW,
        finished_at: NOW,
      },
    ]
    setup(makeBug({ attachments: [attachment('a1'), attachment('a2')] }))
    expect(fixRuns.bugIds).toContain('b1')
    expect(screen.getByRole('button', { name: 'Open screenshot 1' })).toBeInTheDocument()
    const after = screen.getByRole('button', { name: 'Open screenshot 2, after fix e3f9a12' })
    expect(after.closest('figure')).toHaveTextContent('Fig. 2 · After fix e3f9a12')
    expect(screen.getByRole('region', { name: 'Fix record' })).toBeInTheDocument()
    fireEvent.click(after)
    const viewer = screen.getByRole('dialog', { name: 'Screenshot viewer' })
    expect(viewer).toHaveTextContent('After fix e3f9a12 · 10×10 · a2.webp')
  })

  it('keeps the description draft when the save fails', async () => {
    const onUpdate = vi.fn().mockRejectedValue(new Error('nope'))
    setup(makeBug(), { onUpdate })
    const box = screen.getByLabelText('Description') as HTMLTextAreaElement
    box.focus()
    fireEvent.change(box, { target: { value: 'More detail' } })
    fireEvent.blur(box)
    await act(async () => {})
    expect(onUpdate).toHaveBeenCalledWith('b1', { description: 'More detail' })
    expect(box.value).toBe('More detail')
  })

  it('Esc cancels title and description edits without saving', async () => {
    const { onUpdate } = setup(makeBug())
    const input = screen.getByLabelText('Title') as HTMLTextAreaElement
    input.focus()
    fireEvent.change(input, { target: { value: 'Discard me' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(document.activeElement).not.toBe(input)
    expect(input.value).toBe('Login button broken')

    const box = screen.getByLabelText('Description') as HTMLTextAreaElement
    box.focus()
    fireEvent.change(box, { target: { value: 'Discard me too' } })
    fireEvent.keyDown(box, { key: 'Escape' })
    expect(box.value).toBe('Clicking login does nothing')

    // A later normal edit still saves.
    input.focus()
    fireEvent.change(input, { target: { value: 'Kept' } })
    fireEvent.blur(input)
    await act(async () => {})
    expect(onUpdate).toHaveBeenCalledTimes(1)
    expect(onUpdate).toHaveBeenCalledWith('b1', { title: 'Kept' })
  })

  it('closes an open popover when the selected bug changes', () => {
    const { rerender, onUpdate, onResolve, onReopen, onBack } = setup(makeBug())
    fireEvent.click(screen.getByRole('button', { name: 'Resolve' }))
    expect(screen.getByRole('dialog', { name: 'Resolve bug' })).toBeTruthy()
    const props = { members, selfId: 'u1', onUpdate, onResolve, onReopen, onBack }
    rerender(<BugDetail {...props} bug={makeBug({ id: 'b2', number: 43 })} />)
    expect(screen.queryByRole('dialog')).toBeNull()
    // Returning to the first bug does not resurrect the old popover.
    rerender(<BugDetail {...props} bug={makeBug()} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('updates severity from the labelled picker', async () => {
    const { onUpdate } = setup(makeBug())
    fireEvent.click(screen.getByRole('button', { name: 'Severity: High' }))
    fireEvent.click(screen.getByRole('option', { name: /Critical/ }))
    await act(async () => {})
    expect(onUpdate).toHaveBeenCalledWith('b1', { severity: 'critical' })
  })

  it('shows the voice transcript and failed pending uploads', () => {
    setup(
      makeBug({
        transcript: 'spoken words',
        pending: [{ localId: 'p1', previewUrl: 'blob:p1', progress: 0.2, error: 'boom' }],
      }),
    )
    expect(screen.getByText('Voice transcript')).toBeTruthy()
    expect(screen.getByText('spoken words')).toBeTruthy()
    expect(screen.getByText('Upload failed')).toBeTruthy()
  })

  it('offers Retry on a failed pending upload', () => {
    const onRetryUploads = vi.fn()
    setup(
      makeBug({
        pending: [{ localId: 'p1', previewUrl: 'blob:p1', progress: 0.2, error: 'boom' }],
      }),
      { onRetryUploads },
    )
    fireEvent.click(screen.getByRole('button', { name: 'Retry upload' }))
    expect(onRetryUploads).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog', { name: 'Screenshot viewer' })).toBeNull()
  })

  it('lightbox navigates with arrow keys and closes on Esc', () => {
    setup(makeBug({ attachments: [attachment('a1'), attachment('a2'), attachment('a3')] }))
    fireEvent.click(screen.getByRole('button', { name: 'Open screenshot 2' }))
    const viewer = screen.getByRole('dialog', { name: 'Screenshot viewer' })
    expect(within(viewer).getByText('2 / 3')).toBeTruthy()
    expect(within(viewer).getByRole('img').getAttribute('src')).toBe(
      'https://cdn.test/w1/b1/a2.webp',
    )

    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByText('3 / 3')).toBeTruthy()
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByText('1 / 3')).toBeTruthy()
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(screen.getByText('3 / 3')).toBeTruthy()
    expect(
      within(screen.getByRole('dialog', { name: 'Screenshot viewer' }))
        .getByRole('img')
        .getAttribute('src'),
    ).toBe('https://cdn.test/w1/b1/a3.webp')

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Screenshot viewer' })).toBeNull()
  })

  it('renders comments and timeline, sends on Enter and ignores empty', async () => {
    thread.comments = [
      {
        id: 'c1',
        bug_id: 'b1',
        author_id: 'u2',
        body: 'line1\nline2',
        created_at: NOW,
        edited_at: null,
      },
    ]
    thread.events = [
      {
        id: 'e2',
        bug_id: 'b1',
        actor_id: 'u2',
        type: 'resolved',
        note: 'done',
        created_at: '2026-01-02T00:00:00Z',
      },
      {
        id: 'e1',
        bug_id: 'b1',
        actor_id: 'gone',
        type: 'filed',
        note: null,
        created_at: '2026-01-01T00:00:00Z',
      },
    ]
    addComment.mockResolvedValue()
    setup(makeBug())
    const body = screen.getByText(/line1/)
    expect(body.innerHTML).toBe('line1<br>line2')
    const items = screen.getAllByRole('listitem').map((li) => li.textContent ?? '')
    const filedIdx = items.findIndex((t) => t.includes('Deleted user filed'))
    const resolvedIdx = items.findIndex((t) => t.includes('Grace Hopper resolved'))
    expect(filedIdx).toBeGreaterThanOrEqual(0)
    expect(resolvedIdx).toBeGreaterThan(filedIdx)
    expect(screen.getByText('done')).toBeTruthy()

    const box = screen.getByLabelText('Comment')
    fireEvent.keyDown(box, { key: 'Enter' })
    expect(addComment).not.toHaveBeenCalled()
    fireEvent.change(box, { target: { value: 'hello' } })
    await act(async () => {
      fireEvent.keyDown(box, { key: 'Enter' })
    })
    expect(addComment).toHaveBeenCalledWith('hello')
    expect((box as HTMLTextAreaElement).value).toBe('')
  })

  it('keeps text typed while a comment is posting', async () => {
    let finish: () => void = () => {}
    addComment.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        }),
    )
    setup(makeBug())
    const box = screen.getByLabelText('Comment') as HTMLTextAreaElement
    fireEvent.change(box, { target: { value: 'first' } })
    fireEvent.keyDown(box, { key: 'Enter' })
    expect(box.disabled).toBe(false)
    fireEvent.change(box, { target: { value: 'first second' } })
    await act(async () => {
      finish()
    })
    expect(addComment).toHaveBeenCalledWith('first')
    expect(box.value).toBe('second')
  })

  it('mobile back button calls onBack', () => {
    const { onBack } = setup(makeBug())
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(onBack).toHaveBeenCalled()
  })

  it('posts a comment with the Comment button, which is disabled while the draft is empty', async () => {
    addComment.mockResolvedValue()
    setup(makeBug())
    const button = screen.getByRole('button', { name: 'Comment' })
    expect(button).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Comment'), { target: { value: 'via button' } })
    expect(button).toBeEnabled()
    await act(async () => {
      fireEvent.click(button)
    })
    expect(addComment).toHaveBeenCalledWith('via button')
  })

  it('keeps the hidden description textarea out of the layout width', () => {
    // A visually hidden textarea that keeps w-full is absolutely positioned at 100% of the
    // viewport and widened the whole page sideways.
    setup(makeBug())
    const box = screen.getByLabelText('Description')
    expect(box.className.split(' ')).toContain('sr-only')
    expect(box.className.split(' ')).not.toContain('w-full')
    fireEvent.focus(box)
    expect(box.className.split(' ')).not.toContain('sr-only')
    expect(box.className.split(' ')).toContain('w-full')
  })
})
