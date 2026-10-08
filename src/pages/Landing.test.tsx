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
      'Bug reports your cofounder actually reads.',
    )
    const sections = [
      'A screenshot in a chat channel is not a bug report.',
      'Capture, mark up, fix.',
      'Checked, not claimed.',
      'The rest of the drawer.',
      'Every action has a key.',
      'Enforced in Postgres.',
      'Self-host in 5 minutes.',
      'File the next bug in Squash.',
    ]
    const h2s = screen
      .getAllByRole('heading', { level: 2 })
      .map((h) => h.textContent)
      .filter((text) => sections.includes(text ?? ''))
    // Hook, problem, product, proof, depth, action: in narrative order.
    expect(h2s).toEqual(sections)
    for (const chapter of [
      'Paste, type, press Enter.',
      'Point at the problem, not around it.',
      'Send it to Claude Code. Watch the fix.',
    ]) {
      expect(screen.getByRole('heading', { level: 3, name: chapter })).toBeInTheDocument()
    }

    const open = screen.getAllByRole('link', { name: 'Open a workspace' })
    expect(open.length).toBeGreaterThanOrEqual(3)
    for (const link of open) expect(link).toHaveAttribute('href', '/signin')

    const nav = screen.getAllByRole('navigation', { name: 'Main navigation' })[0]
    expect(within(nav).getByRole('link', { name: 'Features' })).toHaveAttribute(
      'href',
      '/#features',
    )
    expect(within(nav).getByRole('link', { name: 'Changelog' })).toHaveAttribute(
      'href',
      '/changelog',
    )
    expect(within(nav).getByRole('link', { name: 'Docs' })).toHaveAttribute('href', '/docs')
    expect(within(nav).getByRole('link', { name: 'Self-host' })).toHaveAttribute(
      'href',
      '/#self-host',
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
      'https://github.com/example/squash#self-host',
    )
  })

  it('sends signed-in visitors straight to the app', () => {
    auth.user = { id: 'u1' }
    renderLanding()
    const open = screen.getAllByRole('link', { name: 'Open a workspace' })
    expect(open.length).toBeGreaterThanOrEqual(3)
    for (const link of open) expect(link).toHaveAttribute('href', '/app')
  })

  it('shows sized product screenshots with alt text, lazy below the fold', () => {
    renderLanding()
    const images = screen.getAllByRole('img')
    // Hero plus one screenshot per chapter; decorative drawings are hidden from assistive tech.
    expect(images).toHaveLength(4)
    const intrinsic: Record<string, [number, number]> = {
      workspace: [1600, 1000],
      capture: [1400, 544],
      annotate: [1400, 1111],
      claude: [1400, 710],
    }
    for (const img of images) {
      expect(img.getAttribute('alt')?.length).toBeGreaterThan(20)
      expect(img).toHaveAttribute('src', expect.stringMatching(/^\/product\/[a-z]+-light\.webp$/))
      const name = /^\/product\/([a-z]+)/.exec(img.getAttribute('src') ?? '')?.[1] ?? ''
      expect([Number(img.getAttribute('width')), Number(img.getAttribute('height'))]).toEqual(
        intrinsic[name],
      )
    }
    const [hero, ...rest] = images
    expect(hero).toHaveAttribute('src', '/product/workspace-light.webp')
    expect(hero).toHaveAttribute('loading', 'eager')
    for (const img of rest) expect(img).toHaveAttribute('loading', 'lazy')
  })

  it('matches screenshots to the dark theme', () => {
    localStorage.setItem('squash:theme', 'dark')
    renderLanding()
    const sources = screen.getAllByRole('img').map((img) => img.getAttribute('src'))
    expect(sources).toEqual([
      '/product/workspace-dark.webp',
      '/product/capture-dark.webp',
      '/product/annotate-dark.webp',
      '/product/claude-dark.webp',
    ])
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
    // The typed specimen label is read whole, not character by character.
    expect(
      screen.getByText('No. 024 · Bug · Critical', { selector: '.sr-only' }),
    ).toBeInTheDocument()
  })

  it('keeps copy free of exclamation marks and hype words', () => {
    const { container } = renderLanding()
    expect(container.textContent).not.toContain('!')
    expect(container.textContent).not.toMatch(/supercharge|unlock|seamless|effortless|revolutioni/i)
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
