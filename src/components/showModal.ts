import { FIELD_SELECTOR } from '../hooks/useFocusTrap'

/**
 * Opens a native <dialog> modally with the app's focus rule: the first editable field, else the
 * dialog itself. (showModal alone would focus the first focusable, which is the header's close X.)
 * Safe to call from a ref callback on every render; it does nothing once the dialog is open.
 */
export function showModal(node: HTMLDialogElement | null): void {
  if (!node || node.open) return
  node.showModal()
  const field = Array.from(node.querySelectorAll<HTMLElement>(FIELD_SELECTOR)).find(
    (el) => !el.closest('[hidden],[inert]'),
  )
  if (field) {
    field.focus()
  } else {
    node.tabIndex = -1
    node.focus()
  }
}
