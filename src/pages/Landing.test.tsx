import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Landing from './Landing'
import Privacy from './Privacy'
import Terms from './Terms'
import { LandingDemo } from '../components/LandingDemo'

function mockMotion(reduced: boolean) {
  const media = new EventTarget()
  Object.assign(media, { matches: reduced, media: '(prefers-reduced-motion: reduce)' })
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => media),
  )
  return media
}

beforeEach(() => {
  mockMotion(false)
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('Landing', () => {
  it('renders the pitch, features, and navigation without console errors', () => {
    const errors = vi.spyOn(console, 'error')
    const warnings = vi.spyOn(console, 'warn')
    vi.stubEnv('VITE_GITHUB_URL', '')
    render(
      <MemoryRouter>
        <Landing />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Bug reports your cofounder actually reads.',
    )
    for (const title of [
      'Paste a screenshot',
      'Speak it',
      'Real-time',
      'Resolve with a note',
      'Invite in 30s',
      'Open source',
    ]) {
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument()
    }
    for (const link of screen.getAllByRole('link', { name: 'Get started free' })) {
      expect(link).toHaveAttribute('href', '/signin')
    }
    expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy')
    expect(screen.getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '/terms')
    for (const link of screen.getAllByRole('link', { name: 'GitHub' })) {
      expect(link).toHaveAttribute('href', 'https://github.com/')
    }
    expect(errors).not.toHaveBeenCalled()
    expect(warnings).not.toHaveBeenCalled()
  })

  it('uses the configured GitHub URL', () => {
    vi.stubEnv('VITE_GITHUB_URL', 'https://github.com/example/squash')
    render(
      <MemoryRouter>
        <Landing />
      </MemoryRouter>,
    )
    expect(screen.getAllByRole('link', { name: 'GitHub' })[0]).toHaveAttribute(
      'href',
      'https://github.com/example/squash',
    )
  })

  it('pastes, types, submits, delivers, and repeats after eight seconds', () => {
    vi.useFakeTimers()
    const { unmount } = render(<LandingDemo />)
    const screenshot = screen.getByText('checkout-mobile.png')
    const toast = screen.getByText('Alex filed #14')
    expect(screenshot).toHaveClass('opacity-0')
    expect(toast).toHaveClass('opacity-0')
    act(() => vi.advanceTimersByTime(700))
    expect(screenshot).toHaveClass('opacity-100')
    act(() => vi.advanceTimersByTime(700))
    expect(screen.getByText('C', { exact: true })).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(2600))
    expect(screen.getByText('Filed. Back to building.')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(300))
    expect(screen.getByText('#14 · Alex · just now · 1 screenshot').parentElement).toHaveClass(
      'opacity-100',
    )
    act(() => vi.advanceTimersByTime(400))
    expect(toast).toHaveClass('opacity-100')
    act(() => vi.advanceTimersByTime(3301))
    expect(screenshot).toHaveClass('opacity-0')
    expect(toast).toHaveClass('opacity-0')
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('pauses the animation and resumes on request', () => {
    vi.useFakeTimers()
    render(<LandingDemo />)
    act(() => vi.advanceTimersByTime(700))
    fireEvent.click(screen.getByRole('button', { name: 'Pause demo' }))
    expect(vi.getTimerCount()).toBe(0)
    act(() => vi.advanceTimersByTime(8000))
    expect(screen.getByText('Alex filed #14')).toHaveClass('opacity-0')
    fireEvent.click(screen.getByRole('button', { name: 'Play demo' }))
    act(() => vi.advanceTimersByTime(4700))
    expect(screen.getByText('Alex filed #14')).toHaveClass('opacity-100')
  })

  it('shows a static completed demo for reduced motion and reacts to preference changes', () => {
    vi.useFakeTimers()
    const media = mockMotion(true)
    render(<LandingDemo />)
    expect(screen.getByText('Alex filed #14')).toHaveClass('opacity-100')
    expect(screen.queryByRole('button', { name: 'Pause demo' })).not.toBeInTheDocument()
    expect(vi.getTimerCount()).toBe(0)
    act(() => {
      Object.assign(media, { matches: false })
      media.dispatchEvent(new Event('change'))
    })
    expect(screen.getByRole('button', { name: 'Pause demo' })).toBeInTheDocument()
    expect(vi.getTimerCount()).toBeGreaterThan(0)
    act(() => {
      Object.assign(media, { matches: true })
      media.dispatchEvent(new Event('change'))
    })
    expect(vi.getTimerCount()).toBe(0)
    expect(screen.getByText('Alex filed #14')).toHaveClass('opacity-100')
  })

  it.each([
    { Page: Privacy, name: 'Privacy' },
    { Page: Terms, name: 'Terms' },
  ])('labels the $name page as a maintainer placeholder', ({ Page, name }) => {
    render(
      <MemoryRouter>
        <Page />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { level: 1, name })).toBeInTheDocument()
    expect(screen.getByRole('note')).toHaveTextContent(
      `Maintainer: edit this page before launch (src/pages/${name}.tsx)`,
    )
  })
})
