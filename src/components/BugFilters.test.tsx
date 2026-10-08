import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ActiveFilters, BugFilters } from './BugFilters'
import { DEFAULT_FILTERS } from '../hooks/useUrlFilters'

afterEach(cleanup)

it('selects a sort from the Sort menu in the Filter popover with the keyboard', () => {
  const onFilters = vi.fn()
  render(<BugFilters filters={DEFAULT_FILTERS} onFilters={onFilters} members={[]} />)
  fireEvent.click(screen.getByRole('button', { name: 'Filter' }))
  const trigger = screen.getByRole('button', { name: /^Sort/ })
  fireEvent.keyDown(trigger, { key: 'ArrowDown' })
  const list = screen.getByRole('listbox', { name: 'Sort' })
  expect(screen.getAllByRole('option').map((o) => o.getAttribute('aria-label'))).toEqual([
    'Newest',
    'Oldest',
    'Severity',
    'Recently active',
  ])
  fireEvent.keyDown(list, { key: 'ArrowDown' })
  fireEvent.keyDown(list, { key: 'ArrowDown' })
  fireEvent.keyDown(list, { key: 'Enter' })
  expect(onFilters).toHaveBeenCalledWith({ ...DEFAULT_FILTERS, sort: 'severity' })
})

it('shows the active sort and clears back to newest', () => {
  const onFilters = vi.fn()
  render(
    <BugFilters
      filters={{ ...DEFAULT_FILTERS, sort: 'oldest' }}
      onFilters={onFilters}
      members={[]}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Filter, 1 active' }))
  expect(screen.getByRole('button', { name: /Sort: Oldest/ })).toBeTruthy()
  cleanup()
  render(
    <ActiveFilters
      filters={{ ...DEFAULT_FILTERS, sort: 'oldest' }}
      onFilters={onFilters}
      members={[]}
    />,
  )
  expect(screen.getByRole('group', { name: 'Active filters' }).textContent).toContain(
    'Sort: Oldest',
  )
  fireEvent.click(screen.getByRole('button', { name: 'Clear Sort filter' }))
  expect(onFilters).toHaveBeenCalledWith({ ...DEFAULT_FILTERS, sort: 'newest' })
})
