/**
 * supabaseDB.js – Data access layer backed by the real Supabase project
 * (Postgres + Storage). Pages import from here rather than touching
 * `lib/supabase.js` directly.
 */
import { supabase } from '../lib/supabase'
import { withRetry } from '../utils/retry'

// event: only the fields ReportDetail.jsx's linked-event card/header need
// to display -- not a full service_events row. Embeds as null if event_id
// is set but the caller's RLS can't see that event (e.g. it belongs to a
// different técnico than this report) -- ReportDetail.jsx treats that the
// same as "no event linked" rather than erroring.
const REPORT_SELECT = '*, technicians:report_technicians(*), parts:report_parts(*), photos:report_photos(*), event:service_events(id, event_code, event_name, event_date, event_time, client_name, status)'

// technicians: every técnico on this event (event_technicians, 059) -- all
// equal, no "primary" técnico, same shape as service_reports/report_technicians.
const EVENT_SELECT = '*, technicians:event_technicians(*)'
const PHOTO_BUCKET = 'report-photos'
const AVATAR_BUCKET = 'avatars'
const SIGNATURE_BUCKET = 'signatures'
const PDF_BUCKET = 'report-pdfs'
const EQUIPMENT_FILE_BUCKET = 'equipment-files'
const COMPANY_LOGO_BUCKET = 'company-logo'

// ─── FORMAT HELPERS ──────────────────────────────────────────────────────────
// Used for both a pure "date" column (report_date -- an absolute calendar
// day, no time/timezone component at all) and real timestamps (created_at,
// signed_at). `new Date("2026-08-06")` assumes UTC midnight, which once
// converted to any timezone west of UTC (e.g. Costa Rica, UTC-6) rolls back
// to the previous day -- report_date showed one day earlier than what was
// actually saved. A real timestamp has no such ambiguity and should keep
// converting to the viewer's local time, so only the date-only case gets
// the local-midnight parse (same fix as monthKey() in ReportStatsPanel.jsx).
export function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? new Date(`${dateStr}T00:00:00`) : new Date(dateStr)
  return d.toLocaleDateString('es-CR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function formatDateTime(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleString('es-CR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ─── GET PROFILE ──────────────────────────────────────────────────────────────
export async function getProfile(userId) {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, phone, address, contact_email, role, avatar_url')
      .eq('id', userId)
      .single()
    if (error) throw error
    return data
  })
}

// ─── UPDATE OWN PROFILE ─────────────────────────────────────────────────────────
export async function updateProfile(userId, fields) {
  const { data, error } = await supabase
    .from('profiles')
    .update(fields)
    .eq('id', userId)
    .select('id, full_name, phone, address, contact_email, role, avatar_url')
    .single()
  if (error) throw error
  return data
}

// ─── UPLOAD AVATAR (own folder only – enforced by storage RLS) ─────────────────
export async function uploadAvatar(userId, file) {
  const ext = file.name?.split('.').pop() || 'jpg'
  const path = `${userId}/avatar.${ext}`

  const { error: uploadErr } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, file, { upsert: true })
  if (uploadErr) throw uploadErr

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path)
  // Bust any cached copy of the previous avatar at this same path.
  return `${data.publicUrl}?v=${Date.now()}`
}

function withCompanyLogoUrl(data) {
  if (!data?.logo_storage_path) return data
  const { data: urlData } = supabase.storage.from(COMPANY_LOGO_BUCKET).getPublicUrl(data.logo_storage_path)
  return { ...data, logo_url: urlData.publicUrl }
}

// ─── GET COMPANY SETTINGS (admin-only – enforced by RLS) ───────────────────────
export async function getCompanySettings() {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('company_settings')
      .select('*')
      .eq('id', true)
      .maybeSingle()
    if (error) throw error
    return withCompanyLogoUrl(data)
  })
}

