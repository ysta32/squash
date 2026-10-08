import { useEffect } from 'react'

/**
 * Sets the tab title while the page is shown ("Pricing — Squash"), matching the title the build
 * writes into the page's prerendered HTML, and restores the previous one afterwards.
 */
export function usePageTitle(name: string) {
  useEffect(() => {
    const previous = document.title
    document.title = `${name} — Squash`
    return () => {
      document.title = previous
    }
  }, [name])
}
