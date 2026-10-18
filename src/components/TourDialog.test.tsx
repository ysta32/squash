import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TOUR_SEEN_KEY, tourSeen } from '../lib/tour'
import { TourDialog } from './TourDialog'

afterEach(() => {
  cleanup()
  localStorage.clear()
})

function renderTour(onClose = vi.fn()) {
  render(
    <MemoryRouter>
      <TourDialog open onClose={onClose} />
    </MemoryRouter>,
  )
  return onClose
}

describe('TourDialog', () => {
  it('renders nothing while closed', () => {
    render(
      <MemoryRouter>
        <TourDialog open={false} onClose={() => {}} />
      </MemoryRouter>,
    )
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('steps through every stop, including the new kinds and Claude Code', () => {
    const onClose = renderTour()
    expect(screen.getByText('Tour · 1 of 5')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'File anything in one line' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(
      screen.getByRole('heading', { name: 'Bugs, features, tests and to-dos' }),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByText('Tour · 1 of 5')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^Step 4/ }))
    expect(screen.getByRole('heading', { name: 'Hand work to Claude Code' })).toBeInTheDocument()
    expect(screen.getByText('Ship to main')).toBeInTheDocument()
    expect(screen.getByText('Running')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('Tour · 5 of 5')).toBeInTheDocument()
    expect(tourSeen()).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(onClose).toHaveBeenCalledOnce()
    expect(localStorage.getItem(TOUR_SEEN_KEY)).toBe('true')
  })

  it('closes on Escape and remembers it was seen', () => {
    const onClose = renderTour()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
    expect(tourSeen()).toBe(true)
  })

  it('moves with the arrow keys', () => {
    renderTour()
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByText('Tour · 2 of 5')).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(screen.getByText('Tour · 1 of 5')).toBeInTheDocument()
  })
})
