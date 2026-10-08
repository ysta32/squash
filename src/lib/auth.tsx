import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { authCallbackUrl } from './authRedirect'
import { supabase } from './supabase'
import { bumpSessionEpoch } from './sessionEpoch'
import type { Profile } from './types'

export interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  signInWithGoogle(next?: string): Promise<void>
  signInWithMagicLink(email: string, next?: string): Promise<void>
  signOut(): Promise<void>
  refreshProfile(): Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

interface ProfileState {
  userId: string
  profile: Profile | null
}

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [sessionReady, setSessionReady] = useState(false)
  const [profileState, setProfileState] = useState<ProfileState | null>(null)
  // Id of the currently signed-in user, updated synchronously with session changes so async
  // profile results can be checked against it. genRef increments per profile request; only
  // the latest request for the current user may write profileState.
  const userIdRef = useRef<string | null>(null)
  const genRef = useRef(0)

  useEffect(() => {
    let active = true
    const applySession = (next: Session | null) => {
      const nextUserId = next?.user.id ?? null
      if (nextUserId !== userIdRef.current) bumpSessionEpoch()
      userIdRef.current = nextUserId
      setSession(next)
      setSessionReady(true)
    }
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active) return
        if (error) console.error('getSession failed', error)
        applySession(data.session)
      })
      .catch((err: unknown) => {
        if (!active) return
        console.error('getSession failed', err)
        setSessionReady(true)
      })
    // Do not call other supabase methods synchronously inside this callback (auth lock);
    // profile loading is driven by the effect on userId below.
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!active) return
      applySession(next)
    })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  const user = session?.user ?? null
  const userId = user?.id ?? null

  useEffect(() => {
    if (!userId) return
    const gen = ++genRef.current
    const isLatest = () => genRef.current === gen && userIdRef.current === userId
    fetchProfile(userId)
      .then((profile) => {
        if (isLatest()) setProfileState({ userId, profile })
      })
      .catch((err: unknown) => {
        console.error('Failed to load profile', err)
        if (isLatest()) setProfileState({ userId, profile: null })
      })
  }, [userId])

  const profile = userId && profileState?.userId === userId ? profileState.profile : null
  const profileLoaded = !userId || profileState?.userId === userId
  const loading = !sessionReady || !profileLoaded

  const refreshProfile = useCallback(async () => {
    const uid = userIdRef.current
    if (!uid) return
    const gen = ++genRef.current
    const isLatest = () => genRef.current === gen && userIdRef.current === uid
    try {
      const next = await fetchProfile(uid)
      if (isLatest()) setProfileState({ userId: uid, profile: next })
    } catch (err) {
      // This request superseded the initial load, so it must still mark the profile as loaded.
      if (isLatest()) {
        setProfileState((prev) => (prev?.userId === uid ? prev : { userId: uid, profile: null }))
      }
      throw err
    }
  }, [])

  const signInWithGoogle = useCallback(async (next?: string) => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: authCallbackUrl(next),
        queryParams: { prompt: 'select_account' },
      },
    })
    if (error) throw new Error(error.message)
  }, [])

  const signInWithMagicLink = useCallback(async (email: string, next?: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: authCallbackUrl(next) },
    })
    if (error) throw new Error(error.message)
  }, [])

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw new Error(error.message)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      profile,
      loading,
      signInWithGoogle,
      signInWithMagicLink,
      signOut,
      refreshProfile,
    }),
    [
      session,
      user,
      profile,
      loading,
      signInWithGoogle,
      signInWithMagicLink,
      signOut,
      refreshProfile,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}
