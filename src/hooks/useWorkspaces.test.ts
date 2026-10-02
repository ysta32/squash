import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../lib/supabase', () => ({ supabase: {} }))
vi.mock('../lib/auth', () => ({ useAuth: () => ({ user: null }) }))

import {
  LAST_WORKSPACE_KEY,
  friendlyError,
  getLastWorkspace,
  inviteUrl,
  setLastWorkspace,
} from './useWorkspaces'

describe('inviteUrl', () => {
  it('builds a join url from the origin', () => {
    expect(inviteUrl('ABCD1234')).toBe(`${location.origin}/join/ABCD1234`)
  })
})

describe('last workspace', () => {
  beforeEach(() => localStorage.clear())

  it('returns null when unset', () => {
    expect(getLastWorkspace()).toBeNull()
  })

  it('round-trips through localStorage', () => {
    setLastWorkspace('ws-1')
    expect(localStorage.getItem(LAST_WORKSPACE_KEY)).toBe('ws-1')
    expect(getLastWorkspace()).toBe('ws-1')
  })
})

describe('friendlyError', () => {
  it('maps known codes', () => {
    expect(friendlyError({ message: 'member_limit' })).toBe('This workspace is full (10 members).')
    expect(friendlyError(new Error('workspace_limit'))).toBe('You can own up to 5 workspaces.')
    expect(friendlyError({ message: 'invalid_code' })).toBe("That invite code doesn't exist.")
    expect(friendlyError('P0001: not_owner')).toBe('Only the owner can do that.')
  })

  it('falls back to the raw message or a generic one', () => {
    expect(friendlyError({ message: 'boom' })).toBe('boom')
    expect(friendlyError(null)).toBe('Something went wrong.')
  })
})
