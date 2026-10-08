import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Avatar } from './Avatar'

const base = { display_name: 'Ada Lovelace', avatar_color: '#ff0000' }

describe('Avatar', () => {
  afterEach(cleanup)

  it('renders initials fallback on avatar_color', () => {
    render(<Avatar profile={{ ...base, avatar_color: '#b42318', avatar_url: null }} />)
    const el = screen.getByText('AL')
    expect(el.style.backgroundColor).toBe('rgb(180, 35, 24)')
  })

  it('maps an off-palette avatar_color onto the curated palette behind the white initials', () => {
    render(<Avatar profile={{ ...base, avatar_url: null }} />)
    const el = screen.getByText('AL')
    // #ff0000 lands on Vermilion (#b42318), the nearest-hue palette ink.
    expect(el.style.backgroundColor).toBe('rgb(180, 35, 24)')
  })

  it('hands dark mode the lifted ink for the same palette color', () => {
    render(<Avatar profile={{ ...base, avatar_color: '#57534b', avatar_url: null }} />)
    const el = screen.getByText('AL')
    expect(el.style.getPropertyValue('--avatar-dark')).toBe('#787267')
    expect(el.className).toContain('dark:bg-(--avatar-dark)!')
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
