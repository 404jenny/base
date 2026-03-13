import { useState, useEffect, useRef } from 'react'
import { supabase, getUserSettings, upsertUserSettings, UserSettings } from '../lib/supabase'
import type { User, Session } from '@supabase/supabase-js'

export type AuthState = 'loading' | 'unauthenticated' | 'onboarding' | 'authenticated'

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [authState, setAuthState] = useState<AuthState>('loading')
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [error, setError] = useState<string | null>(null)
  const loadingRef = useRef(false)

  useEffect(() => {
    // Get initial session only — don't double-handle via onAuthStateChange
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        loadSettings(session.user.id)
      } else {
        setAuthState('unauthenticated')
      }
    })

    // Only handle sign-in / sign-out events, not INITIAL_SESSION (already handled above)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        loadSettings(session.user.id)
      } else {
        setAuthState('unauthenticated')
        setSettings(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const loadSettings = async (userId: string) => {
    if (loadingRef.current) return
    loadingRef.current = true
    try {
      const s = await getUserSettings(userId)
      if (!s) {
        setAuthState('onboarding')
      } else {
        setSettings(s)
        if (s.anthropic_key) (window as any).__ANTHROPIC_KEY__ = s.anthropic_key
        if (s.gemini_key) (window as any).__GEMINI_KEY__ = s.gemini_key
        setAuthState('authenticated')
      }
    } finally {
      loadingRef.current = false
    }
  }

  const signUp = async (email: string, password: string) => {
    setError(null)
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) { setError(error.message); return false }
    // If user is returned and confirmed, load settings. Otherwise show a "check email" message.
    if (data.user && data.session) {
      // Auto-confirmed (email confirmation disabled in Supabase)
      setUser(data.user)
      setSession(data.session)
      await loadSettings(data.user.id)
    } else {
      // Email confirmation required — tell the user
      setError('Account created! Check your email to confirm before signing in.')
    }
    return !error
  }

  const signIn = async (email: string, password: string) => {
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    return !error
  }

  const signInWithMagicLink = async (email: string) => {
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({ email })
    if (error) setError(error.message)
    return !error
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const deleteAccount = async () => {
    if (!user) return
    await supabase.from('user_settings').delete().eq('id', user.id)
    await supabase.auth.signOut()
  }

  const saveSettings = async (newSettings: Partial<UserSettings>) => {
    if (!user) return false
    const merged = { ...settings, ...newSettings } as UserSettings
    setSettings(merged)
    if (merged.anthropic_key) (window as any).__ANTHROPIC_KEY__ = merged.anthropic_key
    if (merged.gemini_key) (window as any).__GEMINI_KEY__ = merged.gemini_key
    return await upsertUserSettings(user.id, newSettings)
  }

  const completeOnboarding = async (onboardingSettings: Partial<UserSettings>) => {
    if (!user) return
    await upsertUserSettings(user.id, onboardingSettings)
    await loadSettings(user.id)
  }

  return {
    user, session, authState, settings, error,
    signUp, signIn, signInWithMagicLink, signOut,
    saveSettings, completeOnboarding, deleteAccount, setError,
  }
}