// ─── STORAGE USAGE (admin only — AppCustomization's Almacenamiento card) ──────
// get_storage_usage() (042) is a narrow SECURITY DEFINER RPC, same pattern as
// get_report_for_signature -- storage.objects isn't in the exposed API
// schemas and per-bucket storage policies don't grant a blanket read across
// every bucket, so this couldn't be a plain .from() query.
export async function getStorageUsage() {
  return withRetry(async () => {
    const { data, error } = await supabase.rpc('get_storage_usage')
    if (error) throw error
    return data
  })
}

// A saved report and its PDF are two separate things -- a report only gets
// a cached PDF once someone actually downloads/regenerates it. Creating
// reports alone never changes Storage usage, which is confusing without
// this shown next to it (044).
export async function getReportPdfStats() {
  return withRetry(async () => {
    const { data, error } = await supabase.rpc('get_report_pdf_stats').single()
    if (error) throw error
    return data
  })
}

// Postgres database usage (separate from Storage, 045/046) -- the other
// resource that can hit a plan limit. get_database_size() is the total
// across every schema (what actually counts against the plan);
// get_database_table_sizes() is a per-table breakdown of just this app's
// own (public schema) tables, to show what's actionable to delete.
export async function getDatabaseSize() {
  return withRetry(async () => {
    const { data, error } = await supabase.rpc('get_database_size').single()
    if (error) throw error
    return data
  })
}

export async function getDatabaseTableSizes() {
  return withRetry(async () => {
    const { data, error } = await supabase.rpc('get_database_table_sizes')
    if (error) throw error
    return data
  })
}

// ─── GET PUBLIC COMPANY BRANDING (no session required — see 021) ──────────────
// Used anywhere the app needs to show the company's own logo/name instead of
// the default app branding: Login (no session at all), the nav bar for
// "cliente" sessions, and report PDFs. Only exposes what get_company_branding
// returns — never the full admin-only company_settings row.
export async function getPublicBranding() {
  return withRetry(async () => {
    const { data, error } = await supabase.rpc('get_company_branding').maybeSingle()
    if (error) throw error
    return withCompanyLogoUrl(data)
  })
}

// ─── SAVE COMPANY SETTINGS (admin-only – enforced by RLS, single row) ──────────
export async function updateCompanySettings(fields) {
  const { data, error } = await supabase
    .from('company_settings')
    .upsert({ id: true, ...fields, updated_at: new Date().toISOString() })
    .select('*')
    .single()
  if (error) throw error
  return data
}

// ─── UPLOAD COMPANY LOGO (admin-only – enforced by storage RLS) ────────────────
export async function uploadCompanyLogo(file) {
  const ext = file.name?.split('.').pop() || 'png'
  const path = `logo.${ext}`

  const { error: uploadErr } = await supabase.storage
    .from(COMPANY_LOGO_BUCKET)
    .upload(path, file, { upsert: true })
  if (uploadErr) throw uploadErr

  const { data } = supabase.storage.from(COMPANY_LOGO_BUCKET).getPublicUrl(path)
  return { path, url: `${data.publicUrl}?v=${Date.now()}` }
}

// ─── REMOVE COMPANY LOGO (admin-only – enforced by storage RLS) ────────────────
export async function removeCompanyLogo(path) {
  if (!path) return
  const { error } = await supabase.storage.from(COMPANY_LOGO_BUCKET).remove([path])
  if (error) throw error
}

// ─── SET USER ROLE (admin only – enforced by RLS) ──────────────────────────────
export async function setUserRole(userId, role) {
  const { error } = await supabase.from('profiles').update({ role }).eq('id', userId)
  if (error) throw error
}

// ─── GET TECHNICIANS (directory for the "Técnicos" dropdown) ──────────────────
export async function getTechnicians() {
  return withRetry(async () => {
    const { data, error } = await supabase.rpc('get_technicians')
    if (error) throw error
    return data
  })
}

