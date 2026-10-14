import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
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
    const sections = [
      'A screenshot in a channel is not a bug report.',
      // The stage's heading is whichever state of bug 24 the scroll is on; it opens on the first.
      'Paste, type, press Enter.',
      'A list, a record, and nothing else to learn.',
      'Checked, not claimed.',
      'The rest of the drawer.',
      'Every action has a key.',
      'Enforced in Postgres.',
      'Self-host in 5 minutes.',
      'File the next one here.',
    ]
    const h2s = screen
      .getAllByRole('heading', { level: 2 })
      .map((h) => h.textContent)
      .filter((text) => sections.includes(text ?? ''))
    // The page read top to bottom: why the bug was filed, its life on the stage, then the
    // sections that close it out.
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
      expect(link).toHaveAttribute('href', '#self-host')
    }
    expect(document.getElementById('features')).toBeInTheDocument()
    expect(document.getElementById('self-host')).toBeInTheDocument()

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
    expect(screen.getByRole('link', { name: /Read the self-host guide/ })).toHaveAttribute(
      'href',
      '/docs/self-host',
    )
  })

  it('sends signed-in visitors straight to the app', () => {
    auth.user = { id: 'u1' }
    renderLanding()
    const open = screen.getAllByRole('link', { name: 'Open a workspace' })
    expect(open.length).toBeGreaterThanOrEqual(3)
    for (const link of open) expect(link).toHaveAttribute('href', '/app')
  })

  it('shows the one product screenshot sized, with alt text, and lazily', () => {
    renderLanding()
    const images = screen.getAllByRole('img')
    // Everything else on the page is the product itself rather than a picture of it, and the
    // drawings it is built from are hidden from assistive tech.
    expect(images).toHaveLength(1)
    const [workspace] = images
    expect(workspace.getAttribute('alt')?.length).toBeGreaterThan(20)
    expect(workspace).toHaveAttribute('src', '/product/workspace-dark.webp')
    expect(workspace).toHaveAttribute('loading', 'lazy')
    expect([
      Number(workspace.getAttribute('width')),
      Number(workspace.getAttribute('height')),
    ]).toEqual([1600, 1000])
  })

  it('keeps its own world whichever theme is set', () => {
    localStorage.setItem('squash:theme', 'light')
    renderLanding()
    // The home page is a capture of the workspace running, so it does not have a light mode.
    expect(screen.getByRole('img')).toHaveAttribute('src', '/product/workspace-dark.webp')
  })

  it('states only facts counted from the repository at build time', () => {
    renderLanding()
    expect(facts.tests).toBeGreaterThan(0)
    expect(facts.rlsChecks).toBeGreaterThan(0)
    const record = screen
      .getByRole('heading', { name: 'Checked, not claimed.' })
      .closest('section')!
    const terms = within(record)
      .getAllByRole('term')
      .map((t) => t.textContent)
    expect(terms).toEqual([
      'Unit tests',
      'Row Level Security checks',
      'Tagged releases',
      'Entry script budget, gzip',
      'License',
    ])
    const values = within(record)
      .getAllByRole('definition')
      .map((d) => d.textContent)
    for (const value of [
      String(facts.tests),
      String(facts.rlsChecks),
      String(facts.releases),
      `${facts.budgetEntryKb} kB`,
      facts.license,
    ]) {
      expect(values).toContain(value)
    }
    expect(within(record).getByRole('link', { name: /Read the changelog/ })).toHaveAttribute(
      'href',
      '/changelog',
    )
  })

  it('lists the app’s own keyboard shortcuts', () => {
    renderLanding()
    const list = screen.getByRole('list', { name: 'Keyboard shortcuts' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(facts.shortcuts.length)
    expect(within(list).getByText('Command palette')).toBeInTheDocument()
    // Parenthetical notes from the in-app sheet are trimmed for the strip.
    expect(within(list).getByText('Set severity while capturing')).toBeInTheDocument()
    expect(within(list).getAllByText('Ctrl').length).toBeGreaterThan(0)
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

  it('copies self-host commands and says when the clipboard is unavailable', async () => {
    const writeText = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('denied'))
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    renderLanding()
    const copy = screen.getByRole('button', { name: 'Copy: Create the database' })
    await act(async () => fireEvent.click(copy))
    expect(writeText).toHaveBeenCalledWith('npx supabase link && npx supabase db push')
    expect(copy).toHaveTextContent('Copied')
    await act(async () => fireEvent.click(copy))
    expect(copy).toHaveTextContent('Select to copy')
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
    // jsdom has no IntersectionObserver: every reveal must already be shown.
    const reveals = document.querySelectorAll('[data-reveal]')
    expect(reveals.length).toBeGreaterThan(5)
    for (const node of reveals) expect(node).toHaveAttribute('data-reveal', 'shown')
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
