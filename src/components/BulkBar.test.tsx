import { useState } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BugWithMeta, WorkspaceMember } from '../lib/types'
import { BulkBar, type BulkBarProps } from './BulkBar'
import { BugList } from './BugList'
import { ToastProvider } from './Toast'

vi.mock('../lib/supabase', () => ({ supabase: {} }))

HTMLElement.prototype.scrollIntoView = vi.fn()

const members: WorkspaceMember[] = [
  {
    workspace_id: 'workspace',
    user_id: 'ada',
    role: 'member',
    joined_at: '2026-10-01',
    profile: {
      id: 'ada',
      display_name: 'Ada',
      avatar_url: null,
      avatar_color: '#7c3aed',
      created_at: '2026-10-01',
    },
  },
]

function bug(id: string, status: 'open' | 'resolved' = 'open'): BugWithMeta {
  return {
    id,
    workspace_id: 'workspace',
    number: Number(id),
    title: `Bug ${id}`,
    description: '',
    transcript: null,
    severity: 'high',
    status,
    kind: 'bug',
    filed_by: 'ada',
    created_at: '2026-10-01',
    resolved_by: null,
    resolved_at: null,
    resolution_note: null,
    assignee_id: null,
    updated_at: '2026-10-01',
    attachments: [],
  }
}

function setup(overrides: Partial<BulkBarProps> = {}) {
  const props: BulkBarProps = {
    bugs: [bug('1'), bug('2')],
    members,
    selfId: 'ada',
    onResolve: vi.fn().mockResolvedValue(undefined),
    onReopen: vi.fn().mockResolvedValue(undefined),
    onAssign: vi.fn().mockResolvedValue(undefined),
    onClear: vi.fn(),
    ...overrides,
  }
  render(
    <ToastProvider>
      <BulkBar {...props} />
    </ToastProvider>,
  )
  return props
}

afterEach(cleanup)

