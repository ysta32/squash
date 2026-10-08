import { useEffect, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { randomId } from '../lib/utils'
import { useBrowserOnline } from './useBrowserOnline'

export type RealtimeStatus = 'connected' | 'reconnecting' | 'offline'

/**
 * Creates a fresh channel for `topic`. supabase-js returns an *existing* channel when the topic is
 * already registered, and a removed channel stays registered until the server acknowledges the
 * leave. Under React StrictMode (mount → cleanup → mount) or with several hook instances, reusing
 * that channel would attach bindings to a leaving/joined channel. In that case a unique suffix is
 * appended so every subscriber owns its channel and can remove it independently.
 */
export function openChannel(topic: string): RealtimeChannel {
  const taken = supabase.getChannels().some((c) => c.topic === `realtime:${topic}`)
  return supabase.channel(taken ? `${topic}:${randomId()}` : topic)
}

/**
 * Connection health for the UI. `offline` when the browser reports no network; otherwise derived
 * from a lightweight `status` channel (optimistically `connected` until the socket reports trouble).
 */
export function useRealtimeStatus(): RealtimeStatus {
  const online = useBrowserOnline()
  const [channelStatus, setChannelStatus] = useState<'connected' | 'reconnecting'>('connected')

  useEffect(() => {
    let active = true
    const channel = openChannel('status')
    channel.subscribe((status) => {
      if (!active) return
      setChannelStatus(status === 'SUBSCRIBED' ? 'connected' : 'reconnecting')
    })
    return () => {
      active = false
      void supabase.removeChannel(channel)
    }
  }, [])

  return online ? channelStatus : 'offline'
}
