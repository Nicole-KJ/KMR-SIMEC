import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Auto-injected into every Supabase Edge Function – no manual secret needed.
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const ALLOWED_ORIGINS = [
  'http://localhost:5176',
  'https://reportes.simec-cr.com',
  'https://www.simec-cr.com',
  'https://simec-cr.com',
]

function corsHeaders(req: Request) {
  const origin = req.headers.get('origin') ?? ''
  const allowOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    Vary: 'Origin',
  }
}

function json(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  })
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Dedicated, narrowly-scoped sibling of admin-users: lets "tecnico" in
// alongside "admin" (unlike admin-users, which is admin-only), but every
// action here only ever touches role='cliente' accounts, and setBanned is
// further restricted to admin callers. There's no setPassword action at
// all — resetting a client's password isn't part of this function's job.
serve(async (req) => {
  const cors = corsHeaders(req)
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  try {
    const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    })

    const { data: { user }, error: userErr } = await callerClient.auth.getUser()
    if (userErr || !user) {
      return json({ error: 'No autenticado' }, 401, cors)
    }

    const { data: callerProfile } = await callerClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (callerProfile?.role !== 'admin' && callerProfile?.role !== 'tecnico') {
      return json({ error: 'No autorizado' }, 403, cors)
    }

    // Only reachable once we've confirmed the caller is an admin or tecnico.
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { action, ...payload } = await req.json()

    if (action === 'list') {
      const { data: clientProfiles, error } = await adminClient
        .from('profiles')
        .select('id, full_name, phone, address, contact_email')
        .eq('role', 'cliente')
      if (error) throw error

      const { data: usersPage, error: authErr } = await adminClient.auth.admin.listUsers()
      if (authErr) throw authErr

      const authUserById = Object.fromEntries(usersPage.users.map((u) => [u.id, u]))

      const clients = clientProfiles
        .filter((p) => authUserById[p.id])
        .map((p) => {
          const u = authUserById[p.id]
          return {
            id: p.id,
            email: u.email,
            full_name: p.full_name,
            phone: p.phone,
            address: p.address,
            contact_email: p.contact_email,
            created_at: u.created_at,
            last_sign_in_at: u.last_sign_in_at,
            banned: !!u.banned_until && new Date(u.banned_until) > new Date(),
          }
        })

      return json({ users: clients }, 200, cors)
    }

    if (action === 'invite') {
      const { email, full_name, redirectTo } = payload

      if (!email || typeof email !== 'string' || !EMAIL_RE.test(email)) {
        return json({ error: 'Correo inválido' }, 400, cors)
      }
      // Only forward redirectTo if it points at one of our own origins --
      // otherwise an invite link could be steered off the app entirely.
      const safeRedirectTo = typeof redirectTo === 'string' && ALLOWED_ORIGINS.some((o) => redirectTo.startsWith(o))
        ? redirectTo
        : undefined

      const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
        data: { full_name: typeof full_name === 'string' ? full_name : '' },
        redirectTo: safeRedirectTo,
      })
      if (error) throw error

      // Always cliente here, regardless of anything the caller sent — this
      // function has no concept of inviting an admin or tecnico.
      const { error: roleErr } = await adminClient.from('profiles').update({ role: 'cliente' }).eq('id', data.user.id)
      if (roleErr) throw roleErr

      return json({ success: true, user: { id: data.user.id, email: data.user.email } }, 200, cors)
    }

    if (action === 'setBanned') {
      if (callerProfile.role !== 'admin') {
        return json({ error: 'Solo un administrador puede deshabilitar clientes' }, 403, cors)
      }

      const { userId, banned } = payload
      if (!userId || typeof userId !== 'string' || !UUID_RE.test(userId)) {
        return json({ error: 'userId inválido' }, 400, cors)
      }

      const { data: targetProfile } = await adminClient.from('profiles').select('role').eq('id', userId).single()
      if (targetProfile?.role !== 'cliente') {
        return json({ error: 'Esta función solo administra cuentas de cliente' }, 400, cors)
      }

      const { error } = await adminClient.auth.admin.updateUserById(userId, {
        ban_duration: banned === true ? '87600h' : 'none',
      })
      if (error) throw error

      return json({ success: true }, 200, cors)
    }

    return json({ error: `Acción no reconocida: ${action}` }, 400, cors)
  } catch (err) {
    console.error('client-users error:', err instanceof Error ? err.message : String(err))
    return json({ error: 'No se pudo completar la operación' }, 500, cors)
  }
})