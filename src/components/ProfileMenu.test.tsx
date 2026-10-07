import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProfileMenu } from './ProfileMenu'

const signOut = vi.fn<() => Promise<void>>()
vi.mock('../lib/auth', () => ({
  useAuth: () => ({
    profile: {
      id: 'u1',
      display_name: 'Ada Lovelace',
      avatar_url: null,
      avatar_color: '#7c3aed',
      created_at: '2026-10-01T10:00:00Z',
    },
    user: { id: 'u1', email: 'ada@example.com' },
    signOut,
  }),
}))

afterEach(() => {
  cleanup()
  signOut.mockReset()
})

function open() {
  render(
    <MemoryRouter>
      <ProfileMenu workspaceId="ws" />
    </MemoryRouter>,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Profile menu' }))
  return screen.getByRole('menu')
}

describe('ProfileMenu', () => {
  it('shows name and email with Settings and Sign out items', () => {
    const menu = open()
    expect(menu).toHaveTextContent('Ada Lovelace')
    expect(menu).toHaveTextContent('ada@example.com')
    expect(screen.getByRole('menuitem', { name: 'Settings' })).toHaveAttribute(
      'href',
      '/app/ws/settings',
    )
    expect(screen.getAllByRole('menuitem').map((el) => el.textContent)).toEqual([
      'Settings',
      'Sign out',
    ])
  })

  it('arrow keys cycle focus and Escape closes the menu', () => {
    const menu = open()
    fireEvent.keyDown(menu, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Settings' }))
    fireEvent.keyDown(menu, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Sign out' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('surfaces sign-out failures', async () => {
    signOut.mockRejectedValue(new Error('Network down'))
    open()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Network down')
  })
})
