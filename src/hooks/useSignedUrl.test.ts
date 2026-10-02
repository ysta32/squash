import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearSignedUrlCache, useSignedUrl } from './useSignedUrl'

const sign = vi.hoisted(() => vi.fn())

vi.mock('../lib/supabase', () => ({
  supabase: { storage: { from: () => ({ createSignedUrl: sign }) } },
}))

const fail = { data: null, error: { message: 'network' } }

describe('useSignedUrl', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    clearSignedUrlCache()
    sign.mockReset()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('retries with backoff up to 3 attempts, then again when back online', async () => {
    sign.mockResolvedValue(fail)
    const { result } = renderHook(() => useSignedUrl('ws/b/a.webp'))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000)
    })
    expect(sign).toHaveBeenCalledTimes(3)
    expect(result.current).toBeNull()

    sign.mockResolvedValue({ data: { signedUrl: 'https://signed' }, error: null })
    await act(async () => {
      window.dispatchEvent(new Event('online'))
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(sign).toHaveBeenCalledTimes(4)
    expect(result.current).toBe('https://signed')
  })
})
