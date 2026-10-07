import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useNotifications } from './useNotifications'

const created = vi.fn()
const close = vi.fn()
const requestPermission = vi.fn()
let permission: NotificationPermission
let clicked: (() => void) | null

class MockNotification {
  static get permission() {
    return permission
  }
  static requestPermission = requestPermission
  constructor(title: string, options: NotificationOptions) {
    created(title, options)
  }
  set onclick(handler: () => void) {
    clicked = handler
  }
  close = close
}

const options = { title: 'Sam filed #3', body: 'Broken button', tag: 'bug-id' }

beforeEach(() => {
  localStorage.clear()
  permission = 'granted'
  clicked = null
  vi.clearAllMocks()
  vi.stubGlobal('Notification', MockNotification)
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('useNotifications', () => {
  it.each([
    ['disabled', 'off', 'granted', 'hidden'],
    ['permission pending', 'on', 'default', 'hidden'],
    ['permission denied', 'on', 'denied', 'hidden'],
    ['visible tab', 'on', 'granted', 'visible'],
  ] as const)('does not notify for %s', (_, preference, state, visibility) => {
    localStorage.setItem('squash:notifications', preference)
    permission = state
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(visibility)
    const { result } = renderHook(() => useNotifications())
    result.current.notify(options)
    expect(created).not.toHaveBeenCalled()
  })

  it('requests permission when enabling and shares the persisted preference', async () => {
    permission = 'default'
    requestPermission.mockImplementation(async () => {
      permission = 'granted'
      return permission
    })
    const first = renderHook(() => useNotifications())
    const second = renderHook(() => useNotifications())
    await act(() => first.result.current.setEnabled(true))
    expect(requestPermission).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem('squash:notifications')).toBe('on')
    expect(first.result.current.permission).toBe('granted')
    expect(second.result.current.enabled).toBe(true)
    await act(() => second.result.current.setEnabled(false))
    expect(first.result.current.enabled).toBe(false)
    expect(localStorage.getItem('squash:notifications')).toBe('off')
  })

  it('sends the title, body and tag, then focuses and opens on click', () => {
    localStorage.setItem('squash:notifications', 'on')
    const focus = vi.spyOn(window, 'focus').mockImplementation(() => {})
    const onClick = vi.fn()
    const { result } = renderHook(() => useNotifications())
    result.current.notify({ ...options, onClick })
    expect(created).toHaveBeenCalledWith(options.title, { body: options.body, tag: options.tag })
    expect(onClick).not.toHaveBeenCalled()
    clicked?.()
    expect(focus).toHaveBeenCalledTimes(1)
    expect(close).toHaveBeenCalledTimes(1)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('handles browsers without Notification', async () => {
    vi.stubGlobal('Notification', undefined)
    localStorage.setItem('squash:notifications', 'on')
    const { result } = renderHook(() => useNotifications())
    expect(result.current.supported).toBe(false)
    expect(result.current.permission).toBe('unsupported')
    expect(result.current.enabled).toBe(false)
    await act(() => result.current.setEnabled(true))
    expect(() => result.current.notify(options)).not.toThrow()
    expect(created).not.toHaveBeenCalled()
  })

  it('handles an unavailable notification constructor', () => {
    localStorage.setItem('squash:notifications', 'on')
    created.mockImplementationOnce(() => {
      throw new TypeError('Illegal constructor')
    })
    const { result } = renderHook(() => useNotifications())
    expect(() => result.current.notify(options)).not.toThrow()
  })

  it.each(['denied', 'default', 'reject'] as const)(
    'keeps notifications off if permission returns %s',
    async (response) => {
      permission = 'default'
      requestPermission.mockImplementation(async () => {
        if (response === 'reject') throw new Error('Unavailable')
        permission = response
        return response
      })
      const { result } = renderHook(() => useNotifications())
      await act(() => result.current.setEnabled(true))
      expect(result.current.enabled).toBe(false)
      expect(localStorage.getItem('squash:notifications')).toBe('off')
    },
  )

  it('refreshes permission when returning to the tab', () => {
    localStorage.setItem('squash:notifications', 'on')
    const { result } = renderHook(() => useNotifications())
    permission = 'denied'
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    expect(result.current.permission).toBe('denied')
    expect(result.current.enabled).toBe(false)
    result.current.notify(options)
    expect(created).not.toHaveBeenCalled()
  })

  it('reads preference changes from another tab', () => {
    const { result } = renderHook(() => useNotifications())
    act(() => {
      localStorage.setItem('squash:notifications', 'on')
      window.dispatchEvent(new StorageEvent('storage', { key: 'squash:notifications' }))
    })
    expect(result.current.enabled).toBe(true)
  })
})
