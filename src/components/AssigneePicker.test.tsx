import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WorkspaceMember } from '../lib/types'
import { AssigneePicker } from './AssigneePicker'

function member(name: string): WorkspaceMember {
  const id = name.toLowerCase()
  return {
    workspace_id: 'ws',
    user_id: id,
    role: 'member',
    joined_at: '2026-10-01T10:00:00Z',
    profile: {
      id,
      display_name: name,
      avatar_url: null,
      avatar_color: '#7c3aed',
      created_at: '2026-10-01T10:00:00Z',
    },
  }
}

const members = ['Ada', 'Grace', 'Linus'].map(member)

/** Visible option labels, without the decorative (aria-hidden) avatar initials. */
const names = () =>
  screen.getAllByRole('option').map((option) => {
    const copy = option.cloneNode(true) as HTMLElement
    copy.querySelectorAll('[aria-hidden="true"]').forEach((el) => el.remove())
    return copy.textContent
  })

const scrollIntoView = vi.fn()

beforeEach(() => {
  Element.prototype.scrollIntoView = scrollIntoView
})
afterEach(() => {
  cleanup()
  scrollIntoView.mockClear()
})

describe('AssigneePicker', () => {
  it('shows Unassigned and lists Assign to me first, then the other members', () => {
    render(<AssigneePicker members={members} value={null} onChange={vi.fn()} selfId="ada" />)
    const trigger = screen.getByRole('button', { name: 'Assignee: Unassigned' })
    expect(trigger).toHaveTextContent(/^Assign$/)
    fireEvent.click(trigger)
    expect(names()).toEqual(['Assign to me', 'Grace', 'Linus'])
    const options = within(screen.getByRole('listbox')).getAllByRole('option')
    expect(options.every((o) => o.getAttribute('aria-selected') === 'false')).toBe(true)
    expect(document.activeElement).toBe(screen.getByRole('listbox'))
  })

  it('drops the menu below by default and opens it upwards with side="above" align="start"', () => {
    const menu = () => screen.getByRole('listbox').parentElement
    render(<AssigneePicker members={members} value={null} onChange={vi.fn()} selfId="ada" />)
    fireEvent.click(screen.getByRole('button', { name: 'Assignee: Unassigned' }))
    expect(menu()).toHaveClass('top-full', 'right-0')
    expect(menu()).not.toHaveClass('bottom-full')
    cleanup()
    render(
      <AssigneePicker
        members={members}
        value={null}
        onChange={vi.fn()}
        selfId="ada"
        side="above"
        align="start"
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Assignee: Unassigned' }))
    expect(menu()).toHaveClass('bottom-full', 'left-0')
    expect(menu()).not.toHaveClass('top-full')
  })

  it('selects with the arrow keys and Enter, then returns focus to the trigger', () => {
    const onChange = vi.fn()
    render(<AssigneePicker members={members} value={null} onChange={onChange} selfId="ada" />)
    const trigger = screen.getByRole('button', { name: 'Assignee: Unassigned' })
    fireEvent.click(trigger)
    const listbox = screen.getByRole('listbox')
    fireEvent.keyDown(listbox, { key: 'ArrowDown' })
    fireEvent.keyDown(listbox, { key: 'ArrowDown' })
    expect(listbox).toHaveAttribute(
      'aria-activedescendant',
      within(listbox).getByRole('option', { name: 'Linus' }).id,
    )
    expect(scrollIntoView).toHaveBeenLastCalledWith({ block: 'nearest' })
    expect(scrollIntoView.mock.contexts.at(-1)).toBe(
      within(listbox).getByRole('option', { name: 'Linus' }),
    )
    fireEvent.keyDown(listbox, { key: 'ArrowDown' }) // wraps to the top
    fireEvent.keyDown(listbox, { key: 'ArrowUp' })
    fireEvent.keyDown(listbox, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('linus')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(document.activeElement).toBe(trigger)
  })

  it('marks the current assignee and offers Unassign last', () => {
    const onChange = vi.fn()
    render(<AssigneePicker members={members} value="grace" onChange={onChange} selfId="ada" />)
    const trigger = screen.getByRole('button', { name: 'Assignee: Grace' })
    expect(trigger).toHaveTextContent(/^Assigned to.*Grace$/)
    fireEvent.click(trigger)
    expect(screen.getByRole('option', { name: 'Grace' })).toHaveAttribute('aria-selected', 'true')
    const listbox = screen.getByRole('listbox')
    fireEvent.keyDown(listbox, { key: 'End' })
    fireEvent.keyDown(listbox, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('does not call onChange when picking the current assignee', () => {
    const onChange = vi.fn()
    render(<AssigneePicker members={members} value="ada" onChange={onChange} selfId="ada" />)
    fireEvent.click(screen.getByRole('button', { name: 'Assignee: Ada' }))
    fireEvent.click(screen.getByRole('option', { name: 'Assign to me' }))
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('Esc closes without a change', () => {
    const onChange = vi.fn()
    render(<AssigneePicker members={members} value={null} onChange={onChange} selfId="ada" />)
    const trigger = screen.getByRole('button', { name: 'Assignee: Unassigned' })
    fireEvent.click(trigger)
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' })
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(document.activeElement).toBe(trigger)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('filters by typing when there are more than five members', () => {
    const many = ['Ada', 'Grace', 'Linus', 'Barbara', 'Ken', 'Margaret'].map(member)
    const onChange = vi.fn()
    render(<AssigneePicker members={many} value={null} onChange={onChange} selfId="ada" />)
    fireEvent.click(screen.getByRole('button', { name: 'Assignee: Unassigned' }))
    const input = screen.getByRole('textbox', { name: 'Filter people' })
    expect(document.activeElement).toBe(input)
    fireEvent.change(input, { target: { value: 'ar' } })
    expect(names()).toEqual(['Barbara', 'Margaret'])
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('margaret')
  })

  it('opens on request and stays closed when disabled', () => {
    const { rerender } = render(
      <AssigneePicker
        members={members}
        value={null}
        onChange={vi.fn()}
        selfId="ada"
        disabled
        openRequest={0}
      />,
    )
    rerender(
      <AssigneePicker
        members={members}
        value={null}
        onChange={vi.fn()}
        selfId="ada"
        disabled
        openRequest={1}
      />,
    )
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    rerender(
      <AssigneePicker
        members={members}
        value={null}
        onChange={vi.fn()}
        selfId="ada"
        openRequest={2}
      />,
    )
    expect(screen.getByRole('listbox')).toBeInTheDocument()
  })
})
