/**
 * Unsent text (the capture bar, comment boxes) kept in localStorage so a reload, a crash or a
 * closed tab does not lose what was typed. Cleared once sent or emptied, and on sign-out so the
 * next person on a shared browser does not see it.
 */
const PREFIX = 'squash:draft:'

export function readDraft<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw === null ? null : (JSON.parse(raw) as T)
  } catch {
    // Blocked storage or a corrupt entry: start empty.
    return null
  }
}

/** Saves `draft`, or removes the entry when it is `null`. */
export function writeDraft<T>(key: string, draft: T | null): void {
  try {
    if (draft === null) localStorage.removeItem(PREFIX + key)
    else localStorage.setItem(PREFIX + key, JSON.stringify(draft))
  } catch {
    // Storage blocked or full: the draft still lives in the page until it is reloaded.
  }
}

export function clearDrafts(): void {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i)
      if (key?.startsWith(PREFIX)) localStorage.removeItem(key)
    }
  } catch {
    // Nothing to clear when storage is blocked.
  }
}
