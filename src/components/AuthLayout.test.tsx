import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AuthLayout } from './AuthLayout'

describe('AuthLayout', () => {
  it('renders title, description, children, footer and legal links', () => {
    render(
      <MemoryRouter>
        <AuthLayout title="Sign in to Squash" description="Pick a method" footer="Need help">
          <button>Child action</button>
        </AuthLayout>
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: 'Sign in to Squash' })).toBeInTheDocument()
    expect(screen.getByText('Pick a method')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Child action' })).toBeInTheDocument()
    expect(screen.getByText('Need help')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '/terms')
    expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy')
    expect(screen.getByRole('link', { name: 'Squash home' })).toHaveAttribute('href', '/')
  })
})
