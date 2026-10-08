import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Tooltip, TOOLTIP_DELAY } from './Tooltip'

function setup(props: { disabled?: boolean } = {}) {
  const onWindowKey = vi.fn((event: KeyboardEvent) => event.defaultPrevented)
  window.addEventListener('keydown', onWindowKey)
  render(
    <Tooltip label="Team stats" shortcut="S" {...props}>
      <button type="button" aria-label="Stats">
        icon
      </button>
    </Tooltip>,
  )
  const button = screen.getByRole('button', { name: 'Stats' })
  const wrapper = button.parentElement as HTMLElement
  const tip = screen.getByText('Team stats').parentElement as HTMLElement
  return {
    button,
    wrapper,
    tip,
    onWindowKey,
    cleanupKey: () => window.removeEventListener('keydown', onWindowKey),
  }
}

function hover(element: HTMLElement) {
  fireEvent.pointerEnter(element, { pointerType: 'mouse' })
  act(() => vi.advanceTimersByTime(TOOLTIP_DELAY))
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('Tooltip', () => {
  it('opens after the hover delay and closes when the pointer leaves', () => {
    const { wrapper, tip, cleanupKey } = setup()
    fireEvent.pointerEnter(wrapper, { pointerType: 'mouse' })
    expect(tip).toHaveAttribute('data-state', 'closed')
    act(() => vi.advanceTimersByTime(TOOLTIP_DELAY))
    expect(tip).toHaveAttribute('data-state', 'open')
    expect(tip).not.toHaveClass('pointer-events-none')
    fireEvent.pointerLeave(wrapper)
    expect(tip).toHaveAttribute('data-state', 'closed')
    expect(tip).toHaveClass('pointer-events-none')
    cleanupKey()
  })

  it('stays open while the pointer is over the tip itself (hoverable)', () => {
    const { wrapper, tip, cleanupKey } = setup()
    hover(wrapper)
    // The tip lives inside the hover area: moving onto it never leaves the wrapper.
    expect(wrapper).toContainElement(tip)
    fireEvent.pointerEnter(tip, { pointerType: 'mouse' })
    act(() => vi.advanceTimersByTime(TOOLTIP_DELAY))
    expect(tip).toHaveAttribute('data-state', 'open')
    cleanupKey()
  })

  it('is dismissed with Escape without moving the pointer, and consumes that Escape', () => {
    const { wrapper, tip, onWindowKey, cleanupKey } = setup()
    hover(wrapper)
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(tip).toHaveAttribute('data-state', 'closed')
    expect(onWindowKey).toHaveReturnedWith(true)
    // Still hovered, still dismissed; a fresh hover brings it back.
    act(() => vi.advanceTimersByTime(TOOLTIP_DELAY))
    expect(tip).toHaveAttribute('data-state', 'closed')
    fireEvent.pointerLeave(wrapper)
    hover(wrapper)
    expect(tip).toHaveAttribute('data-state', 'open')
    cleanupKey()
  })

  it('leaves Escape alone when no tip is showing', () => {
    const { onWindowKey, cleanupKey } = setup()
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(onWindowKey).toHaveReturnedWith(false)
    cleanupKey()
  })

  it('opens on keyboard focus, closes on Escape, and resets on blur', () => {
    // jsdom has no focus-visible heuristics: treat this focus as keyboard focus.
    const matches = Element.prototype.matches
    vi.spyOn(Element.prototype, 'matches').mockImplementation(function (
      this: Element,
      selector: string,
    ) {
      return selector === ':focus-visible' ? true : matches.call(this, selector)
    })
    const { button, tip, cleanupKey } = setup()
    act(() => button.focus())
    expect(tip).toHaveAttribute('data-state', 'open')
    fireEvent.keyDown(button, { key: 'Escape' })
    expect(tip).toHaveAttribute('data-state', 'closed')
    act(() => button.blur())
    act(() => button.focus())
    expect(tip).toHaveAttribute('data-state', 'open')
    vi.restoreAllMocks()
    cleanupKey()
  })

  it('never opens for touch or when disabled', () => {
    const { wrapper, tip, cleanupKey } = setup()
    fireEvent.pointerEnter(wrapper, { pointerType: 'touch' })
    act(() => vi.advanceTimersByTime(TOOLTIP_DELAY))
    expect(tip).toHaveAttribute('data-state', 'closed')
    cleanupKey()
    cleanup()
    render(
      <Tooltip label="Hidden" disabled>
        <button type="button">x</button>
      </Tooltip>,
    )
    expect(screen.queryByText('Hidden')).not.toBeInTheDocument()
  })
})
