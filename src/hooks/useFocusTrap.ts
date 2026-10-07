import { useEffect, type RefObject } from 'react'

const FOCUSABLE =
  'a[href],button:not(:disabled),input:not(:disabled),select,textarea,[tabindex]:not([tabindex="-1"])'

const stack: HTMLElement[] = []

/**
 * Traps keyboard focus inside `ref` while `active`. Focuses the first focusable
 * element on activation, wraps Tab / Shift+Tab, and restores the previously
 * focused element on deactivation or unmount. Does not handle Escape.
 */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, active = true): void {
  useEffect(() => {
    const root = ref.current
    if (!active || !root) return
    stack.push(root)
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null

    const focusables = () =>
      Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => !el.closest('[hidden],[inert]'),
      )

    const first = focusables().find((el) => el.hasAttribute('data-autofocus')) ?? focusables()[0]
    if (first) first.focus()
    else {
      root.tabIndex = -1
      root.focus()
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || event.isComposing) return
      if (stack[stack.length - 1] !== root) return
      const items = focusables()
      if (items.length === 0) {
        event.preventDefault()
        root.focus()
        return
      }
      const index = items.indexOf(document.activeElement as HTMLElement)
      const last = items.length - 1
      if (index < 0) {
        event.preventDefault()
        items[event.shiftKey ? last : 0].focus()
      } else if (event.shiftKey && index === 0) {
        event.preventDefault()
        items[last].focus()
      } else if (!event.shiftKey && index === last) {
        event.preventDefault()
        items[0].focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      const at = stack.lastIndexOf(root)
      if (at >= 0) stack.splice(at, 1)
      if (previous?.isConnected) previous.focus()
    }
  }, [ref, active])
}
