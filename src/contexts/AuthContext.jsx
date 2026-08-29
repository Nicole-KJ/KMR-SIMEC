import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getProfile } from '../services/supabaseDB'
import { useToast } from './ToastContext'
import { logError } from '../utils/logger'

const AuthContext = createContext(null)

// Auto sign-out after this much inactivity, regardless of whether the
// underlying Supabase access token is still being silently refreshed.
const IDLE_TIMEOUT_MS = 30 * 60 * 1000
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll']

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const idleTimer = useRef(null)
  const { showToast } = useToast()

  async function loadProfile(authUser) {
    if (!authUser) { setProfile(null); return }
    try {
      const data = await getProfile(authUser.id)
      setProfile(data)
    } catch (err) {
      logError('AuthContext.loadProfile', err)
      showToast('No se pudo cargar tu perfil por completo. Algunos datos podrían no estar disponibles.', 'warning')
      setProfile({ id: authUser.id, full_name: authUser.email })
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setUser(session?.user ?? null)
      await loadProfile(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      loadProfile(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  // ── Idle timeout ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return

    function resetIdleTimer() {
      if (idleTimer.current) clearTimeout(idleTimer.current)
      idleTimer.current = setTimeout(() => { signOut() }, IDLE_TIMEOUT_MS)
    }

    resetIdleTimer()
    ACTIVITY_EVENTS.forEach(evt => window.addEventListener(evt, resetIdleTimer))

    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current)
      ACTIVITY_EVENTS.forEach(evt => window.removeEventListener(evt, resetIdleTimer))
    }
  }, [user])

  // ── signIn ───────────────────────────────────────────────────────────────────
  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data.user
  }

  // ── signOut ──────────────────────────────────────────────────────────────────
  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) logError('AuthContext.signOut', error)
  }

  // ── password reset ───────────────────────────────────────────────────────────
  async function requestPasswordReset(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/restablecer-contrasena`,
    })
    if (error) throw error
  }

  async function updatePassword(newPassword) {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) throw error
  }

  // ── refresh profile (e.g. after editing name/avatar) ────────────────────────
  async function refreshProfile() {
    await loadProfile(user)
  }

  return (
    <AuthContext.Provider value={{
      user, profile, loading,
      signIn, signOut,
      requestPasswordReset, updatePassword,
      refreshProfile,
      isAdmin: profile?.role === 'admin',
      isClient: profile?.role === 'cliente',
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
