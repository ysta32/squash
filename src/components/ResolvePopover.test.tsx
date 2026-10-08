import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ResolvePopover } from './ResolvePopover'

afterEach(cleanup)

function sheet() {
  const onClose = vi.fn()
  const onConfirm = vi.fn()
  render(
    <ResolvePopover
      mode="resolve"
      open
      placement="responsive"
      onClose={onClose}
      onConfirm={onConfirm}
    />,
  )
  return { onClose, onConfirm, grab: screen.getByTestId('sheet-grab') }
}

describe('ResolvePopover phone sheet', () => {
  it('has a Close button that dismisses without resolving', () => {
    const { onClose, onConfirm } = sheet()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledOnce()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('closes when the grab bar is dragged down far enough', () => {
    const { onClose, grab } = sheet()
    fireEvent.pointerDown(grab, { pointerId: 1, clientY: 600 })
    fireEvent.pointerMove(grab, { pointerId: 1, clientY: 700 })
    expect(screen.getByRole('dialog').style.transform).toBe('translateY(100px)')
    fireEvent.pointerUp(grab, { pointerId: 1, clientY: 700 })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('springs back after a short drag, an upward drag or a cancelled one', () => {
    const { onClose, grab } = sheet()
    fireEvent.pointerDown(grab, { pointerId: 1, clientY: 600 })
    fireEvent.pointerMove(grab, { pointerId: 1, clientY: 630 })
    fireEvent.pointerUp(grab, { pointerId: 1, clientY: 630 })
    fireEvent.pointerDown(grab, { pointerId: 2, clientY: 600 })
    fireEvent.pointerMove(grab, { pointerId: 2, clientY: 400 })
    expect(screen.getByRole('dialog').style.transform).toBe('')
    fireEvent.pointerUp(grab, { pointerId: 2, clientY: 400 })
    fireEvent.pointerDown(grab, { pointerId: 3, clientY: 600 })
    fireEvent.pointerMove(grab, { pointerId: 3, clientY: 800 })
    fireEvent.pointerCancel(grab, { pointerId: 3, clientY: 800 })
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog').style.transform).toBe('')
  })

  it('ignores a second pointer while one is dragging', () => {
    const { onClose, grab } = sheet()
    fireEvent.pointerDown(grab, { pointerId: 1, clientY: 600 })
    fireEvent.pointerDown(grab, { pointerId: 2, clientY: 600 })
    fireEvent.pointerMove(grab, { pointerId: 2, clientY: 800 })
    fireEvent.pointerUp(grab, { pointerId: 2, clientY: 800 })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('has no grab bar as an anchored popover', () => {
    render(<ResolvePopover mode="resolve" open onClose={() => {}} onConfirm={() => {}} />)
    expect(screen.queryByTestId('sheet-grab')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull()
  })
})
