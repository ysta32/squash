import { useRealtimeStatus } from '../hooks/useRealtimeStatus'
import { cn } from '../lib/utils'

/** Fixed bottom-right connection indicator; renders nothing while connected. */
export function ReconnectingPill() {
  const status = useRealtimeStatus()
  if (status === 'connected') return null
  const offline = status === 'offline'
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed right-4 bottom-4 z-40 flex h-7 items-center gap-2 rounded-full border border-border bg-bg-elevated px-3 text-xs font-medium text-fg shadow-elevated"
    >
      <span
        aria-hidden="true"
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          offline ? 'bg-muted/60' : 'animate-pulse bg-warning',
        )}
      />
      {offline ? 'Offline' : 'Reconnecting…'}
    </div>
  )
}
