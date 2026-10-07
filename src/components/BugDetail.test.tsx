import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { BugEvent, BugWithMeta, Comment, WorkspaceMember } from '../lib/types'
import { BugDetail } from './BugDetail'

const addComment = vi.fn<(body: string) => Promise<void>>()
const thread: { comments: Comment[]; events: BugEvent[] } = { comments: [], events: [] }

vi.mock('../hooks/useBug', () => ({
  useBug: () => ({ ...thread, addComment, loading: false }),
}))
vi.mock('../hooks/useSignedUrl', () => ({
  useSignedUrl: (path: string | null) => (path ? `https://cdn.test/${path}` : null),
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
  beforeEach(() => {
    thread.comments = []
    thread.events = []
    addComment.mockReset()
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
    fireEvent.click(screen.getByRole('button', { name: 'Delete bug' }))
    const dialog = screen.getByRole('dialog', { name: 'Delete bug #42?' })
    expect(dialog).toHaveTextContent('Login button broken')

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(onDelete).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Delete bug' }))
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
    fireEvent.click(screen.getByRole('button', { name: 'Delete feature' }))
    const dialog = screen.getByRole('dialog', { name: 'Delete feature #42?' })
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Delete feature' }))
    })
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Could not delete the bug.')
  })

  it('disables delete for an optimistic bug and hides it without a handler', () => {
    setup(makeBug({ number: 0, optimistic: true }), { onDelete: vi.fn() })
    expect(screen.getByRole('button', { name: 'Delete bug' })).toBeDisabled()
    cleanup()
    setup(makeBug())
    expect(screen.queryByRole('button', { name: 'Delete bug' })).not.toBeInTheDocument()
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
    expect(screen.getByText('#42')).toBeTruthy()
    expect(screen.getByText(/Filed by/).textContent).toMatch(/Filed by Ada Lovelace · just now/)
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
    expect(screen.getByText('#…')).toBeTruthy()
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

  it('updates severity from the inline dots', async () => {
    const { onUpdate } = setup(makeBug())
    fireEvent.click(screen.getByRole('button', { name: 'Severity: Critical' }))
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
      { id: 'c1', bug_id: 'b1', author_id: 'u2', body: 'line1\nline2', created_at: NOW },
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
})
