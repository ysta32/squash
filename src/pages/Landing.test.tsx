import { cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
  it('renders the pitch, features, and navigation without console errors', () => {
    const errors = vi.spyOn(console, 'error')
    const warnings = vi.spyOn(console, 'warn')
    vi.stubEnv('VITE_GITHUB_URL', '')
    renderLanding()

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Bug tracking at the speed of a screenshot',
    )
    for (const title of [
      'One input, always on screen',
      'Send it to Claude Code and watch it get fixed',
      'Live for everyone on the team',
      'How it works',
      'On your phone, too',
      'Open source and yours to run',
      'The small things, done properly',
      'Questions',
      'File your first bug in under a minute',
    ]) {
      expect(screen.getByRole('heading', { level: 2, name: title })).toBeInTheDocument()
    }
    const getStarted = screen.getAllByRole('link', { name: /^Get started/ })
    expect(getStarted.length).toBeGreaterThanOrEqual(2)
    for (const link of getStarted) expect(link).toHaveAttribute('href', '/signin')
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/signin')
    expect(screen.queryByRole('link', { name: /Open app/ })).not.toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Claude Code' })[0]).toHaveAttribute(
      'href',
      '/claude',
    )
    expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy')
    expect(screen.getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '/terms')
    for (const link of screen.getAllByRole('link', { name: 'GitHub' })) {
      expect(link).toHaveAttribute('href', 'https://github.com/ysta32/squash')
    }
    expect(screen.getByRole('link', { name: 'Self-host it' })).toHaveAttribute(
      'href',
      'https://github.com/ysta32/squash',
    )
    expect(errors).not.toHaveBeenCalled()
    expect(warnings).not.toHaveBeenCalled()
  })

  it('uses the configured GitHub URL', () => {
    vi.stubEnv('VITE_GITHUB_URL', 'https://github.com/example/squash')
    renderLanding()
    expect(screen.getAllByRole('link', { name: 'GitHub' })[0]).toHaveAttribute(
      'href',
      'https://github.com/example/squash',
    )
    expect(screen.getByRole('link', { name: 'Read the self-host guide' })).toHaveAttribute(
      'href',
      'https://github.com/example/squash#self-host',
    )
  })

  it('offers Open app instead of sign-up links when signed in', () => {
    auth.user = { id: 'u1' }
    renderLanding()
    const open = screen.getAllByRole('link', { name: /^Open app/ })
    expect(open.length).toBeGreaterThanOrEqual(2)
    for (const link of open) expect(link).toHaveAttribute('href', '/app')
    expect(screen.queryByRole('link', { name: /^Get started/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Sign in' })).not.toBeInTheDocument()
  })

  it('shows sized product screenshots with alt text, lazy below the fold', () => {
    renderLanding()
    const images = screen.getAllByRole('img')
    // Hero, four feature shots, the command palette, and two phones cropped from mobile.webp.
    expect(images).toHaveLength(8)
    for (const img of images) {
      expect(img.getAttribute('alt')?.length).toBeGreaterThan(20)
      expect(img).toHaveAttribute('src', expect.stringMatching(/^\/product\/[a-z-]+\.webp$/))
      expect(Number(img.getAttribute('width'))).toBeGreaterThan(0)
      expect(Number(img.getAttribute('height'))).toBeGreaterThan(0)
    }
    const [hero, ...rest] = images
    expect(hero).toHaveAttribute('src', '/product/workspace-light.webp')
    expect(hero).toHaveAttribute('loading', 'eager')
    for (const img of rest) expect(img).toHaveAttribute('loading', 'lazy')
    const sources = images.map((img) => img.getAttribute('src'))
    expect(sources).toContain('/product/palette-light.webp')
    expect(sources).toContain('/product/stats-light.webp')
    expect(sources.filter((src) => src === '/product/mobile.webp')).toHaveLength(2)
  })

  it('reserves the real aspect ratio for every screenshot so none render as empty boxes', () => {
    renderLanding()
    const intrinsic: Record<string, [number, number]> = {
      workspace: [1600, 1000],
      capture: [1400, 544],
      annotate: [1400, 991],
      claude: [1400, 1010],
      stats: [720, 375],
      palette: [1000, 761],
      mobile: [1400, 981],
    }
    for (const img of screen.getAllByRole('img')) {
      const name = /^\/product\/([a-z]+)/.exec(img.getAttribute('src') ?? '')?.[1] ?? ''
      expect(intrinsic[name], `unexpected image ${name}`).toBeDefined()
      expect([Number(img.getAttribute('width')), Number(img.getAttribute('height'))]).toEqual(
        intrinsic[name],
      )
    }
  })

  it('keeps the navigation sticky and lets the FAQ chevrons rotate when open', () => {
    renderLanding()
    expect(screen.getByRole('banner')).toHaveClass('sticky', 'top-0')
    const summary = screen.getByText('Is Squash free?').closest('summary')
    expect(summary?.querySelector('svg')).toHaveClass('group-open:rotate-180')
  })

  it('matches screenshots to the dark theme', () => {
    localStorage.setItem('squash:theme', 'dark')
    renderLanding()
    const sources = screen.getAllByRole('img').map((img) => img.getAttribute('src'))
    expect(sources).toContain('/product/workspace-dark.webp')
    expect(sources).toContain('/product/capture-dark.webp')
    expect(sources).toContain('/product/claude-dark.webp')
    expect(sources).toContain('/product/palette-dark.webp')
    expect(sources).not.toContain('/product/workspace-light.webp')
  })

  it('lists keyboard shortcuts and answers common questions', () => {
    renderLanding()
    const shortcuts = screen.getByRole('list', { name: 'Keyboard shortcuts' })
    expect(within(shortcuts).getByText('Enter')).toBeInTheDocument()
    expect(within(shortcuts).getByText('Send to Claude')).toBeInTheDocument()

    expect(screen.getByRole('heading', { level: 2, name: 'Questions' })).toBeInTheDocument()
    const summaries = document.querySelectorAll('details > summary')
    expect(summaries.length).toBeGreaterThanOrEqual(4)
    expect(screen.getByText('Is Squash free?').closest('details')).not.toHaveAttribute('open')
    expect(screen.getByText(/signed links that expire after an hour/)).toBeInTheDocument()
  })

  it('keeps copy free of exclamation marks', () => {
    const { container } = renderLanding()
    expect(container.textContent).not.toContain('!')
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
