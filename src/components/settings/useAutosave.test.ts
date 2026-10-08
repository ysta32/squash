import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { bumpSessionEpoch } from '../../lib/sessionEpoch'
import { resetAutosaveLines, useAutosave } from './useAutosave'

function deferred() {
  let resolve!: () => void
  let reject!: (error: Error) => void
  const promise = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

afterEach(() => resetAutosaveLines())

describe('useAutosave', () => {
  it('never runs a save queued under a session that has since ended', async () => {
    const first = deferred()
    const write = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValue(undefined)
    const { result } = renderHook(() => useAutosave('profile:u1:name', 'Ada', 'Could not save'))
    let a!: Promise<void>
    let b!: Promise<void>
    act(() => {
      a = result.current.commit('Ada L', write)
      b = result.current.commit('Ada Lovelace', write)
    })
    // Let the first save start, then sign out (or switch account) while it is in flight.
    await act(async () => {})
    expect(write).toHaveBeenCalledTimes(1)
    bumpSessionEpoch()
    await act(async () => {
      first.resolve()
      await a
      await b
    })
    expect(write).toHaveBeenCalledTimes(1)
    expect(write).toHaveBeenCalledWith('Ada L')
    // A new session starts from the server value again, not the old session's queue.
    expect(result.current.pending()).toBe('Ada')
  })

  it('tracks the newest save by identity, so A → B → A with the first A failing keeps A', async () => {
    const first = deferred()
    const write = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValue(undefined)
    const onFail = vi.fn()
    const { result } = renderHook(() => useAutosave('workspace:w1:name', 'Base', 'Could not save'))
    let saves: Promise<void>[] = []
    act(() => {
      saves = [
        result.current.commit('A', write, { onFail }),
        result.current.commit('B', write, { onFail }),
        result.current.commit('A', write, { onFail }),
      ]
    })
    await act(async () => {
      first.reject(new Error('offline'))
      await Promise.all(saves)
    })
    // The failed first A was not the newest save, so it neither rolled back nor reset the queue.
    expect(onFail).not.toHaveBeenCalled()
    expect(write.mock.calls.map(([value]) => value)).toEqual(['A', 'B', 'A'])
    expect(result.current.pending()).toBe('A')
    expect(result.current.state).toEqual({ status: 'saved' })
  })

  it('evicts drained lines so visiting many fields does not grow without bound', async () => {
    const write = vi.fn().mockResolvedValue(undefined)
    for (let i = 0; i < 100; i += 1) {
      const { result, unmount } = renderHook(() => useAutosave(`row:${i}`, 'x', 'Could not save'))
      await act(async () => {
        await result.current.commit(`y${i}`, write)
      })
      unmount()
    }
    // The newest lines are kept (their pending value is still the written one) …
    const recent = renderHook(() => useAutosave('row:99', 'x', 'Could not save'))
    expect(recent.result.current.pending()).toBe('y99')
    // … and the oldest drained ones were dropped, falling back to the server value.
    const oldest = renderHook(() => useAutosave('row:0', 'x', 'Could not save'))
    expect(oldest.result.current.pending()).toBe('x')
  })
})
