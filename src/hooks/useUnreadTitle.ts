import { useEffect } from 'react'

export function useUnreadTitle(count: number, baseTitle?: string): void {
  useEffect(() => {
    const originalTitle = document.title
    const base = baseTitle ?? originalTitle
    document.title = count > 0 ? `(${count}) ${base}` : base
    return () => {
      document.title = originalTitle
    }
  }, [count, baseTitle])
}
