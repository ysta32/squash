import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { CommandPalette, type Command } from './CommandPalette'

afterEach(cleanup)

function makeCommands(): Command[] {
  return [
    { id: 'new', label: 'New bug', group: 'Actions', hint: 'N', run: vi.fn() },
    { id: 'search', label: 'Search', group: 'Actions', keywords: ['find'], run: vi.fn() },
    { id: 'b12', label: '#12 Login button broken', group: 'Bugs', keywords: ['12'], run: vi.fn() },
    { id: 'b7', label: '#7 Crash on save', group: 'Bugs', keywords: ['7'], run: vi.fn() },
    { id: 'theme', label: 'Toggle theme', group: 'Preferences', run: vi.fn() },
  ]
}

function Harness({ commands, onClose }: { commands: Command[]; onClose?: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open palette
      </button>
      <CommandPalette
        open={open}
        onClose={() => {
          onClose?.()
          setOpen(false)
        }}
        commands={commands}
      />
    </>
  )
}

function openPalette(commands = makeCommands(), onClose?: () => void) {
  render(<Harness commands={commands} onClose={onClose} />)
  const trigger = screen.getByRole('button', { name: 'Open palette' })
  trigger.focus()
  fireEvent.click(trigger)
  return { commands, trigger, input: screen.getByRole('combobox') }
}

const optionNames = () => screen.getAllByRole('option').map((o) => o.textContent)

describe('CommandPalette', () => {
  it('renders nothing when closed', () => {
    render(<CommandPalette open={false} onClose={vi.fn()} commands={makeCommands()} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('exposes dialog, combobox and grouped listbox roles', () => {
    const { input } = openPalette()
    const dialog = screen.getByRole('dialog', { name: 'Command palette' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(document.activeElement).toBe(input)
    const listbox = screen.getByRole('listbox')
    expect(input).toHaveAttribute('aria-controls', listbox.id)
    const first = screen.getAllByRole('option')[0]
    expect(input).toHaveAttribute('aria-activedescendant', first.id)
    expect(first).toHaveAttribute('aria-selected', 'true')
    const bugs = screen.getByRole('group', { name: 'Bugs' })
    expect(within(bugs).getAllByRole('option')).toHaveLength(2)
    expect(within(screen.getByRole('option', { name: /New bug/ })).getByText('N')).toBeTruthy()
  })

  it('filters case-insensitively over label and keywords', () => {
    const { input } = openPalette()
    fireEvent.change(input, { target: { value: 'LOGIN' } })
    expect(optionNames()).toEqual(['#12 Login button broken'])

    fireEvent.change(input, { target: { value: 'find' } })
    expect(optionNames()).toEqual(['Search'])

    fireEvent.change(input, { target: { value: '7' } })
    expect(optionNames()).toEqual(['#7 Crash on save'])

    fireEvent.change(input, { target: { value: 'tgth' } })
    expect(optionNames()).toEqual(['Toggle theme'])

    fireEvent.change(input, { target: { value: 'zzzz' } })
    expect(screen.queryAllByRole('option')).toHaveLength(0)
    expect(screen.getByText('No matching commands')).toBeInTheDocument()
    expect(input).not.toHaveAttribute('aria-activedescendant')
  })

  it('ranks prefix matches above substring above subsequence matches', () => {
    const cmds: Command[] = [
      { id: 'a', label: 'Abc sequence', group: 'G', run: vi.fn() },
      { id: 'b', label: 'Has seq inside', group: 'G', run: vi.fn() },
      { id: 'c', label: 'Seq first', group: 'G', run: vi.fn() },
    ]
    const { input } = openPalette(cmds)
    expect(optionNames()).toEqual(['Abc sequence', 'Has seq inside', 'Seq first'])
    fireEvent.change(input, { target: { value: 'seq' } })
    expect(optionNames()).toEqual(['Seq first', 'Abc sequence', 'Has seq inside'])
    fireEvent.change(input, { target: { value: 'sqc' } })
    expect(optionNames()).toEqual(['Abc sequence'])
  })

  it('arrow keys move the active option with wrap-around and Enter runs it and closes', () => {
    const onClose = vi.fn()
    const { commands, input, trigger } = openPalette(makeCommands(), onClose)
    const active = () => document.getElementById(input.getAttribute('aria-activedescendant')!)

    fireEvent.keyDown(input, { key: 'ArrowUp' })
    expect(active()).toHaveTextContent('Toggle theme')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(active()).toHaveTextContent('New bug')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(active()).toHaveTextContent('#12 Login button broken')
    expect(active()).toHaveAttribute('aria-selected', 'true')

    fireEvent.keyDown(input, { key: 'Enter' })
    expect(commands[2].run).toHaveBeenCalledTimes(1)
    expect(commands[0].run).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it('clicking an option runs it', () => {
    const { commands } = openPalette()
    fireEvent.click(screen.getByRole('option', { name: /Crash on save/ }))
    expect(commands[3].run).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('Esc closes without running anything and restores focus', () => {
    const { commands, trigger } = openPalette()
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(trigger)
    for (const c of commands) expect(c.run).not.toHaveBeenCalled()
  })

  it('keeps focus in the input when non-interactive content is pressed, and traps Tab', () => {
    const { input } = openPalette()
    const heading = screen.getByText('Bugs')
    expect(fireEvent.mouseDown(heading)).toBe(false)
    expect(fireEvent.mouseDown(screen.getByRole('option', { name: /Crash on save/ }))).toBe(false)
    expect(fireEvent.mouseDown(input)).toBe(true)

    fireEvent.change(input, { target: { value: 'zzzz' } })
    expect(fireEvent.mouseDown(screen.getByText('No matching commands'))).toBe(false)

    input.blur()
    expect(document.activeElement).toBe(document.body)
    expect(fireEvent.keyDown(document.body, { key: 'Tab' })).toBe(false)
    expect(document.activeElement).toBe(input)
    expect(fireEvent.keyDown(input, { key: 'Tab', shiftKey: true })).toBe(false)
    expect(document.activeElement).toBe(input)
  })

  it('clicking outside closes', () => {
    openPalette()
    const backdrop = screen.getByRole('dialog').parentElement!
    fireEvent.mouseDown(screen.getByRole('dialog'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.mouseDown(backdrop)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('a command that moves focus keeps it after the palette closes', () => {
    const target = document.createElement('input')
    document.body.appendChild(target)
    try {
      const commands = makeCommands()
      commands[0].run = () => target.focus()
      const { input } = openPalette(commands)
      fireEvent.keyDown(input, { key: 'Enter' })
      expect(document.activeElement).toBe(target)
    } finally {
      target.remove()
    }
  })
})
