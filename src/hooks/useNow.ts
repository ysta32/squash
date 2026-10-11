import { useEffect, useState } from 'react'

/** Re-renders every few seconds so "updated 12s ago" stays current while Claude works. */
export function useNow(live: boolean): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    if (!live) return
    const timer = setInterval(() => setNow(new Date()), 5000)
    return () => clearInterval(timer)
  }, [live])
  return now
}