// ─── GET STAFF DIRECTORY (admin-only – técnicos + admins, for NewReport.jsx) ───
export async function getStaffDirectory() {
  return withRetry(async () => {
    const { data, error } = await supabase.rpc('get_staff_directory')
    if (error) throw error
    return data
  })
}

// ─── GET CLIENTS (directory for the "Cliente registrado" dropdown) ────────────
export async function getClients() {
  return withRetry(async () => {
    const { data, error } = await supabase.rpc('get_clients')
    if (error) throw error
    return data
  })
}

// ─── GET ALL REPORT CLIENTS (NewReport.jsx's "Cliente registrado" picker) ─────
// Every known client, linked (portal account) and unlinked (free-text name
// off past reports) alike, each with whatever contact info is on file --
// lets the form autofill Nombre/Dirección/Teléfono/Correo on selection (051).
export async function getAllReportClients() {
  return withRetry(async () => {
    const { data, error } = await supabase.rpc('get_all_report_clients')
    if (error) throw error
    return data
  })
}

// ─── GET UNLINKED CLIENTS (admin-only – free text on reports, no portal account) ─
export async function getUnlinkedReportClients() {
  return withRetry(async () => {
    const { data, error } = await supabase.rpc('get_unlinked_report_clients')
    if (error) throw error
    return data
  })
}

// ─── GET REPORTS (own + listed-as-técnico, for the technician dashboard) ──────
// No explicit ownership filter -- RLS ("reports: own read"/"listed technician
// read"/"admin read all", see 001/027) already scopes this to exactly what a
// técnico is allowed to see, which is also exactly what they're allowed to
// edit (see can_edit_report, 027), so any row that comes back here is fair
// game for the edit screen.
export async function getReports() {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('service_reports')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw error
    return data
  })
}

// ─── GET ALL REPORTS (admin only – enforced by RLS) ────────────────────────────
// Embeds just the técnico ids listed on each report (not the full
// technicians:report_technicians(*) shape getReport() uses) -- UserDetail.jsx
// needs it to attribute a report to any listed técnico, not only its
// creator (technician_id), without pulling parts/photos for every row.
export async function getAllReports() {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('service_reports')
      .select('*, technicians:report_technicians(technician_id)')
      .order('created_at', { ascending: false })
    if (error) throw error
    return data
  })
}

// Reports this user owns as its técnico OR is linked to as its portal
// client -- the two report-level FKs to profiles(id) that block deleting
// the user (both ON DELETE NO ACTION). Doesn't include reports where
// they're only a secondary técnico (report_technicians) -- that's not
// "their" report, and DeleteUserModal's user-deletion step clears that
// attribution separately instead of touching someone else's report.
export async function getUserRelatedReports(userId) {
  const all = await getAllReports()
  return all.filter(r => r.technician_id === userId || r.client_user_id === userId)
}

// ─── GET CLIENT REPORTS (own, for the client dashboard) ────────────────────────
export async function getClientReports(userId) {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('service_reports')
      .select('*')
      .eq('client_user_id', userId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data
  })
}

// ─── GET SINGLE REPORT ────────────────────────────────────────────────────────
export async function getReport(reportId) {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('service_reports')
      .select(REPORT_SELECT)
      .eq('id', reportId)
      .single()
    if (error) throw new Error('Reporte no encontrado')
    return data
  })
}

// ─── CREATE REPORT ────────────────────────────────────────────────────────────
export async function createReport(reportData, userId, userFullName, onProgress) {
  const { technicians = [], parts = [], photos = [], ...fields } = reportData

  const { data: report, error } = await supabase
    .from('service_reports')
    .insert({ ...fields, technician_id: userId, technician_name: userFullName })
    .select()
    .single()
  if (error) throw error

  await insertTechnicians(report.id, technicians)
  await insertParts(report.id, parts)
  if (photos.length > 0) await uploadReportPhotos(report.id, photos, onProgress)

  return getReport(report.id)
}

