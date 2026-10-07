import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Landing from '../pages/Landing'
import Privacy from '../pages/Privacy'
import Settings from '../pages/Settings'
import SignIn from '../pages/SignIn'
import Terms from '../pages/Terms'

const mocks = vi.hoisted(() => {
  const profile = {
    id: 'self',
    display_name: 'Ada',
    avatar_url: null,
    avatar_color: '#ef4444',
    created_at: '',
  }
  const workspace = {
    id: 'ws',
    name: 'My workspace',
    owner_id: 'self',
    invite_code: 'INVITE',
    created_at: '',
  }
  return { profile, workspace, user: null as { id: string } | null }
})
vi.mock('../lib/auth', () => ({
  useAuth: () => ({
    user: mocks.user,
    profile: mocks.profile,
    loading: false,
    refreshProfile: vi.fn(),
    signOut: vi.fn(),
    signInWithGoogle: vi.fn(),
    signInWithEmail: vi.fn(),
  }),
}))
vi.mock('../hooks/useWorkspaces', () => ({
  LAST_WORKSPACE_KEY: 'squash:lastWorkspace',
  useWorkspace: () => ({
    workspace: mocks.workspace,
    members: [
      { workspace_id: 'ws', user_id: 'self', role: 'owner', joined_at: '', profile: mocks.profile },
    ],
    role: 'owner',
    loading: false,
    notFound: false,
    rename: vi.fn(),
    regenerateInviteCode: vi.fn(),
    removeMember: vi.fn(),
    deleteWorkspace: vi.fn(),
    transferOwnership: vi.fn(),
  }),
  useWorkspaces: () => ({
    workspaces: [mocks.workspace],
    loading: false,
    error: null,
    refresh: vi.fn(),
  }),
}))
vi.mock('../lib/supabase', () => {
  const result = Promise.resolve({ data: [], error: null })
  return {
    supabase: {
      from: () => ({
        update: () => ({ eq: () => result }),
        select: () => ({ eq: () => result, in: () => result }),
      }),
      storage: { from: () => ({ list: () => result, remove: () => result }) },
      rpc: () => result,
      auth: { signInWithOAuth: vi.fn(), signInWithOtp: vi.fn() },
    },
  }
})

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select, textarea, summary, [tabindex]:not([tabindex="-1"])'

const pages: [string, string, React.ReactElement][] = [
  ['Settings', '/app/ws/settings', <Settings />],
  ['Landing', '/', <Landing />],
  ['Privacy', '/', <Privacy />],
  ['Terms', '/', <Terms />],
  ['SignIn (AuthLayout)', '/', <SignIn />],
]

beforeEach(() => {
  mocks.user = null
  localStorage.clear()
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => Object.assign(new EventTarget(), { matches: false, media: '' })),
  )
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('skip link on full pages', () => {
  it.each(pages)('%s has one skip link, first focusable, and one #main', (_name, path, element) => {
    const { container } = render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/app/:workspaceId/settings" element={element} />
          <Route path="*" element={element} />
        </Routes>
      </MemoryRouter>,
    )
    const links = screen.getAllByRole('link', { name: 'Skip to content' })
    expect(links).toHaveLength(1)
    expect(links[0].getAttribute('href')).toBe('#main')
    expect(container.querySelector(FOCUSABLE)).toBe(links[0])
    expect(container.querySelectorAll('#main')).toHaveLength(1)
  })
})
