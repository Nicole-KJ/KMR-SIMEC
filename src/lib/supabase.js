import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copia .env.example a .env.local y completa las credenciales de tu proyecto Supabase.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Keeps the session in localStorage and silently refreshes the access
    // token before it expires. When the refresh token itself is invalid/
    // expired, supabase-js fires a SIGNED_OUT auth event instead of throwing,
    // which AuthContext picks up to drop the user back to /login.
    persistSession: true,
    autoRefreshToken: true,
    // Needed so password-recovery / invite links (which land back on the app
    // with an access token in the URL) get turned into a real session.
    detectSessionInUrl: true,
  },
})