// Deletes a report's cached PDF file from Storage, if it has one. Best
// effort -- a failed cleanup here shouldn't block whatever DB write the
// caller is actually trying to make. Used everywhere pdf_storage_path gets
// reset to null, so the old file doesn't linger as a Storage orphan (it
// previously did: the DB pointer was cleared but the file itself never
// removed -- the same species of bug found and cleaned up with the
// .emptyFolderPlaceholder orphans, except these are full-size PDFs).
async function deleteCachedPdfIfAny(pdfStoragePath) {
  if (!pdfStoragePath) return
  try {
    await supabase.storage.from(PDF_BUCKET).remove([pdfStoragePath])
  } catch {
    // best effort; the caller's own update proceeds regardless
  }
}

// ─── UPDATE REPORT (owner only, and only while not yet signed – enforced by RLS) ─
export async function updateReport(reportId, reportData, onProgress) {
  const { technicians = [], parts = [], photos = [], ...fields } = reportData

  // Any edit invalidates a previously cached PDF so the next download regenerates it.
  const { data: existing } = await supabase.from('service_reports').select('pdf_storage_path').eq('id', reportId).single()
  await deleteCachedPdfIfAny(existing?.pdf_storage_path)

  const { error } = await supabase.from('service_reports').update({ ...fields, pdf_storage_path: null }).eq('id', reportId)
  if (error) throw error

  // Technicians/parts are small, fully-replaced lists in the edit form, so the
  // simplest correct approach is to drop and re-insert rather than diff them.
  const { error: delTechErr } = await supabase.from('report_technicians').delete().eq('report_id', reportId)
  if (delTechErr) throw delTechErr
  await insertTechnicians(reportId, technicians)

  const { error: delPartsErr } = await supabase.from('report_parts').delete().eq('report_id', reportId)
  if (delPartsErr) throw delPartsErr
  await insertParts(reportId, parts)

  // Photos are append-only here: editing doesn't support removing a photo
  // that was already saved, only adding new ones.
  if (photos.length > 0) await uploadReportPhotos(reportId, photos, onProgress)

  return getReport(reportId)
}

// ─── UPDATE A REPORT'S TÉCNICOS LIST ONLY (NewReport.jsx, admin-not-técnico edit) ─
// An admin who isn't listed as a técnico on this report only gets the
// Técnicos section of the edit screen -- everything else is read-only (see
// canEditContent/isReportTechnician in NewReport.jsx, backed by 032's RLS).
// Deliberately never touches service_reports itself (only report_technicians
// has the broader admin-can-manage-técnicos policy; report_parts/photos and
// every other column on the report stay técnico-only), so this can't be used
// to smuggle in unrelated content changes the way reusing updateReport with
// unchanged-but-resent fields could.
export async function updateReportTechnicians(reportId, technicians) {
  return withRetry(async () => {
    const { error: delErr } = await supabase.from('report_technicians').delete().eq('report_id', reportId)
    if (delErr) throw delErr
    await insertTechnicians(reportId, technicians)
  })
}

// ─── UPDATE A REPORT'S CLIENT SNAPSHOT (ClienteDetail.jsx, unlinked clients only) ─
// Deliberately narrower than updateReport: only touches the 4 client_*
// columns (never technicians/parts/photos), and only ever targets one
// report -- the caller's own most recent editable one for that client
// (RLS still has the final say: own report, not yet signed). Editing a
// client's info here is a snapshot fix on that one report, not a
// retroactive rewrite of every past report for them.
export async function updateReportClientInfo(reportId, { clientName, clientAddress, clientPhone, clientEmail }) {
  return withRetry(async () => {
    const { data: existing } = await supabase.from('service_reports').select('pdf_storage_path').eq('id', reportId).single()
    await deleteCachedPdfIfAny(existing?.pdf_storage_path)

    const { error } = await supabase
      .from('service_reports')
      .update({
        client_name: clientName,
        client_address: clientAddress,
        client_phone: clientPhone,
        client_email: clientEmail,
        pdf_storage_path: null,
      })
      .eq('id', reportId)
    if (error) throw error
  })
}

