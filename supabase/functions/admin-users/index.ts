import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Auto-injected into every Supabase Edge Function – no manual secret needed.
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const ALLOWED_ORIGINS = ['http://localhost:5176', 'https://reportes.kabbiin.com']

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
const VALID_ROLES = ['admin', 'tecnico', 'cliente']
const REPORT_BUCKETS = ['report-photos', 'signatures', 'report-pdfs', 'equipment-files']

// Shared by deleteUserReports and deleteReports below -- service_role, not
// the RLS-gated browser client, since report-photos/equipment-files/
// signatures storage policies don't grant admin a blanket delete (scoped to
// the report's own técnico, and signatures has no delete policy at all),
// and equipment-files additionally blocks signed reports. All of this needs
// to work regardless of who owns the report or whether it's signed.
async function deleteReportsAndStorage(adminClient: ReturnType<typeof createClient>, reportIds: string[]) {
  for (const reportId of reportIds) {
    for (const bucket of REPORT_BUCKETS) {
      const { data: files } = await adminClient.storage.from(bucket).list(reportId)
      const paths = (files ?? []).map((f) => `${reportId}/${f.name}`)
      if (paths.length > 0) await adminClient.storage.from(bucket).remove(paths)
    }
  }

  if (reportIds.length > 0) {
    const { error } = await adminClient.from('service_reports').delete().in('id', reportIds)
    if (error) throw error
  }
}

serve(async (req) => {
  const cors = corsHeaders(req)
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  try {
    // Client scoped to the caller's own session – used only to find out who
    // is asking and whether they're an admin. Never used for privileged ops.
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

    if (callerProfile?.role !== 'admin') {
      return json({ error: 'Solo un administrador puede gestionar usuarios' }, 403, cors)
    }

    // Only reachable once we've confirmed the caller is an admin above.
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { action, ...payload } = await req.json()

    if (action === 'list') {
      const { data: usersPage, error } = await adminClient.auth.admin.listUsers()
      if (error) throw error

      const { data: profiles } = await adminClient.from('profiles').select('id, full_name, phone, role')
      const profileById: Record<string, { full_name: string | null; role: string }> = Object.fromEntries(
        (profiles ?? []).map((p) => [p.id, p])
      )

      const users = usersPage.users.map((u) => ({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        banned: !!u.banned_until && new Date(u.banned_until) > new Date(),
        full_name: profileById[u.id]?.full_name ?? null,
        role: profileById[u.id]?.role ?? 'tecnico',
      }))

      return json({ users }, 200, cors)
    }

    if (action === 'invite') {
      const { email, full_name, role, redirectTo } = payload

      if (!email || typeof email !== 'string' || !EMAIL_RE.test(email)) {
        return json({ error: 'Correo inválido' }, 400, cors)
      }
      if (role !== undefined && role !== null && !VALID_ROLES.includes(role)) {
        return json({ error: 'Rol inválido' }, 400, cors)
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

      if (role === 'admin' || role === 'cliente') {
        const { error: roleErr } = await adminClient.from('profiles').update({ role }).eq('id', data.user.id)
        if (roleErr) throw roleErr
      }

      return json({ success: true, user: { id: data.user.id, email: data.user.email } }, 200, cors)
    }

    if (action === 'setPassword') {
      const { userId, password } = payload
      if (!userId || typeof userId !== 'string' || !UUID_RE.test(userId)) {
        return json({ error: 'userId inválido' }, 400, cors)
      }
      if (!password || typeof password !== 'string' || password.length < 6) {
        return json({ error: 'La contraseña debe tener al menos 6 caracteres' }, 400, cors)
      }

      const { error } = await adminClient.auth.admin.updateUserById(userId, { password })
      if (error) throw error

      return json({ success: true }, 200, cors)
    }

    if (action === 'setBanned') {
      const { userId, banned } = payload
      if (!userId || typeof userId !== 'string' || !UUID_RE.test(userId)) {
        return json({ error: 'userId inválido' }, 400, cors)
      }
      if (userId === user.id) return json({ error: 'No puedes deshabilitar tu propia cuenta' }, 400, cors)

      const { error } = await adminClient.auth.admin.updateUserById(userId, {
        ban_duration: banned === true ? '87600h' : 'none',
      })
      if (error) throw error

      return json({ success: true }, 200, cors)
    }

    if (action === 'deleteUserReports') {
      const { userId } = payload
      if (!userId || typeof userId !== 'string' || !UUID_RE.test(userId)) {
        return json({ error: 'userId inválido' }, 400, cors)
      }

      const { data: reports, error: reportsErr } = await adminClient
        .from('service_reports')
        .select('id')
        .or(`technician_id.eq.${userId},client_user_id.eq.${userId}`)
      if (reportsErr) throw reportsErr

      const reportIds = (reports ?? []).map((r: { id: string }) => r.id)
      await deleteReportsAndStorage(adminClient, reportIds)

      return json({ success: true, deletedCount: reportIds.length }, 200, cors)
    }

    if (action === 'deleteReports') {
      // Bulk report cleanup for an admin-picked selection (LiberarEspacio),
      // not tied to one user -- same underlying operation as
      // deleteUserReports, just given the report ids directly instead of
      // deriving them from a técnico/client.
      const { reportIds } = payload
      if (!Array.isArray(reportIds) || reportIds.length === 0 || !reportIds.every((id: unknown) => typeof id === 'string' && UUID_RE.test(id))) {
        return json({ error: 'reportIds inválido' }, 400, cors)
      }

      await deleteReportsAndStorage(adminClient, reportIds)

      return json({ success: true, deletedCount: reportIds.length }, 200, cors)
    }

    if (action === 'deleteUser') {
      const { userId } = payload
      if (!userId || typeof userId !== 'string' || !UUID_RE.test(userId)) {
        return json({ error: 'userId inválido' }, 400, cors)
      }
      if (userId === user.id) return json({ error: 'No puedes eliminar tu propia cuenta' }, 400, cors)

      // profiles.id references auth.users on delete cascade, so deleting the
      // auth user below removes the profile automatically -- but every other
      // FK to profiles(id) is ON DELETE NO ACTION and would block that
      // cascade. The reports this user actually owned/was linked to must
      // already be gone (deleteUserReports, above); this only clears
      // attribution left on OTHER people's data (a report they were listed
      // as a secondary técnico on, a company_settings edit) and this user's
      // own scheduled events, none of which deleteUserReports touches.
      await adminClient.from('report_technicians').update({ technician_id: null }).eq('technician_id', userId)
      await adminClient.from('company_settings').update({ updated_by: null }).eq('updated_by', userId)
      await adminClient.from('service_events').delete()
        .or(`technician_id.eq.${userId},created_by.eq.${userId},client_user_id.eq.${userId}`)

      const { error } = await adminClient.auth.admin.deleteUser(userId)
      if (error) throw error

      return json({ success: true }, 200, cors)
    }

    return json({ error: `Acción no reconocida: ${action}` }, 400, cors)
  } catch (err) {
    console.error('admin-users error:', err instanceof Error ? err.message : JSON.stringify(err))
    return json({ error: 'No se pudo completar la operación' }, 500, cors)
  }
})
