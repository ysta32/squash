import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useDeletionLog } from './useDeletionLog'

const mocks = vi.hoisted(() => ({ limit: vi.fn(), order: vi.fn(), eq: vi.fn(), from: vi.fn() }))

vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from } }))

beforeEach(() => {
  mocks.from.mockReset()
  mocks.from.mockReturnValue({
    select: () => ({
      eq: mocks.eq.mockReturnValue({ order: mocks.order.mockReturnValue({ limit: mocks.limit }) }),
    }),
  })
})

describe('useDeletionLog', () => {
  it('loads the newest 50 deletions for the workspace', async () => {
    const rows = [{ id: 'd1', workspace_id: 'ws', bug_number: 3, title: 'Crash', kind: 'bug' }]
    mocks.limit.mockResolvedValue({ data: rows, error: null })
    const { result } = renderHook(() => useDeletionLog('ws'))
    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.deletions).toEqual(rows)
    expect(result.current.error).toBeNull()
    expect(mocks.from).toHaveBeenCalledWith('bug_deletions')
    expect(mocks.eq).toHaveBeenCalledWith('workspace_id', 'ws')
    expect(mocks.order).toHaveBeenCalledWith('deleted_at', { ascending: false })
    expect(mocks.limit).toHaveBeenCalledWith(50)
  })

  it('reports an error', async () => {
    mocks.limit.mockResolvedValue({ data: null, error: { message: 'denied' } })
    const { result } = renderHook(() => useDeletionLog('ws'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('denied')
    expect(result.current.deletions).toEqual([])
  })
})
