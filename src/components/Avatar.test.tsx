import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Avatar } from './Avatar'

const base = { display_name: 'Ada Lovelace', avatar_color: '#ff0000' }

describe('Avatar', () => {
  afterEach(cleanup)

  it('renders initials fallback on avatar_color', () => {
    render(<Avatar profile={{ ...base, avatar_color: '#b91c1c', avatar_url: null }} />)
    const el = screen.getByText('AL')
    expect(el.style.backgroundColor).toBe('rgb(185, 28, 28)')
  })

  it('darkens a low-contrast avatar_color behind the white initials', () => {
    render(<Avatar profile={{ ...base, avatar_url: null }} />)
    const el = screen.getByText('AL')
    expect(el.style.backgroundColor).toBe('rgb(237, 0, 0)')
  })

  it('renders an image when avatar_url is set', () => {
    render(<Avatar profile={{ ...base, avatar_url: 'https://x.test/a.png' }} />)
    const img = screen.getByRole('img')
    expect(img.getAttribute('src')).toBe('https://x.test/a.png')
    expect(img.getAttribute('referrerpolicy')).toBe('no-referrer')
  })

  it('falls back to initials when the image errors', () => {
    render(<Avatar profile={{ ...base, avatar_url: 'https://x.test/bad.png' }} />)
    fireEvent.error(screen.getByRole('img'))
    expect(screen.getByText('AL')).toBeTruthy()
  })

  it('renders ? for null profile', () => {
    render(<Avatar profile={null} />)
    expect(screen.getByText('?')).toBeTruthy()
  })
})
