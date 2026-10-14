import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { facts } from '../components/marketing/facts'
import Landing from './Landing'
import Privacy from './Privacy'
import Terms from './Terms'

const auth = vi.hoisted(() => ({ user: null as { id: string } | null }))
vi.mock('../lib/auth', () => ({
  useAuth: () => ({ user: auth.user, profile: null, loading: false }),
}))

function mockColorScheme(dark: boolean) {
  const media = new EventTarget()
  Object.assign(media, { matches: dark, media: '(prefers-color-scheme: dark)' })
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => media),
  )
}

function renderLanding() {
  return render(
    <MemoryRouter>
      <Landing />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  auth.user = null
  localStorage.clear()
  mockColorScheme(false)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  document.documentElement.classList.remove('dark')
})

describe('Landing', () => {
  it('tells the story in order with real headings, links and no console noise', () => {
    const errors = vi.spyOn(console, 'error')
    const warnings = vi.spyOn(console, 'warn')
    vi.stubEnv('VITE_GITHUB_URL', '')
    renderLanding()

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'File it in the four seconds you still care.',
    )
    // The page is three screens: the hero, the stage, and the way in. The stage's heading is
    // whichever state of bug 24 the scroll is on, and it opens on the first.
    const sections = ['Paste, type, press Enter.', 'File the next one here.']
    const h2s = screen
      .getAllByRole('heading', { level: 2 })
      .map((h) => h.textContent)
      .filter((text) => sections.includes(text ?? ''))
    expect(h2s).toEqual(sections)
    // The status line carries the bug's five states, each on the key that jumps to it.
    for (const state of ['filed', 'marked up', 'on three screens', 'claude code', 'resolved']) {
      expect(screen.getAllByRole('button', { name: new RegExp(state) }).length).toBeGreaterThan(0)
    }
    // The record opens on the moment it was filed, in the demo workspace's own clock.
    expect(screen.getAllByText('14:02').length).toBeGreaterThan(0)

    const open = screen.getAllByRole('link', { name: 'Open a workspace' })
    expect(open.length).toBeGreaterThanOrEqual(3)
    for (const link of open) expect(link).toHaveAttribute('href', '/signin')

    const nav = screen.getAllByRole('navigation', { name: 'Main navigation' })[0]
    expect(within(nav).getByRole('link', { name: 'Features' })).toHaveAttribute('href', '/features')
    expect(within(nav).getByRole('link', { name: 'Changelog' })).toHaveAttribute(
      'href',
      '/changelog',
    )
    expect(within(nav).getByRole('link', { name: 'Docs' })).toHaveAttribute('href', '/docs')
    expect(within(nav).getByRole('link', { name: 'Self-host' })).toHaveAttribute(
      'href',
      '/docs/self-host',
    )
    for (const link of screen.getAllByRole('link', { name: 'GitHub' })) {
      expect(link).toHaveAttribute('href', 'https://github.com/ysta32/squash')
      expect(link).not.toHaveTextContent(/\d/)
    }
    for (const link of screen.getAllByRole('link', { name: 'Self-host it' })) {
      expect(link).toHaveAttribute('href', '/docs/self-host')
    }
    expect(document.getElementById('features')).toBeInTheDocument()

    const footer = screen.getByRole('navigation', { name: 'Footer navigation' })
    for (const column of ['Product', 'Resources', 'Project', 'Legal']) {
      expect(within(footer).getByRole('heading', { name: column })).toBeInTheDocument()
    }
    expect(within(footer).getByRole('link', { name: 'Privacy' })).toHaveAttribute(
      'href',
      '/privacy',
    )
    expect(within(footer).getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '/terms')
    expect(within(footer).getByRole('link', { name: 'Claude Code guide' })).toHaveAttribute(
      'href',
      '/claude',
    )
    expect(errors).not.toHaveBeenCalled()
    expect(warnings).not.toHaveBeenCalled()
  })

  it('uses the configured GitHub URL', () => {
    vi.stubEnv('VITE_GITHUB_URL', 'https://github.com/example/squash/')
    renderLanding()
    expect(screen.getAllByRole('link', { name: 'GitHub' })[0]).toHaveAttribute(
      'href',
      'https://github.com/example/squash',
    )
  })

  it('sends signed-in visitors straight to the app', () => {
    auth.user = { id: 'u1' }
    renderLanding()
    const open = screen.getAllByRole('link', { name: 'Open a workspace' })
    expect(open.length).toBeGreaterThanOrEqual(3)
    for (const link of open) expect(link).toHaveAttribute('href', '/app')
  })

  it('carries no product screenshots, because the product itself is on the page', () => {
    renderLanding()
    // The record on the stage is built from the app's own parts, and the evidence inside it is
    // drawn; the drawings are hidden from assistive tech, so nothing here is an image.
    expect(screen.queryAllByRole('img')).toHaveLength(0)
  })

  it('states only facts counted from the repository at build time', () => {
    renderLanding()
    expect(facts.tests).toBeGreaterThan(0)
    expect(facts.rlsChecks).toBeGreaterThan(0)
    const close = screen
      .getByRole('heading', { name: 'File the next one here.' })
      .closest('section')!
    const values = within(close)
      .getAllByRole('definition')
      .map((d) => d.textContent)
    expect(values).toEqual([
      String(facts.tests),
      String(facts.rlsChecks),
      facts.license,
      facts.latestRelease.version,
    ])
    expect(within(close).getByRole('link', { name: 'Everything it does' })).toHaveAttribute(
      'href',
      '/features',
    )
  })

  it('files a bug in the capture bar demo without touching the network', () => {
    renderLanding()
    const input = screen.getByRole('textbox', { name: 'Describe a bug' })
    const form = screen.getByRole('form', { name: 'Capture bar demo' })
    const list = screen.getByRole('list', { name: 'Demo bug list' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(2)

    fireEvent.submit(form)
    expect(screen.getByRole('status')).toHaveTextContent('Type what broke first.')
    expect(within(list).getAllByRole('listitem')).toHaveLength(2)

    fireEvent.keyDown(input, { key: '4', code: 'Digit4', altKey: true })
    expect(screen.getByRole('button', { name: /^Severity: critical/ })).toBeInTheDocument()
    fireEvent.change(input, { target: { value: 'Pricing toggle resets on reload' } })
    fireEvent.submit(form)
    expect(screen.getByRole('status')).toHaveTextContent('Filed #26')
    expect(input).toHaveValue('')
    const rows = within(list).getAllByRole('listitem')
    expect(rows[0]).toHaveTextContent('26Pricing toggle resets on reloadnow')
    expect(rows[0]).toHaveClass('mk-arrive')
  })

  it('opens and closes the phone menu from the keyboard', () => {
    renderLanding()
    const toggle = screen.getByRole('button', { name: 'Open menu' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(document.getElementById(toggle.getAttribute('aria-controls')!)).toBeVisible()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(toggle).toHaveFocus()
  })

  it('keeps the navigation sticky and never hides content when motion cannot run', () => {
    renderLanding()
    expect(screen.getByRole('banner')).toHaveClass('sticky', 'top-0')
    // jsdom has no IntersectionObserver, so nothing on this page may depend on one to be shown.
    for (const node of document.querySelectorAll('[data-reveal]')) {
      expect(node).toHaveAttribute('data-reveal', 'shown')
    }
  })

  it('keeps copy free of exclamation marks and hype words', () => {
    const { container } = renderLanding()
    expect(container.textContent).not.toContain('!')
    expect(container.textContent).not.toMatch(/supercharge|unlock|seamless|effortless|revolutioni/i)
  })

  it.each([
    { Page: Privacy, name: 'Privacy' },
    { Page: Terms, name: 'Terms' },
  ])('gives the $name page honest copy inside the marketing chrome', ({ Page, name }) => {
    const { container } = render(
      <MemoryRouter>
        <Page />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { level: 1, name })).toBeInTheDocument()
    expect(screen.getAllByRole('navigation', { name: 'Main navigation' }).length).toBeGreaterThan(0)
    expect(screen.getByRole('navigation', { name: 'Footer navigation' })).toBeInTheDocument()
    expect(container.textContent).toMatch(/Last updated\s*\d{2} [A-Z]{3} \d{4}/)
    expect(container.textContent).toContain('the maintainer of this open-source project')
    expect(container.textContent).not.toMatch(/Maintainer: edit|placeholder|lorem/i)
    expect(container.textContent).not.toContain('!')
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
  })
})
