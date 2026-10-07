import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SeverityPicker } from './SeverityPicker'

function setup(onChange = vi.fn()) {
  render(<SeverityPicker value="medium" onChange={onChange} />)
  return { onChange, trigger: screen.getByRole('button', { name: 'Severity: Medium' }) }
}

describe('SeverityPicker', () => {
  afterEach(cleanup)

  it('shows the current severity as a labelled trigger, closed by default', () => {
    const { trigger } = setup()
    expect(trigger).toHaveTextContent('Medium')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('opens a listbox of all four with the current one selected, and picks on click', () => {
    const { onChange, trigger } = setup()
    fireEvent.click(trigger)
    const list = screen.getByRole('listbox', { name: 'Severity' })
    expect(document.activeElement).toBe(list)
    const options = screen.getAllByRole('option')
    expect(options.map((o) => o.textContent)).toEqual(['Low1', 'Medium2', 'High3', 'Critical4'])
    expect(screen.getByRole('option', { name: /Medium/ })).toHaveAttribute('aria-selected', 'true')
    fireEvent.click(screen.getByRole('option', { name: /Critical/ }))
    expect(onChange).toHaveBeenCalledWith('critical')
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it('arrow keys move and Enter picks; Esc closes without changing', () => {
    const { onChange, trigger } = setup()
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    const list = screen.getByRole('listbox')
    expect(list).toHaveAttribute('aria-activedescendant', screen.getAllByRole('option')[1].id)
    fireEvent.keyDown(list, { key: 'ArrowDown' })
    fireEvent.keyDown(list, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('high')

    fireEvent.click(trigger)
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' })
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(document.activeElement).toBe(trigger)
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('digits 1-4 pick directly from the trigger or the open list', () => {
    const { onChange, trigger } = setup()
    fireEvent.keyDown(trigger, { key: '1' })
    expect(onChange).toHaveBeenLastCalledWith('low')
    fireEvent.click(trigger)
    fireEvent.keyDown(screen.getByRole('listbox'), { key: '4' })
    expect(onChange).toHaveBeenLastCalledWith('critical')
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('closes on outside pointerdown', () => {
    const { trigger } = setup()
    fireEvent.click(trigger)
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('cannot be opened when disabled', () => {
    render(<SeverityPicker value="high" onChange={vi.fn()} disabled />)
    const trigger = screen.getByRole('button', { name: 'Severity: High' })
    expect(trigger).toBeDisabled()
  })
})
