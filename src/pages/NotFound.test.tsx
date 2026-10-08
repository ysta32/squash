import { cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import NotFound from './NotFound'

vi.mock('../lib/auth', () => ({
  useAuth: () => ({ user: null, profile: null, loading: false }),
}))

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<p>home</p>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  document.title = 'Squash'
})
afterEach(cleanup)

describe('NotFound', () => {
  it('labels the missing path as a specimen and offers a way back', () => {
    renderAt('/no-such-page')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('This page escaped.')
    expect(screen.getByText(/It may have been moved or squashed\./)).toBeInTheDocument()
    const label = screen.getByText('/no-such-page').closest('div')
    expect(label).toHaveTextContent('No. 404·, Not found·, /no-such-page')
    const next = screen.getByRole('navigation', { name: 'Where to go next' })
    expect(next.querySelectorAll('a')).toHaveLength(3)
    expect(within(next).getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/')
    expect(within(next).getByRole('link', { name: 'Docs' })).toHaveAttribute('href', '/docs')
    expect(within(next).getByRole('link', { name: 'Changelog' })).toHaveAttribute(
      'href',
      '/changelog',
    )
    // Shares the marketing shell: one skip link, one #main, the sitemap footer.
    expect(screen.getAllByRole('link', { name: 'Skip to content' })).toHaveLength(1)
    expect(document.querySelectorAll('#main')).toHaveLength(1)
    expect(screen.getByRole('navigation', { name: 'Footer navigation' })).toBeInTheDocument()
  })

  it('asks search engines not to index it, and cleans up after leaving', () => {
    const { unmount } = renderAt('/old/link')
    const robots = document.head.querySelectorAll('meta[name="robots"]')
    expect(robots).toHaveLength(1)
    expect(robots[0]).toHaveAttribute('content', 'noindex')
    expect(document.title).toBe('Page not found · Squash')
    unmount()
    expect(document.head.querySelector('meta[name="robots"]')).toBeNull()
    expect(document.title).toBe('Squash')
  })
})
