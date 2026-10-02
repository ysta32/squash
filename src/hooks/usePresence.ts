import { useCallback, useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

export interface PresenceUser {
  user_id: string
  viewing: string | null
  online_at: string
}

function isPresenceUser(v: unknown): v is PresenceUser {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  return (
    typeof o.user_id === 'string' &&
    (o.viewing === null || typeof o.viewing === 'string') &&
    typeof o.online_at === 'string'
  )
}

export function usePresence(
  workspaceId: string,
  viewing: string | null,
): { online: PresenceUser[]; viewers(bugId: string): PresenceUser[] } {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const [online, setOnline] = useState<PresenceUser[]>([])
  const channelRef = useRef<RealtimeChannel | null>(null)
  const subscribedRef = useRef(false)
  const viewingRef = useRef(viewing)

  useEffect(() => {
    if (!userId) return
    const channel = supabase.channel(`ws:${workspaceId}:presence`, {
      config: { presence: { key: userId } },
    })
    channelRef.current = channel
    subscribedRef.current = false

    const sync = () => {
      const state = channel.presenceState()
      const result: PresenceUser[] = []
      for (const metas of Object.values(state)) {
        let latest: PresenceUser | null = null
        for (const m of metas as unknown[]) {
          if (!isPresenceUser(m)) continue
          if (!latest || m.online_at >= latest.online_at) latest = m
        }
        if (latest) result.push(latest)
      }
      setOnline(result)
    }

    channel
      .on('presence', { event: 'sync' }, sync)
      .on('presence', { event: 'join' }, sync)
      .on('presence', { event: 'leave' }, sync)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          subscribedRef.current = true
          void channel.track({
            user_id: userId,
            viewing: viewingRef.current,
            online_at: new Date().toISOString(),
          })
        }
      })

    return () => {
      subscribedRef.current = false
      channelRef.current = null
      setOnline([])
      void supabase.removeChannel(channel)
    }
  }, [workspaceId, userId])

  useEffect(() => {
    viewingRef.current = viewing
    const channel = channelRef.current
    if (!channel || !subscribedRef.current || !userId) return
    void channel.track({
      user_id: userId,
      viewing,
      online_at: new Date().toISOString(),
    })
  }, [viewing, userId])

  const viewers = useCallback(
    (bugId: string) => online.filter((u) => u.viewing === bugId && u.user_id !== userId),
    [online, userId],
  )

  return { online, viewers }
}
