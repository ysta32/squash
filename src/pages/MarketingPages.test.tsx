import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import type { ComponentType } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { computeContent } from '../../vite-plugin-content'
import { content } from '../components/marketing/content'
import { clearSiteJsonCache } from '../components/marketing/siteJson'
import { PRESS_COLORS } from '../components/marketing/pressColors'
import { SHORTCUTS_SLOT } from '../components/marketing/slots'
import { SHORTCUTS_MARKER } from '../../vite-plugin-content'
import { facts } from '../components/marketing/facts'
import About from './About'
import Changelog from './Changelog'
import ClaudeGuide from './ClaudeGuide'
import Docs from './Docs'
import Faq from './Faq'
import Features from './Features'
import Press from './Press'
import Pricing from './Pricing'
import Status from './Status'

vi.mock('../lib/auth', () => ({
  useAuth: () => ({ user: null, profile: null, loading: false }),
}))
vi.mock('../lib/supabase', () => ({ supabase: {} }))

/** The JSON files the build emits, served to the pages' fetches as the real site would. */
let files: Record<string, string> = {}
beforeAll(() => {
  files = computeContent(process.cwd()).files
})

function serveContent() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), 'http://localhost')
    const body = files[url.pathname.replace(/^\//, '')]
    if (body === undefined) return new Response('missing', { status: 404 })
    return new Response(body, { status: 200, headers: { 'content-type': 'application/json' } })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function renderAt(path: string, pattern: string, Page: ComponentType) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={pattern} element={<Page />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  clearSiteJsonCache()
  serveContent()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

const ROUTES: { path: string; pattern: string; Page: ComponentType; h1: RegExp | string }[] = [
  {
    path: '/features',
    pattern: '/features',
    Page: Features,
    h1: 'Everything Squash does, on one page.',
  },
  { path: '/pricing', pattern: '/pricing', Page: Pricing, h1: 'Free. MIT licensed.' },
  {
    path: '/changelog',
    pattern: '/changelog',
    Page: Changelog,
    h1: 'What changed, release by release.',
  },
  { path: '/docs', pattern: '/docs', Page: Docs, h1: 'Run, use and self-host Squash.' },
  ...content.docs.map((doc) => ({
    path: `/docs/${doc.slug}`,
    pattern: '/docs/:slug',
    Page: Docs,
    h1: doc.title,
  })),
  { path: '/claude', pattern: '/claude', Page: ClaudeGuide, h1: /Claude Code/ },
  { path: '/faq', pattern: '/faq', Page: Faq, h1: 'Questions, answered from the code.' },
  {
    path: '/about',
    pattern: '/about',
    Page: About,
    h1: 'An open-source bug tracker for small teams.',
  },
  { path: '/press', pattern: '/press', Page: Press, h1: 'Logos, colours, type and screenshots.' },
  { path: '/status', pattern: '/status', Page: Status, h1: 'Is Squash reachable right now?' },
]

describe('marketing pages', () => {
  it.each(ROUTES)('$path renders its heading inside the shared nav and footer', async (route) => {
    const errors = vi.spyOn(console, 'error')
    const { container } = renderAt(route.path, route.pattern, route.Page)
    expect(screen.getByRole('heading', { level: 1, name: route.h1 })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    const nav = screen.getAllByRole('navigation', { name: 'Main navigation' })[0]
    expect(within(nav).getByRole('link', { name: 'Docs' })).toHaveAttribute('href', '/docs')
    for (const link of screen.getAllByRole('link', { name: 'GitHub' })) {
      expect(link).not.toHaveTextContent(/\d/)
    }
    expect(screen.getByRole('navigation', { name: 'Footer navigation' })).toBeInTheDocument()
    expect(screen.getByRole('main')).toBeInTheDocument()
    // Fetched content (docs, changelog) has settled before the copy check.
    await waitFor(() => expect(screen.queryByRole('status', { name: /^Loading/ })).toBeNull())
    expect(container.textContent).not.toContain('!')
    expect(container.textContent).not.toMatch(/supercharge|unlock|seamless|effortless|revolutioni/i)
    expect(errors).not.toHaveBeenCalled()
  })

  it('marks the current section in the nav', () => {
    renderAt('/docs/self-host', '/docs/:slug', Docs)
    const nav = screen.getAllByRole('navigation', { name: 'Main navigation' })[0]
    expect(within(nav).getByRole('link', { name: 'Self-host' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(within(nav).getByRole('link', { name: 'Docs' })).not.toHaveAttribute('aria-current')
  })

  it('renders a docs page from its JSON with heading permalinks and the live shortcut table', async () => {
    renderAt('/docs/keyboard', '/docs/:slug', Docs)
    const table = await screen.findByRole('table', { name: 'Keyboard shortcuts' })
    expect(within(table).getAllByRole('row')).toHaveLength(facts.shortcuts.length + 1)
    const meta = content.docs.find((doc) => doc.slug === 'keyboard')!
    for (const heading of meta.headings) {
      expect(document.getElementById(heading.id)).toBeInTheDocument()
    }
    expect(SHORTCUTS_SLOT).toBe(SHORTCUTS_MARKER)
  })

  it('sends unknown docs pages to the 404', () => {
    renderAt('/docs/nope', '/docs/:slug', Docs)
    expect(screen.queryByRole('heading', { level: 1, name: /nope/i })).toBeNull()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('This page escaped.')
  })

  it('shows a retry when a docs page fails to load', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('gone', { status: 500 })),
    )
    renderAt('/docs/capture', '/docs/:slug', Docs)
    expect(await screen.findByRole('alert')).toHaveTextContent('This page didn’t load')
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })

  it('lists every release with a permalink and labels Unreleased', async () => {
    renderAt('/changelog', '/changelog', Changelog)
    expect(document.getElementById('unreleased')).toHaveTextContent(/Unreleased/)
    for (const release of content.releases) {
      const heading = document.getElementById(release.id)
      expect(heading).toBeInTheDocument()
      expect(heading?.textContent).toContain(release.version)
    }
    expect(screen.getByRole('link', { name: /RSS/ })).toHaveAttribute('href', '/changelog.xml')
    await waitFor(() => expect(screen.queryByRole('status', { name: /^Loading/ })).toBeNull())
  })

  it('offers real screenshots from docs/screenshots as press downloads', () => {
    renderAt('/press', '/press', Press)
    expect(content.press.length).toBeGreaterThan(5)
    for (const shot of content.press) {
      expect(shot.file).toMatch(/^\/press\/[a-z-]+\.png$/)
      expect(shot.width).toBeGreaterThan(0)
    }
    expect(screen.queryByText(/testimonial|as seen in|featured in/i)).toBeNull()
  })

  it('press colours match the design tokens', async () => {
    const { readFileSync } = await import('node:fs')
    const css = readFileSync('src/index.css', 'utf8').toLowerCase()
    for (const color of PRESS_COLORS) expect(css).toContain(color.hex.toLowerCase())
  })
})

describe('status page', () => {
  it('degrades to "not configured" without Supabase settings and still times the app', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL) => new Response('{}', { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const { container } = renderAt('/status', '/status', Status)
    expect(container.textContent).toMatch(/checked from your browser/i)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Check again' })).toBeEnabled())
    expect(screen.getAllByText('Not configured')).toHaveLength(2)
    expect(screen.getByText('Reachable')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 2, name: /not configured on this build/ }),
    ).toBeInTheDocument()
    // Only the app's own origin was contacted.
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/manifest\.webmanifest$/)
    expect(screen.getByRole('link', { name: 'Vercel status' })).toHaveAttribute(
      'href',
      'https://www.vercel-status.com',
    )
    expect(screen.getByRole('link', { name: 'Supabase status' })).toHaveAttribute(
      'href',
      'https://status.supabase.com',
    )
  })
})
