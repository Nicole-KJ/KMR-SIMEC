/**
 * equiposService.js – Data access layer for Inventario de Equipos (052):
 * the physical equipment registry (equipos) plus its many-to-many client
 * links (equipo_clients). Kept separate from supabaseDB.js since it's its
 * own domain, same reasoning as clientUsersService.js/adminUsersService.js.
 */
import { supabase } from '../lib/supabase'
import { withRetry } from '../utils/retry'

const EQUIPO_SELECT = '*, clients:equipo_clients(id, client_user_id, client_name)'
const EQUIPO_PHOTO_BUCKET = 'equipo-photos'

export async function listEquipos() {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('equipos')
      .select(EQUIPO_SELECT)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data
  })
}

// EquipoDetail.jsx -- RLS alone is what scopes this per role (staff see any
// equipo, a client only one they're linked to, 054), same as ReportDetail's
// getReport().
export async function getEquipo(id) {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('equipos')
      .select(EQUIPO_SELECT)
      .eq('id', id)
      .single()
    if (error) throw new Error('Equipo no encontrado')
    return data
  })
}

// "Mis Equipos" (client role, 054) -- same shape as listEquipos, but scoped
// to equipos this client is linked to. RLS already restricts a client to
// exactly these rows, but filtering explicitly here mirrors the
// getReports()/getClientReports() split (supabaseDB.js) rather than relying
// on RLS alone. The !inner join is what lets .eq() filter on the embedded
// equipo_clients row instead of just shaping the response.
export async function listMyEquipos(userId) {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('equipos')
      .select('*, clients:equipo_clients!inner(id, client_user_id, client_name)')
      .eq('clients.client_user_id', userId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data
  })
}

// clients: [{ clientUserId, clientName }, ...] -- empty when staff registers
// an equipo (it just stays unlinked), or a single self-entry
// `{ clientUserId: user.id, clientName: profile.full_name }` when a client
// registers their own (auto-linked, never picked manually -- see NewEquipo.jsx).
export async function createEquipo(equipoData, clients, userId) {
  const { data: equipo, error } = await supabase
    .from('equipos')
    .insert({ ...equipoData, created_by: userId })
    .select(EQUIPO_SELECT)
    .single()
  if (error) throw error
  await linkClients(equipo.id, clients, userId)
  return equipo
}

// Adds each of `clients` as a link on an existing equipo -- called by
// createEquipo right after the insert. Inserted one row at a time (rather
// than a single batch insert) and swallows unique_violation (23505) per row
// -- re-picking an already-linked client is a normal, harmless no-op from
// the UI's point of view, and a single batch insert would roll the whole
// statement back (losing the other, genuinely new links) the moment any
// one row collides.
export async function linkClients(equipoId, clients, userId) {
  for (const c of clients) {
    const { error } = await supabase.from('equipo_clients').insert({
      equipo_id: equipoId,
      client_user_id: c.clientUserId || null,
      client_name: c.clientName,
      created_by: userId,
    })
    if (error && error.code !== '23505') throw error
  }
}

// Uploaded after createEquipo, once the equipo's id exists to key the
// storage path on -- same chicken-and-egg as report photos (see
// uploadReportPhotos in supabaseDB.js). Path is `${equipoId}/photo.<ext>`
// with upsert:true (avatar convention, 005) so re-uploading later just
// replaces it -- one photo per equipo, not a gallery.
export async function uploadEquipoPhoto(equipoId, file) {
  const ext = file.name?.split('.').pop() || 'jpg'
  const path = `${equipoId}/photo.${ext}`

  const { error: uploadErr } = await supabase.storage.from(EQUIPO_PHOTO_BUCKET).upload(path, file, { upsert: true })
  if (uploadErr) throw uploadErr

  const { error: updateErr } = await supabase.from('equipos').update({ photo_path: path }).eq('id', equipoId)
  if (updateErr) throw updateErr

  return path
}

// equipo-photos is a private bucket (unlike avatars), so display always
// goes through a short-lived signed URL rather than getPublicUrl -- same
// pattern as getPhotoUrl/getEquipmentFileUrl in supabaseDB.js.
export async function getEquipoPhotoUrl(storagePath) {
  if (!storagePath) return null
  const { data, error } = await supabase.storage.from(EQUIPO_PHOTO_BUCKET).createSignedUrl(storagePath, 3600)
  if (error) return null
  return data.signedUrl
}
