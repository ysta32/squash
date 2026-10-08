import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LIST_WIDTH, WIDE_QUERY, useListWidth } from '../lib/listWidth'
import { PaneSplitter } from './PaneSplitter'

function Harness() {
  const [width, setWidth, reset] = useListWidth()
  return <PaneSplitter width={width} onWidth={setWidth} onReset={reset} controls="pane" />
}

const separator = () => screen.getByRole('separator', { name: 'Resize bug list' })

beforeEach(() => localStorage.clear())
afterEach(cleanup)

describe('PaneSplitter', () => {
  it('resizes from the keyboard within the 400–480px bounds', () => {
    render(<Harness />)
    expect(separator()).toHaveAttribute('aria-valuenow', String(LIST_WIDTH.initial))
    fireEvent.keyDown(separator(), { key: 'ArrowRight' })
    expect(separator()).toHaveAttribute('aria-valuenow', String(LIST_WIDTH.initial + 8))
    fireEvent.keyDown(separator(), { key: 'ArrowLeft', shiftKey: true })
    expect(separator()).toHaveAttribute('aria-valuenow', String(LIST_WIDTH.initial - 32))
    fireEvent.keyDown(separator(), { key: 'End' })
    fireEvent.keyDown(separator(), { key: 'ArrowRight' })
    expect(separator()).toHaveAttribute('aria-valuenow', String(LIST_WIDTH.max))
    fireEvent.keyDown(separator(), { key: 'Home' })
    expect(separator()).toHaveAttribute('aria-valuenow', String(LIST_WIDTH.min))
    fireEvent.doubleClick(separator())
    expect(separator()).toHaveAttribute('aria-valuenow', String(LIST_WIDTH.initial))
  })

  it('remembers the width across sessions and clamps stored values', () => {
    render(<Harness />)
    fireEvent.keyDown(separator(), { key: 'Home' })
    cleanup()
    render(<Harness />)
    expect(separator()).toHaveAttribute('aria-valuenow', String(LIST_WIDTH.min))
    cleanup()
    localStorage.setItem('squash:list-width', '9999')
    render(<Harness />)
    expect(separator()).toHaveAttribute('aria-valuenow', String(LIST_WIDTH.max))
  })

  it('defaults to 480px on wide screens until resized, and double-click returns to that default', () => {
    const original = window.matchMedia
    window.matchMedia = ((query: string) => ({
      matches: query === WIDE_QUERY,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia
    try {
      render(<Harness />)
      expect(separator()).toHaveAttribute('aria-valuenow', String(LIST_WIDTH.wide))
      fireEvent.keyDown(separator(), { key: 'Home' })
      expect(separator()).toHaveAttribute('aria-valuenow', String(LIST_WIDTH.min))
      expect(localStorage.getItem('squash:list-width')).toBe(String(LIST_WIDTH.min))
      fireEvent.doubleClick(separator())
      expect(separator()).toHaveAttribute('aria-valuenow', String(LIST_WIDTH.wide))
      expect(localStorage.getItem('squash:list-width')).toBeNull()
    } finally {
      window.matchMedia = original
    }
  })
})
