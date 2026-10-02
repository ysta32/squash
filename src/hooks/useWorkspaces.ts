import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { openChannel } from './useRealtimeStatus'
import type { MemberRole, Workspace, WorkspaceMember } from '../lib/types'

export const LAST_WORKSPACE_KEY = 'squash:lastWorkspace'

export function getLastWorkspace(): string | null {
  try {
    return localStorage.getItem(LAST_WORKSPACE_KEY)
  } catch {
    return null
  }
}

export function setLastWorkspace(id: string): void {
  try {
    localStorage.setItem(LAST_WORKSPACE_KEY, id)
  } catch {
    // Storage unavailable (private mode); last workspace just isn't remembered.
  }
}

export function inviteUrl(code: string): string {
  return `${location.origin}/join/${code}`
}

const ERROR_MESSAGES: Record<string, string> = {
  member_limit: 'This workspace is full (10 members).',
  workspace_limit: 'You can own up to 5 workspaces.',
  invalid_code: "That invite code doesn't exist.",
  not_owner: 'Only the owner can do that.',
}

/** Maps a Supabase/RPC error (or message) to a friendly string. */
export function friendlyError(err: unknown): string {
  const message =
    typeof err === 'string'
      ? err
      : err instanceof Error
        ? err.message
        : typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message: unknown }).message)
          : ''
  for (const [code, text] of Object.entries(ERROR_MESSAGES)) {
    if (message.includes(code)) return text
  }
  return message || 'Something went wrong.'
}

function toError(err: unknown): Error {
  return new Error(friendlyError(err))
}

