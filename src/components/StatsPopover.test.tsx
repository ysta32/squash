import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, act } from '@testing-library/react'
import { StatsPopover } from './StatsPopover'

interface Row {
  user_id: string
  filed_total: number
  resolved_total: number
  filed_7d: number
  resolved_7d: number
}
type Result = { data: Row[]; error: null }

const rpc = vi.fn<(name: string, args: { p_workspace_id: string }) => Promise<Result>>()
vi.mock('../lib/supabase', () => ({
  supabase: { rpc: (name: string, args: { p_workspace_id: string }) => rpc(name, args) },
}))

const row = (n: number): Row => ({
  user_id: 'u',
  filed_total: n,
  resolved_total: 0,
  filed_7d: 0,
  resolved_7d: 0,
})

describe('StatsPopover', () => {
  afterEach(() => {
    cleanup()
    rpc.mockReset()
  })

  it('ignores stale responses and shows skeleton on workspace change', async () => {
    const resolvers: Record<string, (r: Result) => void> = {}
    rpc.mockImplementation(
      (_n, args) =>
        new Promise<Result>((res) => {
          resolvers[args.p_workspace_id] = res
        }),
    )
    const { rerender } = render(<StatsPopover workspaceId="a" members={[]} />)
    rerender(<StatsPopover workspaceId="b" members={[]} />)
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull()

    await act(async () => {
      resolvers.a({ data: [row(111)], error: null })
    })
    expect(screen.queryByText(/111/)).toBeNull()
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull()

    await act(async () => {
      resolvers.b({ data: [row(222)], error: null })
    })
    await waitFor(() => expect(screen.getByText(/222/)).toBeTruthy())
    expect(document.querySelector('[aria-busy="true"]')).toBeNull()
  })
})
