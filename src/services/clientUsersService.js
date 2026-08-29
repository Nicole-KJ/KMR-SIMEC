/**
 * clientUsersService.js – Calls the client-users Edge Function, a narrower
 * sibling of admin-users: reachable by both "admin" and "tecnico", but every
 * action is scoped to role='cliente' accounts, and there is no
 * setPassword action at all. The function re-checks the caller's role
 * itself, so this is defense in depth on top of route guarding.
 */
import { supabase } from '../lib/supabase'

async function invoke(action, payload = {}) {
  const { data, error } = await supabase.functions.invoke('client-users', {
    body: { action, ...payload },
  })
  if (error) {
    const body = await error.context?.json?.().catch(() => null)
    throw new Error(body?.error ?? error.message ?? 'Error al comunicarse con el servidor')
  }
  if (data?.error) throw new Error(data.error)
  return data
}

export async function listClients() {
  const data = await invoke('list')
  return data.users
}

export async function inviteClient(email, fullName) {
  return invoke('invite', {
    email,
    full_name: fullName,
    redirectTo: `${window.location.origin}/restablecer-contrasena`,
  })
}

export async function setClientBanned(userId, banned) {
  return invoke('setBanned', { userId, banned })
}