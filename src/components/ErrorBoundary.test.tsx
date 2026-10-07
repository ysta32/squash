import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { MemoryRouter, Link, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from './ErrorBoundary'

function Boom({ message }: { message: string }): never {
  throw new Error(message)
}

const reload = vi.fn()

beforeEach(() => {
  reload.mockClear()
  sessionStorage.clear()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.stubGlobal('location', { ...window.location, reload })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('ErrorBoundary', () => {
  it('shows the recovery screen when a child throws', () => {
    render(
      <ErrorBoundary>
        <Boom message="kaput" />
      </ErrorBoundary>,
    )
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to your workspaces' })).toHaveAttribute(
      'href',
      '/app',
    )
    expect(screen.getByText(/kaput/)).toBeInTheDocument()
    expect(reload).not.toHaveBeenCalled()
  })

  it('reloads once on a chunk load error, then shows the screen on the second', () => {
    const chunk = 'Failed to fetch dynamically imported module: /x.js'
    const { unmount } = render(
      <ErrorBoundary>
        <Boom message={chunk} />
      </ErrorBoundary>,
    )
    expect(reload).toHaveBeenCalledTimes(1)
    unmount()
    render(
      <ErrorBoundary>
        <Boom message={chunk} />
      </ErrorBoundary>,
    )
    expect(reload).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument()
  })

  it('resets an errored boundary when resetKey changes', () => {
    function Page() {
      const { pathname } = useLocation()
      return pathname === '/bad' ? <Boom message="bad page" /> : <p>fine page</p>
    }
    function Shell() {
      const { pathname } = useLocation()
      return (
        <>
          <Link to="/ok">go ok</Link>
          <ErrorBoundary resetKey={pathname}>
            <Page />
          </ErrorBoundary>
        </>
      )
    }
    render(
      <MemoryRouter initialEntries={['/bad']}>
        <Shell />
      </MemoryRouter>,
    )
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('link', { name: 'go ok' }))
    expect(screen.getByText('fine page')).toBeInTheDocument()
  })

  it('keeps a healthy child mounted (state intact) across a resetKey change', () => {
    function Counter() {
      const [n, setN] = useState(0)
      return <button onClick={() => setN(n + 1)}>count {n}</button>
    }
    function Shell() {
      const { pathname } = useLocation()
      return (
        <>
          <Link to="/other">go other</Link>
          <ErrorBoundary resetKey={pathname}>
            <Counter />
          </ErrorBoundary>
        </>
      )
    }
    render(
      <MemoryRouter initialEntries={['/a']}>
        <Shell />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'count 0' }))
    fireEvent.click(screen.getByRole('link', { name: 'go other' }))
    expect(screen.getByRole('button', { name: 'count 1' })).toBeInTheDocument()
  })

  it('announces the fallback with an h1 that receives focus', () => {
    render(
      <ErrorBoundary>
        <Boom message="kaput" />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('alert')).toBeInTheDocument()
    const heading = screen.getByRole('heading', { level: 1, name: 'Something went wrong' })
    expect(heading).toHaveFocus()
  })

  it('reloads again for a chunk error more than 5 minutes after the last reload', () => {
    const chunk = 'error loading dynamically imported module'
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000_000)
    render(
      <ErrorBoundary>
        <Boom message={chunk} />
      </ErrorBoundary>,
    )
    expect(reload).toHaveBeenCalledTimes(1)
    expect(sessionStorage.getItem('squash:chunk-reload-at')).toBe('1000000')
    cleanup()
    now.mockReturnValue(1_000_000 + 4 * 60 * 1000)
    render(
      <ErrorBoundary>
        <Boom message={chunk} />
      </ErrorBoundary>,
    )
    expect(reload).toHaveBeenCalledTimes(1)
    cleanup()
    now.mockReturnValue(1_000_000 + 5 * 60 * 1000 + 1)
    render(
      <ErrorBoundary>
        <Boom message={chunk} />
      </ErrorBoundary>,
    )
    expect(reload).toHaveBeenCalledTimes(2)
  })

  it('does not reload and shows the fallback when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    render(
      <ErrorBoundary>
        <Boom message="Importing a module script failed" />
      </ErrorBoundary>,
    )
    expect(reload).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument()
  })
})
