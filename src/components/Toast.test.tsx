import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isMac } from '../lib/utils'
import { MAX_TOASTS, ToastProvider, useToast, type ToastOptions } from './Toast'

function setup() {
  let toast!: ReturnType<typeof useToast>['toast']
  function Harness() {
    toast = useToast().toast
    return <input aria-label="Text" />
  }
  const view = render(
    <ToastProvider>
      <Harness />
    </ToastProvider>,
  )
  return {
    ...view,
    toast: (message: string, options?: ToastOptions) => act(() => toast(message, options)),
  }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms))
const undoKey = { key: 'z', ...(isMac ? { metaKey: true } : { ctrlKey: true }) }

describe('Toast', () => {
  it('runs the real action button once and dismisses the notification', () => {
    const { toast } = setup()
    const onAction = vi.fn()
    toast('Resolved #24', { action: { label: 'Undo', onAction } })
    const button = screen.getByRole('button', { name: 'Undo' })
    act(() => button.focus())
    expect(button).toHaveFocus()
    fireEvent.click(button)
    fireEvent.keyDown(document.body, undoKey)
    expect(onAction).toHaveBeenCalledOnce()
    expect(screen.queryByText('Resolved #24')).not.toBeInTheDocument()
  })

  it('expires after five seconds by default and accepts a custom duration', () => {
    const { toast } = setup()
    toast('Default')
    toast('Custom', { duration: 1000 })
    advance(1000)
    expect(screen.queryByText('Custom')).not.toBeInTheDocument()
    advance(3999)
    expect(screen.getByText('Default')).toBeInTheDocument()
    advance(1)
    expect(screen.queryByText('Default')).not.toBeInTheDocument()
  })

  it('pauses on hover and focus until both have left, retaining the remaining duration', () => {
    const { toast } = setup()
    toast('Paused')
    advance(2000)
    const card = screen.getByText('Paused').parentElement!
    fireEvent.mouseEnter(card)
    advance(10000)
    const button = screen.getByRole('button', { name: 'Dismiss notification' })
    act(() => button.focus())
    fireEvent.mouseLeave(card)
    advance(10000)
    expect(screen.getByText('Paused')).toBeInTheDocument()
    act(() => screen.getByRole('textbox').focus())
    advance(2999)
    expect(screen.getByText('Paused')).toBeInTheDocument()
    advance(1)
    expect(screen.queryByText('Paused')).not.toBeInTheDocument()
  })

  it('resumes after hover alone and cleans up timers on unmount', () => {
    const { toast, unmount } = setup()
    toast('Hover', { duration: 1000 })
    advance(400)
    const card = screen.getByText('Hover').parentElement!
    fireEvent.mouseEnter(card)
    advance(10000)
    fireEvent.mouseLeave(card)
    advance(599)
    expect(screen.getByText('Hover')).toBeInTheDocument()
    advance(1)
    expect(screen.queryByText('Hover')).not.toBeInTheDocument()
    toast('Unmount')
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('keeps assertive errors until dismissed', () => {
    const { toast } = setup()
    toast('Failed', { tone: 'error', duration: 1 })
    advance(60000)
    expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'assertive')
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }))
    expect(screen.queryByText('Failed')).not.toBeInTheDocument()
  })

  it('Mod+Z consumes the latest available Undo and leaves typing and redo alone', () => {
    const { toast } = setup()
    const first = vi.fn()
    const last = vi.fn()
    toast('First', { action: { label: 'Undo', onAction: first } })
    toast('Last', { action: { label: 'Undo', onAction: last } })
    toast('Informational')
    fireEvent.keyDown(screen.getByRole('textbox'), undoKey)
    fireEvent.keyDown(document.body, { ...undoKey, shiftKey: true })
    expect(last).not.toHaveBeenCalled()
    fireEvent.keyDown(document.body, undoKey)
    expect(last).toHaveBeenCalledOnce()
    expect(first).not.toHaveBeenCalled()
    fireEvent.keyDown(document.body, undoKey)
    expect(first).toHaveBeenCalledOnce()
  })

  it('drops the oldest toast and its timer at the cap', () => {
    const { toast } = setup()
    const onAction = vi.fn()
    toast('Oldest', { action: { label: 'Undo', onAction } })
    for (let i = 0; i < MAX_TOASTS; i++) toast(`Toast ${i}`)
    expect(screen.queryByText('Oldest')).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Dismiss notification' })).toHaveLength(MAX_TOASTS)
    expect(vi.getTimerCount()).toBe(MAX_TOASTS)
    fireEvent.keyDown(document.body, undoKey)
    expect(onAction).not.toHaveBeenCalled()
  })
})