async function insertTechnicians(reportId, technicians) {
  const rows = technicians
    .filter(t => t.technician_name?.trim())
    .map(t => ({
      report_id: reportId,
      technician_id: t.technician_id || null,
      technician_name: t.technician_name,
      fault_time: t.fault_time || null,
      arrival_pdv: t.arrival_pdv || null,
      departure_pdv: t.departure_pdv || null,
      arrival_plant: t.arrival_plant || null,
    }))
  if (rows.length === 0) return
  const { error } = await supabase.from('report_technicians').insert(rows)
  if (error) throw error
}

async function insertParts(reportId, parts) {
  const rows = parts
    .filter(p => p.description?.trim())
    .map(p => ({
      report_id: reportId,
      quantity: p.quantity || null,
      description: p.description,
      part_code: p.part_code || null,
    }))
  if (rows.length === 0) return
  const { error } = await supabase.from('report_parts').insert(rows)
  if (error) throw error
}

// ─── UPLOAD PHOTOS TO STORAGE ─────────────────────────────────────────────────
async function uploadReportPhotos(reportId, photos, onProgress) {
  const toUpload = photos.filter(p => p.file)
  let done = 0
  for (const photo of toUpload) {
    const ext = photo.file.name?.split('.').pop() || 'jpg'
    const path = `${reportId}/${crypto.randomUUID()}.${ext}`

    const { error: uploadErr } = await supabase.storage.from(PHOTO_BUCKET).upload(path, photo.file)
    if (uploadErr) throw uploadErr

    const { error: insertErr } = await supabase
      .from('report_photos')
      .insert({ report_id: reportId, storage_path: path, caption: photo.caption ?? '', photo_type: photo.type ?? 'equipo' })
    if (insertErr) throw insertErr

    done += 1
    onProgress?.({ done, total: toUpload.length })
  }
}

