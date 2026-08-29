/**
 * adminUsersService.js – Calls the admin-users Edge Function, which is the
 * only place the service_role key is used (server-side, never in the
 * browser). The function re-checks the caller is an admin itself, so this
 * is defense in depth on top of route guarding, not the only check.
 */
import { supabase } from '../lib/supabase'

async function invoke(action, payload = {}) {
  const { data, error } = await supabase.functions.invoke('admin-users', {
    body: { action, ...payload },
  })
  if (error) {
    // supabase-js only exposes a generic "non-2xx status" message on `error`
    // itself — the actual reason the function returned is in the response
    // body, reachable via `error.context` (a Response) for HTTP failures.
    const body = await error.context?.json?.().catch(() => null)
    throw new Error(body?.error ?? error.message ?? 'Error al comunicarse con el servidor')
  }
  if (data?.error) throw new Error(data.error)
  return data
}

export async function listUsers() {
  const data = await invoke('list')
  return data.users
}

export async function inviteUser(email, fullName, role) {
  return invoke('invite', {
    email,
    full_name: fullName,
    role,
    redirectTo: `${window.location.origin}/restablecer-contrasena`,
  })
}

export async function setUserBanned(userId, banned) {
  return invoke('setBanned', { userId, banned })
}

// Sets a user's password directly (no email involved) — for when the
// project's email sending is unavailable/rate-limited, or the admin just
// wants to hand someone their credentials directly.
export async function setUserPassword(userId, password) {
  return invoke('setPassword', { userId, password })
}

// DeleteUserModal step 3 — deletes every report this user owns or is
// linked to as its portal client, including their storage (photos,
// signature, cached PDF, equipment files). service_role-backed since RLS
// doesn't grant an admin blanket storage-delete access on someone else's
// report (see admin-users/index.ts). Irreversible.
export async function deleteUserReports(userId) {
  return invoke('deleteUserReports', { userId })
}

// DeleteUserModal step 4 — deletes the user's account entirely. Fails if
// they still have reports (deleteUserReports must run first). Irreversible.
export async function deleteUser(userId) {
  return invoke('deleteUser', { userId })
}

// LiberarEspacio — deletes an admin-picked set of reports (any user, any
// status), including their storage (photos, signature, cached PDF,
// equipment files). Same underlying edge-function operation as
// deleteUserReports, just for an explicit id list instead of one user's
// reports. Irreversible.
export async function deleteReports(reportIds) {
  return invoke('deleteReports', { reportIds })
}
