import { useEffect, useState } from 'react'
import { useRealtimeStatus } from '../hooks/useRealtimeStatus'

/** A dropped socket gets this long to recover quietly before the banner takes over. */
export const RECONNECT_GRACE_MS = 3000

const PILL =
  'pointer-events-none fixed bottom-4 left-4 z-40 flex h-[2rem] items-center gap-2 rounded-md border border-line bg-surface-2 px-3 text-xs text-ink-2 shadow-elev-2 animate-fade'
const BANNER =
  'flex h-[2rem] shrink-0 items-center gap-2 border-b border-line bg-surface-3 px-3 text-xs text-ink-2 sm:px-4'

function Dot() {
  return <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-warning" />
}

/**
 * Connection state under the app header (DESIGN.md "States: Offline"). Renders nothing while
 * connected. When the browser reports no network, a 28px banner explains what still works. A
 * dropped realtime socket first shows a small "Reconnecting…" pill; if it has not recovered after
 * 3s the pill becomes the same banner. Place it directly below the header (it is in-flow).
 */
export function ConnectionStatus() {
  const status = useRealtimeStatus()
  const [stalled, setStalled] = useState(false)

  useEffect(() => {
    if (status !== 'reconnecting') return
    const timer = setTimeout(() => setStalled(true), RECONNECT_GRACE_MS)
    return () => {
      clearTimeout(timer)
      setStalled(false)
    }
  }, [status])

  if (status === 'connected') return null
  if (status === 'reconnecting' && !stalled) {
    return (
      <div role="status" aria-live="polite" className={PILL}>
        <Dot />
        Reconnecting…
      </div>
    )
  }
  return (
    <div role="status" aria-live="polite" className={BANNER}>
      <Dot />
      {status === 'offline' ? (
        <p className="min-w-0 truncate">
          <span className="font-medium text-ink">Offline.</span> Changes won&apos;t save until you
          reconnect.
        </p>
      ) : (
        <p className="min-w-0 truncate">
          <span className="font-medium text-ink">Reconnecting…</span> Live updates are paused;
          reload if this persists.
        </p>
      )}
    </div>
  )
}
