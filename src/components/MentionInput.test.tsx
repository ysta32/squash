import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { WorkspaceMember } from '../lib/types'
import { MentionInput } from './MentionInput'

function member(id: string, name: string): WorkspaceMember {
  return {
    workspace_id: 'w',
    user_id: id,
    role: 'member',
    joined_at: '2024-01-01',
    profile: { id, display_name: name, avatar_url: null, avatar_color: '#123456' },
  } as unknown as WorkspaceMember
}

const members = [
  member('1', 'Ada Lovelace'),
  member('2', 'Alan Turing'),
  member('3', 'Grace Hopper'),
]

function Harness({ onSubmit, list = members }: { onSubmit: () => void; list?: WorkspaceMember[] }) {
  const [v, setV] = useState('')
  return (
    <MentionInput
      value={v}
      onChange={setV}
      onSubmit={onSubmit}
      members={list}
      ariaLabel="Comment"
    />
  )
}

function type(el: HTMLElement, text: string) {
  const ta = el as HTMLTextAreaElement
  fireEvent.change(ta, {
    target: { value: text, selectionStart: text.length, selectionEnd: text.length },
  })
}

describe('MentionInput', () => {
  afterEach(cleanup)

  it('opens on @ and filters members', () => {
    render(<Harness onSubmit={vi.fn()} />)
    const box = screen.getByRole('combobox')
    expect(box.getAttribute('aria-expanded')).toBe('false')
    type(box, '@')
    expect(box.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getAllByRole('option')).toHaveLength(3)
    type(box, '@al')
    expect(screen.getAllByRole('option')).toHaveLength(2)
    type(box, '@HOP')
    expect(screen.getAllByRole('option')).toHaveLength(1)
    expect(screen.getByRole('option').textContent).toContain('Grace Hopper')
  })

  it('inserts the token with keyboard selection', () => {
    render(<Harness onSubmit={vi.fn()} />)
    const box = screen.getByRole('combobox') as HTMLTextAreaElement
    type(box, 'hi @al')
    fireEvent.keyDown(box, { key: 'ArrowDown' })
    fireEvent.keyDown(box, { key: 'Enter' })
    expect(box.value).toBe('hi @AdaLovelace ')
    expect(box.getAttribute('aria-expanded')).toBe('false')
  })

  it('inserts with Tab on the first match', () => {
    render(<Harness onSubmit={vi.fn()} />)
    const box = screen.getByRole('combobox') as HTMLTextAreaElement
    type(box, '@ada')
    fireEvent.keyDown(box, { key: 'Tab' })
    expect(box.value).toBe('@AdaLovelace ')
  })

  it('submits on Enter only when the list is closed', () => {
    const onSubmit = vi.fn()
    render(<Harness onSubmit={onSubmit} />)
    const box = screen.getByRole('combobox')
    type(box, '@ada')
    fireEvent.keyDown(box, { key: 'Enter' })
    expect(onSubmit).not.toHaveBeenCalled()
    type(box, 'hello')
    fireEvent.keyDown(box, { key: 'Enter' })
    expect(onSubmit).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(box, { key: 'Enter', shiftKey: true })
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('matches accented and non-Latin names', () => {
    const many = [member('1', 'José García'), member('2', 'Łukasz Nowak'), member('3', '李雷')]
    render(<Harness onSubmit={vi.fn()} list={many} />)
    const box = screen.getByRole('combobox')
    type(box, '@')
    expect(screen.getAllByRole('option')).toHaveLength(3)
    fireEvent.change(box, { target: { value: '@José', selectionStart: 5, selectionEnd: 5 } })
    expect(screen.getAllByRole('option')).toHaveLength(1)
    fireEvent.change(box, { target: { value: '@李', selectionStart: 2, selectionEnd: 2 } })
    expect(screen.getAllByRole('option')).toHaveLength(1)
  })

  it('ignores keys while composing (IME)', () => {
    const onSubmit = vi.fn()
    render(<Harness onSubmit={onSubmit} />)
    const box = screen.getByRole('combobox') as HTMLTextAreaElement
    type(box, '@ada')
    fireEvent.keyDown(box, { key: 'Enter', isComposing: true })
    expect(box.value).toBe('@ada')
    expect(onSubmit).not.toHaveBeenCalled()
    type(box, 'x')
    fireEvent.keyDown(box, { key: 'Enter', isComposing: true })
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('closes on Escape', () => {
    render(<Harness onSubmit={vi.fn()} />)
    const box = screen.getByRole('combobox')
    type(box, '@a')
    expect(screen.queryByRole('listbox')).not.toBeNull()
    fireEvent.keyDown(box, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(box.getAttribute('aria-expanded')).toBe('false')
  })
})
