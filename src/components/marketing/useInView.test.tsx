import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Reveal } from './Reveal'

type Callback = (entries: Partial<IntersectionObserverEntry>[]) => void

let callbacks: Callback[] = []
const disconnect = vi.fn()

class FakeObserver {
  constructor(cb: Callback) {
    callbacks.push(cb)
  }
  observe() {}
  disconnect = disconnect
}

function fire(isIntersecting: boolean, top: number) {
  act(() => {
    for (const cb of callbacks) {
      cb([{ isIntersecting, boundingClientRect: { top } as DOMRectReadOnly }])
    }
  })
}

describe('Reveal', () => {
  beforeEach(() => {
    callbacks = []
    disconnect.mockClear()
    vi.stubGlobal('IntersectionObserver', FakeObserver)
    vi.stubGlobal('innerHeight', 800)
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  function node() {
    return screen.getByText('Body').parentElement!
  }

  it('is visible before the observer reports, so a slow observer never hides content', () => {
    render(
      <Reveal>
        <p>Body</p>
      </Reveal>,
    )
    expect(node()).toHaveAttribute('data-reveal', 'idle')
  })

  it('hides only content measured below the fold, then shows it once it scrolls in', () => {
    render(
      <Reveal>
        <p>Body</p>
      </Reveal>,
    )
    fire(false, 1200)
    expect(node()).toHaveAttribute('data-reveal', 'hidden')
    fire(true, 600)
    expect(node()).toHaveAttribute('data-reveal', 'shown')
    expect(disconnect).toHaveBeenCalled()
  })

  it('shows content that starts above the viewport instead of hiding it', () => {
    render(
      <Reveal>
        <p>Body</p>
      </Reveal>,
    )
    fire(false, -400)
    expect(node()).toHaveAttribute('data-reveal', 'shown')
  })

  it('shows content already on screen without hiding it first', () => {
    render(
      <Reveal>
        <p>Body</p>
      </Reveal>,
    )
    fire(true, 100)
    expect(node()).toHaveAttribute('data-reveal', 'shown')
  })
})