export function useWorkspaces(): {
  workspaces: Workspace[]
  loading: boolean
  error: string | null
  createWorkspace(name: string): Promise<Workspace>
  joinWorkspace(code: string): Promise<Workspace>
  refresh(): Promise<void>
} {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const [state, setState] = useState<{
    key: string | null
    workspaces: Workspace[]
    error: string | null
  }>({ key: null, workspaces: [], error: null })
  // Bumped on every effect run and cleanup so responses from any earlier
  // run (including an A->B->A key sequence) are recognised as obsolete.
  const genRef = useRef(0)
  // Identity of the currently mounted effect. Callbacks closed over an older
  // identity (e.g. a mutation that resolves after a user switch) compare
  // against it and bail instead of writing state under the old key.
  const identityRef = useRef<string | null>(null)
  // Reset to empty/loading during render whenever the identity changes, so
  // data cached for an earlier visit to the same key is never shown.
  const [trackedKey, setTrackedKey] = useState(userId)
  if (trackedKey !== userId) {
    setTrackedKey(userId)
    setState({ key: null, workspaces: [], error: null })
  }

  const refresh = useCallback(async () => {
    if (!userId || identityRef.current !== userId) return
    const gen = genRef.current
    const { data, error: err } = await supabase
      .from('workspace_members')
      .select('workspace_id, workspaces(*)')
      .eq('user_id', userId)
    if (gen !== genRef.current || identityRef.current !== userId) return
    if (err) {
      setState((prev) => ({
        key: userId,
        workspaces: prev.key === userId ? prev.workspaces : [],
        error: friendlyError(err),
      }))
    } else {
      const list: Workspace[] = []
      for (const row of data) {
        const ws = row.workspaces
        if (ws && !Array.isArray(ws)) list.push(ws)
      }
      setState({ key: userId, workspaces: list, error: null })
    }
  }, [userId])

  useEffect(() => {
    genRef.current += 1
    identityRef.current = userId
    if (!userId) {
      return () => {
        genRef.current += 1
        identityRef.current = null
      }
    }
    const timer = setTimeout(() => void refresh(), 0)
    const channel = openChannel(`my-workspaces:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workspace_members',
          filter: `user_id=eq.${userId}`,
        },
        () => void refresh(),
      )
      .subscribe()
    return () => {
      genRef.current += 1
      identityRef.current = null
      clearTimeout(timer)
      void supabase.removeChannel(channel)
    }
  }, [userId, refresh])

  const createWorkspace = useCallback(
    async (name: string): Promise<Workspace> => {
      const { data, error: err } = await supabase.rpc('create_workspace', { p_name: name.trim() })
      if (err) throw toError(err)
      if (identityRef.current === userId) await refresh()
      return data
    },
    [userId, refresh],
  )

  const joinWorkspace = useCallback(
    async (code: string): Promise<Workspace> => {
      const { data, error: err } = await supabase.rpc('join_workspace', {
        p_code: code.trim().toUpperCase(),
      })
      if (err) throw toError(err)
      if (identityRef.current === userId) await refresh()
      return data
    },
    [userId, refresh],
  )

  return {
    workspaces: userId && state.key === userId ? state.workspaces : [],
    loading: userId ? state.key !== userId : false,
    error: state.key === userId ? state.error : null,
    createWorkspace,
    joinWorkspace,
    refresh,
  }
}

export function useWorkspace(workspaceId: string): {
  workspace: Workspace | null
  members: WorkspaceMember[]
  role: MemberRole | null
  loading: boolean
  notFound: boolean
  refresh(): Promise<void>
  rename(name: string): Promise<void>
  regenerateInviteCode(): Promise<string>
  removeMember(userId: string): Promise<void>
  transferOwnership(userId: string): Promise<void>
  deleteWorkspace(): Promise<void>
} {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const [state, setState] = useState<{
    key: string | null
    workspace: Workspace | null
    members: WorkspaceMember[]
    notFound: boolean
  }>({ key: null, workspace: null, members: [], notFound: false })
  // State identity covers both the auth user and the workspace, so a user
  // switch within the same workspace never shows the previous user's data.
  const key = `${userId ?? ''}:${workspaceId}`
  const genRef = useRef(0)
  // See useWorkspaces: guards callbacks that outlive their identity.
  const identityRef = useRef<string | null>(null)
  const [trackedKey, setTrackedKey] = useState(key)
  if (trackedKey !== key) {
    setTrackedKey(key)
    setState({ key: null, workspace: null, members: [], notFound: false })
  }
  const current = state.key === key
  const workspace = current ? state.workspace : null
  const members = useMemo(() => (current ? state.members : []), [current, state.members])
  const notFound = current ? state.notFound : false
  const loading = !current

  const refresh = useCallback(async () => {
    if (identityRef.current !== key) return
    const gen = genRef.current
    const [wsRes, memRes] = await Promise.all([
      supabase.from('workspaces').select('*').eq('id', workspaceId).maybeSingle(),
      supabase
        .from('workspace_members')
        .select('*, profile:profiles(*)')
        .eq('workspace_id', workspaceId)
        .order('joined_at', { ascending: true }),
    ])
    if (gen !== genRef.current || identityRef.current !== key) return
    if (wsRes.error || !wsRes.data) {
      setState({ key, workspace: null, members: [], notFound: true })
    } else {
      const list: WorkspaceMember[] = []
      for (const row of memRes.data ?? []) {
        const profile = row.profile
        if (profile && !Array.isArray(profile)) list.push({ ...row, profile })
      }
      setState({ key, workspace: wsRes.data, members: list, notFound: false })
    }
  }, [workspaceId, key])

  useEffect(() => {
    genRef.current += 1
    identityRef.current = key
    const gen = genRef.current
    const timer = setTimeout(() => void refresh(), 0)
    const markGone = () => {
      if (gen !== genRef.current) return
      setState({ key, workspace: null, members: [], notFound: true })
    }
    const channel = openChannel(`workspace:${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workspace_members',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE' && payload.old.user_id === userId) markGone()
          else void refresh()
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'workspaces', filter: `id=eq.${workspaceId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') markGone()
          else void refresh()
        },
      )
      .subscribe()
    return () => {
      genRef.current += 1
      identityRef.current = null
      clearTimeout(timer)
      void supabase.removeChannel(channel)
    }
  }, [workspaceId, userId, key, refresh])

  const role = members.find((m) => m.user_id === userId)?.role ?? null

  const rename = useCallback(
    async (name: string) => {
      const { error: err } = await supabase
        .from('workspaces')
        .update({ name: name.trim() })
        .eq('id', workspaceId)
      if (err) throw toError(err)
      if (identityRef.current === key) await refresh()
    },
    [key, workspaceId, refresh],
  )

  const regenerateInviteCode = useCallback(async (): Promise<string> => {
    const { data, error: err } = await supabase.rpc('regenerate_invite_code', {
      p_workspace_id: workspaceId,
    })
    if (err) throw toError(err)
    if (identityRef.current === key) await refresh()
    return data
  }, [key, workspaceId, refresh])

  const removeMember = useCallback(
    async (memberId: string) => {
      const { error: err } = await supabase.rpc('remove_member', {
        p_workspace_id: workspaceId,
        p_user_id: memberId,
      })
      if (err) throw toError(err)
      if (identityRef.current === key) await refresh()
    },
    [key, workspaceId, refresh],
  )

  const transferOwnership = useCallback(
    async (memberId: string) => {
      const { error: err } = await supabase.rpc('transfer_ownership', {
        p_workspace_id: workspaceId,
        p_new_owner: memberId,
      })
      if (err) throw toError(err)
      if (identityRef.current === key) await refresh()
    },
    [key, workspaceId, refresh],
  )

  const deleteWorkspace = useCallback(async () => {
    const { error: err } = await supabase.rpc('delete_workspace', { p_workspace_id: workspaceId })
    if (err) throw toError(err)
  }, [workspaceId])

  return {
    workspace,
    members,
    role,
    loading,
    notFound,
    refresh,
    rename,
    regenerateInviteCode,
    removeMember,
    transferOwnership,
    deleteWorkspace,
  }
}
