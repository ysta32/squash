import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { Comment, WorkspaceMember } from '../lib/types'
import { CommentThread } from './CommentThread'

const addComment = vi.fn<(body: string) => Promise<void>>()
const editComment = vi.fn<(id: string, body: string) => Promise<void>>()
const deleteComment = vi.fn<(id: string) => Promise<void>>()
const thread: { comments: Comment[] } = { comments: [] }

vi.mock('../hooks/useBug', () => ({
  useBug: () => ({
    comments: thread.comments,
    events: [],
    addComment,
    editComment,
    deleteComment,
    loading: false,
  }),
}))

const NOW = new Date().toISOString()

function member(id: string, name: string, role: 'owner' | 'member'): WorkspaceMember {
  return {
    workspace_id: 'w1',
    user_id: id,
    role,
    joined_at: NOW,
    profile: { id, display_name: name, avatar_url: null, avatar_color: '#f00', created_at: NOW },
  } as WorkspaceMember
}

const members = [
  member('owner', 'Olive Owner', 'owner'),
  member('u2', 'Bea', 'member'),
  member('u3', 'Cy', 'member'),
]

function comment(id: string, author: string, over: Partial<Comment> = {}): Comment {
  return {
    id,
    bug_id: 'b1',
    author_id: author,
    body: `text ${id}`,
    created_at: NOW,
    edited_at: null,
    ...over,
  }
}

function item(text: string): HTMLElement {
  const li = screen.getByText(text).closest('li')
  if (!li) throw new Error('no list item')
  return li
}

describe('CommentThread edit / delete', () => {
  beforeEach(() => {
    thread.comments = [comment('c1', 'u2'), comment('c2', 'u3', { edited_at: NOW })]
  })
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('offers Edit and Delete on own comments only, and marks edited ones', () => {
    render(<CommentThread bugId="b1" members={members} selfId="u2" />)
    const own = within(item('text c1'))
    expect(own.getByRole('button', { name: 'Edit comment' })).toBeTruthy()
    expect(own.getByRole('button', { name: 'Delete comment' })).toBeTruthy()
    expect(own.queryByText('(edited)')).toBeNull()

    const other = within(item('text c2'))
    expect(other.queryByRole('button', { name: 'Edit comment' })).toBeNull()
    expect(other.queryByRole('button', { name: 'Delete comment' })).toBeNull()
    expect(other.getByText('(edited)')).toBeTruthy()
  })

  it('lets the workspace owner delete (not edit) others’ comments', () => {
    render(<CommentThread bugId="b1" members={members} selfId="owner" />)
    const other = within(item('text c1'))
    expect(other.queryByRole('button', { name: 'Edit comment' })).toBeNull()
    expect(other.getByRole('button', { name: 'Delete comment' })).toBeTruthy()
  })

  it('shows no actions without a signed-in user', () => {
    render(<CommentThread bugId="b1" members={members} />)
    expect(screen.queryByRole('button', { name: 'Edit comment' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Delete comment' })).toBeNull()
  })

  it('edits a comment and saves the trimmed body', async () => {
    editComment.mockResolvedValue()
    render(<CommentThread bugId="b1" members={members} selfId="u2" />)
    fireEvent.click(within(item('text c1')).getByRole('button', { name: 'Edit comment' }))
    const box = screen.getByRole('combobox', { name: 'Edit comment' }) as HTMLTextAreaElement
    expect(box.value).toBe('text c1')
    fireEvent.change(box, { target: { value: '  better  ' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    })
    expect(editComment).toHaveBeenCalledWith('c1', 'better')
    expect(screen.queryByRole('combobox', { name: 'Edit comment' })).toBeNull()
  })

  it('keeps the editor open and shows the error when saving fails; Cancel discards', async () => {
    editComment.mockRejectedValue(new Error('This comment can no longer be edited.'))
    render(<CommentThread bugId="b1" members={members} selfId="u2" />)
    fireEvent.click(within(item('text c1')).getByRole('button', { name: 'Edit comment' }))
    fireEvent.change(screen.getByRole('combobox', { name: 'Edit comment' }), {
      target: { value: 'new' },
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    })
    expect(screen.getByRole('alert').textContent).toBe('This comment can no longer be edited.')
    expect(screen.getByRole('combobox', { name: 'Edit comment' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('combobox', { name: 'Edit comment' })).toBeNull()
    expect(screen.getByText('text c1')).toBeTruthy()
  })

  it('Escape cancels the edit, but not while the mention popup is open', () => {
    render(<CommentThread bugId="b1" members={members} selfId="u2" />)
    fireEvent.click(within(item('text c1')).getByRole('button', { name: 'Edit comment' }))
    const box = screen.getByRole('combobox', { name: 'Edit comment' }) as HTMLTextAreaElement
    fireEvent.change(box, { target: { value: 'hi @Be', selectionStart: 6, selectionEnd: 6 } })
    fireEvent.select(box)
    expect(screen.getByRole('listbox', { name: 'Mention suggestions' })).toBeTruthy()
    fireEvent.keyDown(box, { key: 'Escape' })
    expect(screen.queryByRole('listbox', { name: 'Mention suggestions' })).toBeNull()
    expect(screen.getByRole('combobox', { name: 'Edit comment' })).toBeTruthy()
    fireEvent.keyDown(box, { key: 'Escape' })
    expect(screen.queryByRole('combobox', { name: 'Edit comment' })).toBeNull()
    expect(screen.getByText('text c1')).toBeTruthy()
    expect(editComment).not.toHaveBeenCalled()
  })

  it('does not call editComment when the body is unchanged', async () => {
    render(<CommentThread bugId="b1" members={members} selfId="u2" />)
    fireEvent.click(within(item('text c1')).getByRole('button', { name: 'Edit comment' }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    })
    expect(editComment).not.toHaveBeenCalled()
    expect(screen.queryByRole('combobox', { name: 'Edit comment' })).toBeNull()
  })

  it('asks for confirmation before deleting', async () => {
    deleteComment.mockResolvedValue()
    render(<CommentThread bugId="b1" members={members} selfId="u2" />)
    fireEvent.click(within(item('text c1')).getByRole('button', { name: 'Delete comment' }))
    expect(deleteComment).not.toHaveBeenCalled()
    const confirm = within(screen.getByRole('group', { name: 'Confirm delete' }))
    fireEvent.click(confirm.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('group', { name: 'Confirm delete' })).toBeNull()
    expect(deleteComment).not.toHaveBeenCalled()

    fireEvent.click(within(item('text c1')).getByRole('button', { name: 'Delete comment' }))
    await act(async () => {
      fireEvent.click(
        within(screen.getByRole('group', { name: 'Confirm delete' })).getByRole('button', {
          name: 'Delete',
        }),
      )
    })
    expect(deleteComment).toHaveBeenCalledWith('c1')
  })

  it('shows the error when deleting fails', async () => {
    deleteComment.mockRejectedValue(new Error('You cannot delete this comment.'))
    render(<CommentThread bugId="b1" members={members} selfId="u2" />)
    fireEvent.click(within(item('text c1')).getByRole('button', { name: 'Delete comment' }))
    await act(async () => {
      fireEvent.click(
        within(screen.getByRole('group', { name: 'Confirm delete' })).getByRole('button', {
          name: 'Delete',
        }),
      )
    })
    expect(screen.getByRole('alert').textContent).toBe('You cannot delete this comment.')
  })
})
