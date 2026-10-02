import { useEffect, useEffectEvent } from 'react'

/** True when the event target is a text-entry control where typing must not trigger shortcuts. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (tag !== 'INPUT') return false
  const type = (target as HTMLInputElement).type
  return !['button', 'checkbox', 'radio', 'submit', 'reset', 'range', 'color', 'file'].includes(
    type,
  )
}

/** Matches `key` against the event: single letters are case-insensitive, everything else exact. */
function matches(e: KeyboardEvent, key: string): boolean {
  if (/^[a-z]$/i.test(key)) return e.key.toLowerCase() === key.toLowerCase() && !e.shiftKey
  return e.key === key
}

/**
 * Global single-key shortcut. Ignores events with Ctrl/Meta/Alt held, events already handled
 * (defaultPrevented), and keystrokes inside text inputs unless `allowInInput`.
 */
export function useShortcut(
  key: string,
  handler: (e: KeyboardEvent) => void,
  opts?: { enabled?: boolean; allowInInput?: boolean },
): void {
  const enabled = opts?.enabled ?? true
  const allowInInput = opts?.allowInInput ?? false
  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.defaultPrevented || e.isComposing) return
    if (e.metaKey || e.ctrlKey || e.altKey) return
    if (!matches(e, key)) return
    if (!allowInInput && isTypingTarget(e.target)) return
    handler(e)
  })

  useEffect(() => {
    if (!enabled) return
    const listener = (e: KeyboardEvent) => onKey(e)
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [enabled])
}
