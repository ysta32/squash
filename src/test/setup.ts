import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'

// Saved drafts (src/lib/drafts.ts) live in localStorage: start every test without them.
afterEach(() => {
  if (typeof localStorage !== 'undefined') localStorage.clear()
})
