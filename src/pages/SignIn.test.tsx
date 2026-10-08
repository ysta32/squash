import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import SignIn from './SignIn'

const auth = vi.hoisted(() => ({
  signInWithMagicLink: vi.fn<(email: string, next: string) => Promise<void>>(),
  signInWithGoogle: vi.fn(),
}))
vi.mock('../lib/auth', () => ({
  useAuth: () => ({ session: null, loading: false, ...auth }),
}))

function renderSignIn() {
  render(
    <MemoryRouter initialEntries={['/signin']}>
      <SignIn />
    </MemoryRouter>,
  )
  return {
    input: screen.getByLabelText('Work email') as HTMLInputElement,
    submit: screen.getByRole('button', { name: 'Email me a link' }),
  }
}

afterEach(() => {
  cleanup()
  auth.signInWithMagicLink.mockReset()
})

describe('SignIn magic link', () => {
  it('keeps the primary button enabled before any input', () => {
    const { submit } = renderSignIn()
    expect(submit).toBeEnabled()
  })

  it('explains an empty address inline on submit and does not send', () => {
    const { input, submit } = renderSignIn()
    fireEvent.click(submit)
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Enter your email address.')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input.getAttribute('aria-describedby')).toContain(alert.id)
    expect(input).toHaveFocus()
    expect(auth.signInWithMagicLink).not.toHaveBeenCalled()
  })

  it('rejects a malformed address, then clears the error as the user types', () => {
    const { input, submit } = renderSignIn()
    fireEvent.change(input, { target: { value: 'ada@company' } })
    fireEvent.click(submit)
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a full email address')
    expect(auth.signInWithMagicLink).not.toHaveBeenCalled()
    fireEvent.change(input, { target: { value: 'ada@company.com' } })
    expect(screen.queryByRole('alert')).toBeNull()
    expect(input).not.toHaveAttribute('aria-invalid')
  })

  it('sends a trimmed valid address', async () => {
    auth.signInWithMagicLink.mockResolvedValue()
    const { input, submit } = renderSignIn()
    fireEvent.change(input, { target: { value: '  ada@company.com ' } })
    fireEvent.click(submit)
    await waitFor(() => expect(screen.getByText('Check your email')).toBeInTheDocument())
    expect(auth.signInWithMagicLink).toHaveBeenCalledWith('ada@company.com', '/app')
  })
})
