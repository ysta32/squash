import { useEffect, type RefObject } from 'react'

const FOCUSABLE =
  'a[href],button:not(:disabled),input:not(:disabled),select,textarea,[tabindex]:not([tabindex="-1"])'

/** Text-entry controls a dialog can open on; read-only inputs (links, commands) don't count. */
export const FIELD_SELECTOR =
  'input:not(:disabled):not([readonly]):not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"]),textarea:not(:disabled):not([readonly]),select:not(:disabled)'

const stack: HTMLElement[] = []

export interface FocusTrapOptions {
  /**
   * Where focus lands on activation. `first` (default): the `data-autofocus` element, else the
   * first focusable. `field`: the `data-autofocus` element, else the first editable field, else
   * the container itself, so modal dialogs never open with a ring on a button.
   */
  initialFocus?: 'first' | 'field'
}

/**
 * Traps keyboard focus inside `ref` while `active`. Moves focus in on activation (see
 * `initialFocus`), wraps Tab / Shift+Tab, and restores the previously focused element on
 * deactivation or unmount. Does not handle Escape.
 */
export function useFocusTrap(
  ref: RefObject<HTMLElement | null>,
  active = true,
  { initialFocus = 'first' }: FocusTrapOptions = {},
): void {
  useEffect(() => {
    const root = ref.current
    if (!active || !root) return
    stack.push(root)
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null

    const focusables = () =>
      Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => !el.closest('[hidden],[inert]'),
      )

    const visible = (el: HTMLElement) => !el.closest('[hidden],[inert]')
    const preferred = focusables().find((el) => el.hasAttribute('data-autofocus'))
    const first =
      preferred ??
      (initialFocus === 'field'
        ? Array.from(root.querySelectorAll<HTMLElement>(FIELD_SELECTOR)).find(visible)
        : focusables()[0])
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
      const focused = document.activeElement
      if (
        previous?.isConnected &&
        (focused === null || focused === document.body || root.contains(focused))
      ) {
        previous.focus()
      }
    }
  }, [ref, active, initialFocus])
}
