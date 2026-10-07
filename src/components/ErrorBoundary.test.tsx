import { cleanup, fireEvent, render, screen } from '@testing-library/react'
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

  it('resets when keyed by a new route', () => {
    function Page() {
      const { pathname } = useLocation()
      return pathname === '/bad' ? <Boom message="bad page" /> : <p>fine page</p>
    }
    function Shell() {
      const { pathname } = useLocation()
      return (
        <>
          <Link to="/ok">go ok</Link>
          <ErrorBoundary key={pathname}>
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
})
