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
      className="pointer-events-none fixed right-4 bottom-4 z-40 flex items-center gap-2 rounded-full border border-border bg-bg px-3 py-1.5 text-xs text-fg shadow-md"
    >
      <span
        aria-hidden="true"
        className={cn(
          'h-2 w-2 rounded-full',
          offline ? 'bg-zinc-400' : 'animate-pulse bg-amber-500',
        )}
      />
      {offline ? 'Offline' : 'Reconnecting…'}
    </div>
  )
}
