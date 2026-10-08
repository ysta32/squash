import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LIST_WIDTH, useListWidth } from '../lib/listWidth'
import { PaneSplitter } from './PaneSplitter'

function Harness() {
  const [width, setWidth] = useListWidth()
  return <PaneSplitter width={width} onWidth={setWidth} controls="pane" />
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
})
