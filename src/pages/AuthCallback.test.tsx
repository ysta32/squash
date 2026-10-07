import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import AuthCallback from './AuthCallback'

const auth = vi.hoisted(() => ({ session: null as object | null }))
vi.mock('../lib/auth', () => ({ useAuth: () => ({ session: auth.session }) }))

function Where() {
  const loc = useLocation()
  return <p data-testid="where">{loc.pathname + loc.search}</p>
}

function show(entry: string) {
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  auth.session = null
  vi.useFakeTimers()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('AuthCallback', () => {
  it('shows progress while waiting for a session', () => {
    show('/auth/callback')
    expect(screen.getByRole('heading', { name: 'Signing you in' })).toBeInTheDocument()
  })

  it('redirects to the requested same-origin path once signed in', () => {
    auth.session = {}
    show('/auth/callback?next=%2Fjoin%2Fabc')
    expect(screen.getByTestId('where')).toHaveTextContent('/join/abc')
  })

  it.each(['https://evil.example/x', '//evil.example', '/\\evil.example', 'javascript:alert(1)'])(
    'falls back to /app for unsafe next %s',
    (next) => {
      auth.session = {}
      show(`/auth/callback?next=${encodeURIComponent(next)}`)
      expect(screen.getByTestId('where')).toHaveTextContent('/app')
    },
  )

  it('defaults to /app when next is missing', () => {
    auth.session = {}
    show('/auth/callback')
    expect(screen.getByTestId('where')).toHaveTextContent('/app')
  })

  it('shows the provider error from the query and does not redirect even with a session', () => {
    auth.session = {}
    show('/auth/callback?error_description=Access+denied')
    expect(screen.getByRole('alert')).toHaveTextContent('Access denied')
    expect(screen.queryByTestId('where')).not.toBeInTheDocument()
  })

  it('reads errors from the hash fragment and falls back to the error code', () => {
    show('/auth/callback#error_description=Link+expired')
    expect(screen.getByRole('alert')).toHaveTextContent('Link expired')
    cleanup()
    show('/auth/callback?error=server_error')
    expect(screen.getByRole('alert')).toHaveTextContent('server_error')
  })

  it('the back link preserves only a safe next target', () => {
    show('/auth/callback?error=x&next=%2Fjoin%2Fabc')
    expect(screen.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute(
      'href',
      '/signin?next=%2Fjoin%2Fabc',
    )
    cleanup()
    show('/auth/callback?error=x&next=https%3A%2F%2Fevil.example')
    expect(screen.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute(
      'href',
      '/signin?next=%2Fapp',
    )
  })

  it('times out with an expired-link message when no session arrives', () => {
    show('/auth/callback')
    act(() => {
      vi.advanceTimersByTime(7999)
    })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(screen.getByRole('alert')).toHaveTextContent('Sign-in link is invalid or has expired.')
  })
})