// ─── UPLOAD SIGNATURE IMAGE (public bucket, allowed while report is unsigned) ──
export async function uploadSignatureImage(reportId, blob) {
  const path = `${reportId}/signature.png`

  const { error: uploadErr } = await supabase.storage
    .from(SIGNATURE_BUCKET)
    .upload(path, blob, { upsert: true, contentType: 'image/png' })
  if (uploadErr) throw uploadErr

  const { data } = supabase.storage.from(SIGNATURE_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

// ─── UPLOAD REPORT PDF (private bucket, owner only – caches the archive copy) ──
export async function uploadReportPDF(reportId, blob) {
  const path = `${reportId}/report.pdf`

  const { error: uploadErr } = await supabase.storage
    .from(PDF_BUCKET)
    .upload(path, blob, { upsert: true, contentType: 'application/pdf' })
  if (uploadErr) throw uploadErr

  // A plain table update is blocked by RLS once the report is signed (004),
  // so this goes through the same SECURITY DEFINER pattern as sign_report (003) --
  // it only ever writes pdf_storage_path, never real report content.
  const { error: rpcErr } = await supabase.rpc('set_report_pdf_path', { p_report_id: reportId, p_path: path })
  if (rpcErr) throw rpcErr

  return path
}

// ─── CLEAR A REPORT'S CACHED PDF (LiberarEspacio, keeps the report itself) ────
// The inverse of uploadReportPDF -- deletes the Storage file and nulls
// pdf_storage_path via the same set_report_pdf_path RPC (needed for the
// same reason: a plain update is blocked once the report is signed or the
// caller isn't also its técnico, and this admin-wide bulk tool needs to
// work regardless of either). Unlike deleteCachedPdfIfAny, this doesn't
// swallow a failed Storage removal -- silently succeeding here would null
// the one pointer that made the leftover file findable again.
export async function clearReportCachedPdf(reportId, pdfStoragePath) {
  if (pdfStoragePath) {
    const { error: removeErr } = await supabase.storage.from(PDF_BUCKET).remove([pdfStoragePath])
    if (removeErr) throw removeErr
  }
  const { error } = await supabase.rpc('set_report_pdf_path', { p_report_id: reportId, p_path: null })
  if (error) throw error
}

// ─── GET SIGNED PDF URL ─────────────────────────────────────────────────────────
export async function getReportPdfUrl(storagePath) {
  if (!storagePath) return null
  const { data, error } = await supabase.storage.from(PDF_BUCKET).createSignedUrl(storagePath, 3600)
  if (error) return null
  return data.signedUrl
}

// ─── GET SIGNED PHOTO URL ──────────────────────────────────────────────────────
export async function getPhotoUrl(storagePath) {
  if (!storagePath) return null
  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(storagePath, 3600)
  if (error) return null
  return data.signedUrl
}

// ─── UPLOAD/READ A SINGLE EQUIPMENT FILE ATTACHMENT ────────────────────────────
// Generic, equipment-module-agnostic: any readingsGroup that opts into
// fileUpload (see genericSchema.js/bateria.js) uses this. Caller is
// responsible for patching the returned metadata into equipment_data via
// patchReportEquipmentData once the upload succeeds.
export async function uploadEquipmentFile(reportId, file) {
  const ext = file.name?.split('.').pop() || 'bin'
  const path = `${reportId}/${crypto.randomUUID()}.${ext}`

  const { error } = await supabase.storage.from(EQUIPMENT_FILE_BUCKET).upload(path, file)
  if (error) throw error

  return { storage_path: path, name: file.name, type: file.type }
}

export async function getEquipmentFileUrl(storagePath) {
  if (!storagePath) return null
  const { data, error } = await supabase.storage.from(EQUIPMENT_FILE_BUCKET).createSignedUrl(storagePath, 3600)
  if (error) return null
  return data.signedUrl
}

// ─── PATCH EQUIPMENT DATA ──────────────────────────────────────────────────────
// A narrow follow-up write used after uploadEquipmentFile: the file's storage
// path is only known once the report id exists, so equipment_data is first
// saved without it (via createReport/updateReport) and then patched here.
export async function patchReportEquipmentData(reportId, equipmentData) {
  const { error } = await supabase.from('service_reports').update({ equipment_data: equipmentData }).eq('id', reportId)
  if (error) throw error
}

// ─── DELETE REPORT ────────────────────────────────────────────────────────────
export async function deleteReport(reportId) {
  const { error } = await supabase.from('service_reports').delete().eq('id', reportId)
  if (error) throw error
}

// ─── REPORT STATS ─────────────────────────────────────────────────────────────
export async function getReportStats() {
  const reports = await getReports()
  const now = new Date()
  const thisMonth = reports.filter(r => {
    const d = new Date(r.created_at)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })
  return {
    total: reports.length,
    thisMonth: thisMonth.length,
    signed: reports.filter(r => r.status === 'signed').length,
    draft: reports.filter(r => r.status === 'draft').length,
  }
}

// ─── PUBLIC SIGNATURE FLOW (unauthenticated /firma/:reportId) ─────────────────
// These call SECURITY DEFINER Postgres functions (see migration 003) instead
// of querying service_reports directly, since that table's RLS scopes
// SELECT/UPDATE to the owning technician's session.
export async function getReportForSignature(reportId) {
  return withRetry(async () => {
    const { data, error } = await supabase
      .rpc('get_report_for_signature', { p_report_id: reportId })
      .single()
    if (error || !data) throw new Error('Reporte no encontrado')
    return data
  })
}

export async function signReport(reportId, signatureData) {
  const { error } = await supabase.rpc('sign_report', {
    p_report_id: reportId,
    p_signer_name: signatureData.client_signer_name,
    p_signer_id: signatureData.client_signer_id,
    p_signature_url: signatureData.client_signature_url,
  })
  if (error) throw error

  // Best effort: sign_report() (003) already cleared pdf_storage_path since
  // any pre-signature PDF is now stale, but a Postgres function can't reach
  // Storage's own API to delete the actual file (storage.objects blocks raw
  // SQL deletes -- "Use the Storage API instead"), only this table's DB
  // pointer. uploadReportPDF() always writes to a fixed `${id}/report.pdf`
  // path, so no need to know whether one was ever cached. This page is
  // reachable anonymously (D-4) -- the removal only actually succeeds when
  // this session is authenticated as the report's own técnico/admin (e.g.
  // the in-app "Firmar Reporte" button opens this same page in a new tab,
  // sharing that session); it silently no-ops otherwise, same as before.
  try {
    await supabase.storage.from(PDF_BUCKET).remove([`${reportId}/report.pdf`])
  } catch {
    // best effort; signing itself already succeeded above
  }
}

// ─── EVENTOS (scheduled visits, admin/técnico only) ────────────────────────
// Código del Evento -- auto-generated (NewEvento.jsx calls this once, the
// moment the create form opens) and unique (048), never hand-typed.
// Sequence-backed rather than derived from the row itself, since the code
// needs to be on screen before the event is actually saved.
export async function getNextEventCode() {
  const { data, error } = await supabase.rpc('get_next_event_code')
  if (error) throw error
  return data
}

// No client-side role filter needed -- RLS already scopes this to events
// the caller is staff on (is_event_staff, 059), or everything if admin.
// Embeds technicians too -- NewReport.jsx's event-prefill (creating a
// report from an event) needs the full roster, not just the summary
// fields eventOptionLabel itself renders.
export async function getEvents() {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('service_events')
      .select(EVENT_SELECT)
      .order('event_date', { ascending: true })
    if (error) throw error
    return data
  })
}

