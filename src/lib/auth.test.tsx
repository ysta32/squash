import { act, render, renderHook, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const unsubscribe = vi.fn()
  return {
    unsubscribe,
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe } } })),
    signInWithOAuth: vi.fn(),
    signInWithOtp: vi.fn(),
    signOut: vi.fn(),
    from: vi.fn(),
  }
})

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
      onAuthStateChange: mocks.onAuthStateChange,
      signInWithOAuth: mocks.signInWithOAuth,
      signInWithOtp: mocks.signInWithOtp,
      signOut: mocks.signOut,
    },
    from: mocks.from,
  },
}))

import { AuthProvider, useAuth } from './auth'
import { safeNext } from './authRedirect'
import AuthCallback from '../pages/AuthCallback'

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getSession.mockResolvedValue({ data: { session: null }, error: null })
  mocks.signInWithOAuth.mockResolvedValue({ data: { provider: 'google', url: 'x' }, error: null })
  mocks.signInWithOtp.mockResolvedValue({ data: {}, error: null })
})

describe('AuthProvider', () => {
  it('exposes a null session and finishes loading', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.session).toBeNull()
    expect(result.current.user).toBeNull()
    expect(result.current.profile).toBeNull()
    expect(mocks.getSession).toHaveBeenCalledTimes(1)
    expect(mocks.onAuthStateChange).toHaveBeenCalledTimes(1)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('unsubscribes from auth changes on unmount', async () => {
    const { result, unmount } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    unmount()
    expect(mocks.unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('signInWithGoogle requests a callback redirect containing next', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(() => result.current.signInWithGoogle('/join/abc'))
    expect(mocks.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent('/join/abc')}`,
        queryParams: { access_type: 'offline', prompt: 'select_account' },
      },
    })
  })

  it('signInWithGoogle defaults next to /app and surfaces errors', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(() => result.current.signInWithGoogle())
    const arg = mocks.signInWithOAuth.mock.calls[0][0] as { options: { redirectTo: string } }
    expect(arg.options.redirectTo).toContain('/auth/callback?next=%2Fapp')

    mocks.signInWithOAuth.mockResolvedValueOnce({ data: {}, error: { message: 'boom' } })
    await expect(result.current.signInWithGoogle()).rejects.toThrow('boom')
  })

  it('signInWithMagicLink uses the same callback url', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(() => result.current.signInWithMagicLink('a@b.co', '/app/ws1'))
    expect(mocks.signInWithOtp).toHaveBeenCalledWith({
      email: 'a@b.co',
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent('/app/ws1')}`,
      },
    })
  })
})

describe('safeNext (callback next validation)', () => {
  it('rejects absolute and protocol-relative urls', () => {
    expect(safeNext('https://evil')).toBe('/app')
    expect(safeNext('//evil')).toBe('/app')
    expect(safeNext('/\\evil')).toBe('/app')
    expect(safeNext('')).toBe('/app')
    expect(safeNext(null)).toBe('/app')
  })

  it('accepts same-origin paths', () => {
    expect(safeNext('/app/ws1/bug/3')).toBe('/app/ws1/bug/3')
    expect(safeNext('/join/abc?x=1')).toBe('/join/abc?x=1')
  })
})

describe('AuthCallback', () => {
  function renderCallback(url: string) {
    return render(
      <MemoryRouter initialEntries={[url]}>
        <AuthProvider>
          <Routes>
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/app" element={<div>app home</div>} />
            <Route path="/app/:id" element={<div>workspace page</div>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    )
  }

  function withSession() {
    mocks.getSession.mockResolvedValue({
      data: { session: { user: { id: 'u1' } } },
      error: null,
    })
    mocks.from.mockReturnValue({
      select: () => ({
        eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }),
      }),
    })
  }

  it('redirects to /app instead of an external next', async () => {
    withSession()
    renderCallback(`/auth/callback?next=${encodeURIComponent('//evil')}`)
    expect(await screen.findByText('app home')).toBeInTheDocument()
  })

  it('redirects to a valid next', async () => {
    withSession()
    renderCallback(`/auth/callback?next=${encodeURIComponent('/app/ws1')}`)
    expect(await screen.findByText('workspace page')).toBeInTheDocument()
  })

  it('shows error_description with a link back to sign in', async () => {
    renderCallback('/auth/callback?error_description=Link%20expired')
    expect(await screen.findByText('Link expired')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to sign in' })).toBeInTheDocument()
  })
})
