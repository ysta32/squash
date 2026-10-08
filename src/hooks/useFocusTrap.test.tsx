import { useRef, type ReactNode } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { useFocusTrap } from './useFocusTrap'

function Trap({ active = true, empty = false }: { active?: boolean; empty?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useFocusTrap(ref, active)
  return (
    <div ref={ref} data-testid="trap">
      {!empty && (
        <>
          <button>one</button>
          <button disabled>skipped</button>
          <input aria-label="two" />
          <button>three</button>
        </>
      )}
    </div>
  )
}

function Harness({
  show,
  active,
  children,
}: {
  show: boolean
  active?: boolean
  children?: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  useFocusTrap(ref, Boolean(children) && show)
  return (
    <>
      <button>outside</button>
      <button>another outside</button>
      {children && <div ref={ref}>{children}</div>}
      {!children && show && <Trap active={active} />}
    </>
  )
}

describe('useFocusTrap', () => {
  afterEach(cleanup)

  it('focuses the first focusable on activation', () => {
    render(<Trap />)
    expect(document.activeElement).toBe(screen.getByText('one'))
  })

  it('focuses the container when nothing is focusable', () => {
    render(<Trap empty />)
    expect(document.activeElement).toBe(screen.getByTestId('trap'))
  })

  it('wraps Tab forward from last to first', () => {
    render(<Trap />)
    screen.getByText('three').focus()
    expect(fireEvent.keyDown(document.activeElement!, { key: 'Tab' })).toBe(false)
    expect(document.activeElement).toBe(screen.getByText('one'))
  })

  it('wraps Shift+Tab backward from first to last', () => {
    render(<Trap />)
    expect(fireEvent.keyDown(document.activeElement!, { key: 'Tab', shiftKey: true })).toBe(false)
    expect(document.activeElement).toBe(screen.getByText('three'))
  })

  it('leaves Tab alone in the middle', () => {
    render(<Trap />)
    screen.getByLabelText('two').focus()
    expect(fireEvent.keyDown(document.activeElement!, { key: 'Tab' })).toBe(true)
  })

  it('restores focus on unmount', () => {
    const { rerender } = render(<Harness show={false} />)
    screen.getByText('outside').focus()
    rerender(<Harness show />)
    expect(document.activeElement).toBe(screen.getByText('one'))
    rerender(<Harness show={false} />)
    expect(document.activeElement).toBe(screen.getByText('outside'))
  })

  it('does nothing when inactive', () => {
    render(<Harness show active={false} />)
    screen.getByText('outside').focus()
    expect(document.activeElement).toBe(screen.getByText('outside'))
    expect(fireEvent.keyDown(screen.getByText('three'), { key: 'Tab' })).toBe(true)
  })

  it.each(['unmount', 'deactivate'])('preserves focus moved outside before %s', (action) => {
    const { rerender } = render(<Harness show={false} />)
    screen.getByText('outside').focus()
    rerender(<Harness show />)
    expect(document.activeElement).toBe(screen.getByText('one'))
    const outside = screen.getByText('another outside')
    outside.focus()
    rerender(<Harness show={action !== 'unmount'} active={false} />)
    expect(document.activeElement).toBe(outside)
  })

  it('skips hidden and inert focusables when wrapping', () => {
    render(
      <Harness show>
        <button>a</button>
        <button hidden>ghost</button>
        <div inert>
          <button>frozen</button>
        </div>
      </Harness>,
    )
    expect(document.activeElement).toBe(screen.getByText('a'))
    fireEvent.keyDown(document.activeElement!, { key: 'Tab' })
    expect(document.activeElement).toBe(screen.getByText('a'))
  })

  it('restores focus when deactivated while mounted', () => {
    const { rerender } = render(<Harness show={false} />)
    screen.getByText('outside').focus()
    rerender(<Harness show active />)
    expect(document.activeElement).toBe(screen.getByText('one'))
    rerender(<Harness show active={false} />)
    expect(document.activeElement).toBe(screen.getByText('outside'))
  })

  it('prefers [data-autofocus] and restores the pre-mount element', () => {
    function Auto() {
      const ref = useRef<HTMLDivElement>(null)
      useFocusTrap(ref)
      return (
        <div ref={ref}>
          <button>first</button>
          <textarea data-autofocus aria-label="note" />
        </div>
      )
    }
    const { rerender } = render(<Harness show={false} />)
    screen.getByText('outside').focus()
    rerender(
      <>
        <Harness show={false} />
        <Auto />
      </>,
    )
    expect(document.activeElement).toBe(screen.getByLabelText('note'))
    rerender(<Harness show={false} />)
    expect(document.activeElement).toBe(screen.getByText('outside'))
  })

  it('only the topmost of nested traps handles Tab', () => {
    function Nested({ inner }: { inner: boolean }) {
      const lower = useRef<HTMLDivElement>(null)
      const upper = useRef<HTMLDivElement>(null)
      useFocusTrap(lower)
      return (
        <>
          <div ref={lower}>
            <button>l1</button>
            <button>l2</button>
          </div>
          {inner && <Upper innerRef={upper} />}
        </>
      )
    }
    function Upper({ innerRef }: { innerRef: React.RefObject<HTMLDivElement | null> }) {
      useFocusTrap(innerRef)
      return (
        <div ref={innerRef}>
          <button>u1</button>
          <button>u2</button>
        </div>
      )
    }
    const { rerender } = render(<Nested inner={false} />)
    rerender(<Nested inner />)
    expect(document.activeElement).toBe(screen.getByText('u1'))
    screen.getByText('u2').focus()
    fireEvent.keyDown(document.activeElement!, { key: 'Tab' })
    expect(document.activeElement).toBe(screen.getByText('u1'))
    rerender(<Nested inner={false} />)
    expect(document.activeElement).toBe(screen.getByText('l1'))
    screen.getByText('l2').focus()
    fireEvent.keyDown(document.activeElement!, { key: 'Tab' })
    expect(document.activeElement).toBe(screen.getByText('l1'))
  })
  describe("initialFocus: 'field'", () => {
    function FieldTrap({ children }: { children: ReactNode }) {
      const ref = useRef<HTMLDivElement>(null)
      useFocusTrap(ref, true, { initialFocus: 'field' })
      return (
        <div ref={ref} data-testid="field-trap">
          {children}
        </div>
      )
    }

    it('skips buttons and read-only inputs for the first editable field', () => {
      render(
        <FieldTrap>
          <button>close</button>
          <input readOnly aria-label="link" defaultValue="x" />
          <input disabled aria-label="off" />
          <input aria-label="name" />
        </FieldTrap>,
      )
      expect(document.activeElement).toBe(screen.getByLabelText('name'))
    })

    it('falls back to the container when there is no field', () => {
      render(
        <FieldTrap>
          <button>close</button>
          <input readOnly aria-label="link" defaultValue="x" />
        </FieldTrap>,
      )
      const trap = screen.getByTestId('field-trap')
      expect(document.activeElement).toBe(trap)
      expect(trap.tabIndex).toBe(-1)
      expect(fireEvent.keyDown(trap, { key: 'Tab' })).toBe(false)
      expect(document.activeElement).toBe(screen.getByText('close'))
    })

    it('still honours [data-autofocus]', () => {
      render(
        <FieldTrap>
          <input aria-label="name" />
          <button data-autofocus>go</button>
        </FieldTrap>,
      )
      expect(document.activeElement).toBe(screen.getByText('go'))
    })
  })
})
