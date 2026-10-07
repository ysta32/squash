import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SkipLink } from './SkipLink'

describe('SkipLink', () => {
  it('renders a link targeting #main', () => {
    render(<SkipLink />)
    const link = screen.getByRole('link', { name: 'Skip to content' })
    expect(link.getAttribute('href')).toBe('#main')
    expect(link.className).toContain('sr-only')
    expect(link.className).toContain('focus:not-sr-only')
  })
})