export async function getEvent(eventId) {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('service_events')
      .select(EVENT_SELECT)
      .eq('id', eventId)
      .single()
    if (error) throw error
    return data
  })
}

// Reports linked to this event (EventDetail.jsx's "Reportes vinculados" --
// an event can have 1+ reports, e.g. separate reports per piece of
// equipment serviced in the same visit). RLS on service_reports already
// scopes this to whatever the caller can otherwise see.
export async function getReportsForEvent(eventId) {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('service_reports')
      .select('id, report_number, client_name, equipment_type, service_type, status, created_at')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data
  })
}

export async function createEvent(eventData, userId) {
  const { technicians = [], ...fields } = eventData
  const { data: event, error } = await supabase
    .from('service_events')
    .insert({ ...fields, created_by: userId })
    .select()
    .single()
  if (error) throw error

  await insertEventTechnicians(event.id, technicians)
  return getEvent(event.id)
}

export async function updateEvent(eventId, eventData) {
  const { technicians, ...fields } = eventData

  const { error } = await supabase.from('service_events').update(fields).eq('id', eventId)
  if (error) throw error

  // technicians is only present when the caller actually means to replace
  // the roster (NewEvento.jsx's full save) -- handleStatusChange (EventDetail.jsx)
  // only ever sends { status }, and shouldn't touch it.
  if (technicians !== undefined) {
    const { error: delErr } = await supabase.from('event_technicians').delete().eq('event_id', eventId)
    if (delErr) throw delErr
    await insertEventTechnicians(eventId, technicians)
  }

  return getEvent(eventId)
}

async function insertEventTechnicians(eventId, technicians) {
  const rows = technicians
    .filter(t => t.technician_name?.trim())
    .map(t => ({
      event_id: eventId,
      technician_id: t.technician_id || null,
      technician_name: t.technician_name,
    }))
  if (rows.length === 0) return
  const { error } = await supabase.from('event_technicians').insert(rows)
  if (error) throw error
}

export async function deleteEvent(eventId) {
  const { error } = await supabase.from('service_events').delete().eq('id', eventId)
  if (error) throw error
}