describe('BulkBar', () => {
  it('undoes only successful resolves and restores each previous note', async () => {
    const first = { ...bug('1'), resolution_note: 'previous reopen' }
    const props = setup({
      bugs: [first, bug('2'), bug('3')],
      onResolve: vi
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Denied'))
        .mockResolvedValueOnce(undefined),
    })
    fireEvent.click(screen.getByRole('button', { name: 'Resolve' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Undo' }))
    await waitFor(() => expect(props.onReopen).toHaveBeenCalledTimes(2))
    expect(props.onReopen).toHaveBeenCalledWith('1', 'previous reopen')
    expect(props.onReopen).toHaveBeenCalledWith('3', null)
    expect(props.onReopen).not.toHaveBeenCalledWith('2', expect.anything())
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument()
  })

  it('undoes reopen with the previous resolution note and reports undo failure', async () => {
    const props = setup({
      bugs: [{ ...bug('1', 'resolved'), resolution_note: 'Fixed originally' }],
      onResolve: vi.fn().mockRejectedValue(new Error('Denied')),
    })
    fireEvent.click(screen.getByRole('button', { name: 'Reopen' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Undo' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not undo 1 bug.')
    expect(props.onResolve).toHaveBeenCalledExactlyOnceWith('1', 'Fixed originally')
  })

  it('restores each previous assignee', async () => {
    const props = setup({ bugs: [{ ...bug('1'), assignee_id: 'previous' }, bug('2')] })
    fireEvent.click(screen.getByRole('button', { name: 'Assignee: Unassigned' }))
    fireEvent.click(screen.getByRole('option', { name: 'Assign to me' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Undo' }))
    await waitFor(() => expect(props.onAssign).toHaveBeenCalledTimes(4))
    expect(props.onAssign).toHaveBeenNthCalledWith(3, '1', 'previous')
    expect(props.onAssign).toHaveBeenNthCalledWith(4, '2', null)
  })

  it('shows the selected count and hides with no selection', () => {
    const { rerender } = render(
      <ToastProvider>
        <BulkBar
          bugs={[]}
          members={members}
          selfId="ada"
          onResolve={vi.fn()}
          onReopen={vi.fn()}
          onAssign={vi.fn()}
          onClear={vi.fn()}
        />
      </ToastProvider>,
    )
    expect(screen.queryByRole('group', { name: 'Bulk actions' })).not.toBeInTheDocument()
    rerender(
      <ToastProvider>
        <BulkBar
          bugs={[bug('1'), bug('2')]}
          members={members}
          selfId="ada"
          onResolve={vi.fn()}
          onReopen={vi.fn()}
          onAssign={vi.fn()}
          onClear={vi.fn()}
        />
      </ToastProvider>,
    )
    expect(screen.getByRole('group', { name: 'Bulk actions' })).toHaveTextContent('2 selected')
  })

  it('resolves every selected open item and reports the count', async () => {
    const props = setup({ bugs: [bug('1'), bug('2'), bug('3', 'resolved')] })
    fireEvent.click(screen.getByRole('button', { name: 'Resolve' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Resolved 2 bugs'))
    expect(props.onResolve).toHaveBeenCalledTimes(2)
    expect(props.onResolve).toHaveBeenCalledWith('1', null)
    expect(props.onResolve).toHaveBeenCalledWith('2', null)
    expect(props.onClear).toHaveBeenCalledOnce()
  })

  it('reopens only selected resolved items', async () => {
    const props = setup({ bugs: [bug('1'), bug('2', 'resolved')] })
    fireEvent.click(screen.getByRole('button', { name: 'Reopen' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Reopened 1 bug'))
    expect(props.onReopen).toHaveBeenCalledExactlyOnceWith('2', null)
    expect(props.onClear).toHaveBeenCalledOnce()
  })

  it('assigns every selected item through the existing member picker', async () => {
    const props = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Assignee: Unassigned' }))
    fireEvent.click(screen.getByRole('option', { name: 'Assign to me' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Assigned 2 bugs'))
    expect(props.onAssign).toHaveBeenCalledTimes(2)
    expect(props.onAssign).toHaveBeenCalledWith('1', 'ada')
    expect(props.onAssign).toHaveBeenCalledWith('2', 'ada')
    expect(props.onClear).toHaveBeenCalledOnce()
  })

  it('settles all mutations and reports both success and failure counts', async () => {
    const onResolve = vi
      .fn()
      .mockRejectedValueOnce(new Error('Denied'))
      .mockResolvedValueOnce(undefined)
    const props = setup({ onResolve })
    fireEvent.click(screen.getByRole('button', { name: 'Resolve' }))
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Could not resolve 1 item.'),
    )
    expect(screen.getByRole('status')).toHaveTextContent('Resolved 1 bug')
    expect(onResolve).toHaveBeenCalledTimes(2)
    expect(props.onClear).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'Resolve' })).toBeEnabled()
  })

  it('prevents overlapping actions until all requests settle', async () => {
    let finish!: () => void
    const pending = new Promise<void>((resolve) => {
      finish = resolve
    })
    let attemptedOverlap = false
    const props = setup({
      onResolve: vi.fn(() => {
        if (!attemptedOverlap) {
          attemptedOverlap = true
          const resolve = screen.getByRole('button', { name: 'Resolve' })
          expect(resolve).toBeEnabled()
          fireEvent.click(resolve)
        }
        return pending
      }),
    })
    fireEvent.click(screen.getByRole('button', { name: 'Resolve' }))
    expect(screen.getByRole('button', { name: 'Resolve' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Assignee: Unassigned' })).toBeDisabled()
    expect(attemptedOverlap).toBe(true)
    expect(props.onResolve).toHaveBeenCalledTimes(2)
    expect(props.onClear).not.toHaveBeenCalled()
    finish()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Resolve' })).toBeEnabled())
  })

  it('exports the selected saved items', () => {
    const onSend = vi.fn()
    const props = setup({ onSend })
    fireEvent.click(screen.getByRole('button', { name: 'Send 2 to Claude Code' }))
    expect(onSend).toHaveBeenCalledExactlyOnceWith(props.bugs)
  })

  it.each(['button', 'Escape'])('clears BugList selection with %s', (method) => {
    function Harness() {
      const [pickedIds, setPickedIds] = useState(new Set(['1', '2']))
      return (
        <BugList
          bugs={[bug('1'), bug('2')]}
          loading={false}
          counts={{ open: 2, resolved: 0, all: 2 }}
          filters={{
            kind: 'bug',
            tab: 'open',
            sort: 'newest',
            query: '',
            filedBy: null,
            resolvedBy: null,
            assignee: null,
            severity: null,
          }}
          onFilters={vi.fn()}
          selectedId={null}
          onSelect={vi.fn()}
          members={members}
          viewersOf={() => []}
          highlightIds={new Set()}
          pickedIds={pickedIds}
          onClearPicked={() => setPickedIds(new Set())}
          onResolve={vi.fn()}
          onReopen={vi.fn()}
          onAssign={vi.fn()}
        />
      )
    }
    render(
      <ToastProvider>
        <Harness />
      </ToastProvider>,
    )
    const bar = screen.getByRole('group', { name: 'Bulk actions' })
    expect(bar).toHaveTextContent('2 selected')
    if (method === 'button')
      fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }))
    else {
      bar.focus()
      expect(bar).toHaveFocus()
      fireEvent.keyDown(bar, { key: 'Escape' })
    }
    expect(screen.queryByRole('group', { name: 'Bulk actions' })).not.toBeInTheDocument()
  })
})
