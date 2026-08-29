import { useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader, Pencil, X } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useClientsDirectory } from '../hooks/useClientsDirectory'
import { useReports } from '../hooks/useReports'
import { usePagination } from '../hooks/usePagination'
import { useBackNavigate } from '../hooks/useBackNavigate'
import { updateReportClientInfo } from '../services/supabaseDB'
import { isBlank, isValidEmail } from '../utils/validation'
import { useToast } from '../contexts/ToastContext'
import { logError } from '../utils/logger'
import ReportsTable from '../components/ReportsTable'
import Pagination from '../components/Pagination'

const normalize = s => (s || '').trim().toLowerCase()

export default function ClienteDetail() {
  const { id: rawId } = useParams()
  const navigate = useNavigate()
  const goBack = useBackNavigate()
  const { isAdmin } = useAuth()
  const { showToast } = useToast()
  const id = decodeURIComponent(rawId)

  const { clients, loading: clientsLoading, error: clientsError, reload: reloadClients } = useClientsDirectory()
  const { reports, loading: reportsLoading, reload: reloadReports } = useReports()

  const client = useMemo(() => clients.find(c => c.id === id), [clients, id])

  // "reports" is already scoped by role (own for técnico, all for admin —
  // see useReports) -- narrow it down further to this one client. Linked
  // clients are matched by the stable client_user_id; unlinked ones only
  // ever have a free-text client_name on the report, so name is all we
  // have to match on (case/whitespace-insensitive, same as 023's dedupe).
  const clientReports = useMemo(() => {
    if (!client) return []
    return reports.filter(r => (
      client.linked ? r.client_user_id === client.id : normalize(r.client_name) === normalize(client.full_name)
    ))
  }, [reports, client])

  // Editing "Datos del cliente" only makes sense for a client that isn't
  // vinculado al portal -- a linked client's real record is their portal
  // account, not free text on a report. It's a contact-info snapshot fix on
  // the most recent report (see updateReportClientInfo), not an edit of the
  // report's actual content, so it's allowed at any status, signed
  // included (033/034) -- unlike the full report edit screen, which stays
  // locked once signed. No extra ownership check needed here: clientReports
  // only ever contains reports this user is already allowed to see (own,
  // listed as a técnico, or any report at all if admin).
  const editableReport = !client?.linked ? clientReports[0] : null

  const { page, setPage, totalPages, pageItems: paginatedReports } = usePagination(clientReports)

  const loading = clientsLoading || reportsLoading
  const latestReport = clientReports[0]

  const [editing, setEditing] = useState(false)
  const [formName, setFormName] = useState('')
  const [formAddress, setFormAddress] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  // A linked client can set their own address/phone/contact_email from
  // "Mi Perfil" (ProfileModal.jsx, 030) -- prefer that once they have.
  // Falls back to whatever a técnico last typed on a report (still the
  // only source at all for an unlinked client, who has no profile), then
  // the portal account's real login email as a last resort for "Correo".
  const address = client?.address || latestReport?.client_address || '—'
  const phone = client?.phone || latestReport?.client_phone || '—'
  const email = client?.contact_email || client?.email || latestReport?.client_email || '—'

  function startEditing() {
    setFormName(client.full_name || '')
    setFormAddress(address === '—' ? '' : address)
    setFormPhone(phone === '—' ? '' : phone)
    setFormEmail(email === '—' ? '' : email)
    setFormError('')
    setEditing(true)
  }

  async function handleSave(e) {
    e.preventDefault()
    if (isBlank(formName)) { setFormError('El nombre del cliente es requerido.'); return }
    if (isBlank(formEmail)) { setFormError('El correo del cliente es requerido.'); return }
    if (!isValidEmail(formEmail)) { setFormError('El correo del cliente no es válido.'); return }

    setSaving(true)
    setFormError('')
    try {
      await updateReportClientInfo(editableReport.id, {
        clientName: formName.trim(),
        clientAddress: formAddress.trim(),
        clientPhone: formPhone.trim(),
        clientEmail: formEmail.trim(),
      })
      await Promise.all([reloadClients(), reloadReports()])
      showToast('Datos del cliente actualizados', 'success')
      setEditing(false)
      const newId = `unlinked:${formName.trim()}`
      if (newId !== id) navigate(`/clientes/${encodeURIComponent(newId)}`, { replace: true })
    } catch (err) {
      logError('ClienteDetail.handleSave', err)
      setFormError(err.message ?? 'No se pudo guardar los cambios')
    } finally {
      setSaving(false)
    }
  }

  if (!loading && !client) {
    return (
      <div className="content-wrapper fade-in">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <button className="icon-btn" onClick={goBack}><ArrowLeft size={18} /></button>
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>Cliente no encontrado</h1>
        </div>
        {clientsError && <p style={{ color: 'var(--clr-danger)', fontSize: 14 }}>{clientsError}</p>}
      </div>
    )
  }

  return (
    <div className="content-wrapper fade-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <button className="icon-btn" onClick={goBack}><ArrowLeft size={18} /></button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>{loading ? 'Cargando…' : (client.full_name || '—')}</h1>
          <p style={{ color: 'var(--clr-text-light)', fontSize: 13 }}>Ficha del cliente</p>
        </div>
        {!loading && (
          <span className={`badge ${client.linked ? 'badge-signed' : 'badge-draft'}`} style={{ fontSize: 13, padding: '6px 14px' }}>
            {client.linked ? 'Vinculado al portal' : 'No vinculado al portal'}
          </span>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Loader size={32} className="spin" color="var(--clr-primary)" />
        </div>
      ) : (
        <>
          <div className="card" style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p className="section-tag" style={{ marginBottom: 0 }}>Datos del cliente</p>
              {!editing && editableReport && (
                <button className="btn btn-secondary btn-sm" onClick={startEditing}>
                  <Pencil size={13} /> Editar
                </button>
              )}
            </div>

            {editing ? (
              <form onSubmit={handleSave} style={{ marginTop: 16 }}>
                {formError && (
                  <p style={{ color: 'var(--clr-danger)', fontSize: 13, marginBottom: 12, fontWeight: 500 }}>{formError}</p>
                )}
                <div className="form-row form-row-2">
                  <div className="form-group">
                    <label className="form-label">Nombre del cliente <span>*</span></label>
                    <input className="form-control" value={formName} onChange={e => setFormName(e.target.value)} placeholder="Nombre o empresa" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Dirección</label>
                    <input className="form-control" value={formAddress} onChange={e => setFormAddress(e.target.value)} placeholder="Dirección de la visita" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Teléfono del cliente</label>
                    <input className="form-control" type="tel" value={formPhone} onChange={e => setFormPhone(e.target.value)} placeholder="8888-8888" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Correo del cliente <span>*</span></label>
                    <input className="form-control" type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} placeholder="cliente@empresa.com" />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? <><Loader size={14} className="spin" /> Guardando...</> : 'Guardar'}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setEditing(false)} disabled={saving}>
                    <X size={14} /> Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
                <tbody>
                  {[
                    ['Nombre del cliente', client.full_name || '—'],
                    ['Dirección', address],
                    ['Teléfono del cliente', phone],
                    ['Correo del cliente', email],
                  ].map(([k, v]) => (
                    <tr key={k}>
                      <td style={{ padding: '6px 0', color: 'var(--clr-text-light)', fontSize: 13, width: '40%', fontWeight: 600 }}>{k}</td>
                      <td style={{ padding: '6px 0', fontSize: 14, fontWeight: 500 }}>{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="card">
            <p className="section-tag">Reportes de este cliente</p>
            {clientReports.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📋</div>
                <p>Este cliente no tiene reportes aún</p>
              </div>
            ) : (
              <>
                <ReportsTable reports={paginatedReports} isAdmin={isAdmin} />
                <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
