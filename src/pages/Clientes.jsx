import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserPlus, Loader, Users, Ban, CheckCircle, AlertCircle } from 'lucide-react'
import { inviteClient, setClientBanned } from '../services/clientUsersService'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { useClientsDirectory } from '../hooks/useClientsDirectory'
import { logError } from '../utils/logger'
import { usePagination } from '../hooks/usePagination'
import Pagination from '../components/Pagination'

export default function Clientes() {
  const { isAdmin } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const { clients, setClients, existingEmails, loading, error, reload: loadClients } = useClientsDirectory()
  const [busyUserId, setBusyUserId] = useState(null)

  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteResult, setInviteResult] = useState(null)

  const { page, setPage, totalPages, pageItems: paginatedClients } = usePagination(clients)

  async function handleInvite(e) {
    e.preventDefault()
    setInviting(true)
    setInviteResult(null)
    try {
      await inviteClient(email, fullName)
      setInviteResult({ success: true, message: `Invitación enviada a ${email}` })
      setEmail(''); setFullName('')
      await loadClients()
    } catch (err) {
      setInviteResult({ success: false, message: err.message ?? 'Error al invitar' })
    } finally {
      setInviting(false)
    }
  }

  async function handleToggleBanned(userId, currentlyBanned) {
    setBusyUserId(userId)
    try {
      await setClientBanned(userId, !currentlyBanned)
      setClients(prev => prev.map(c => c.id === userId ? { ...c, banned: !currentlyBanned } : c))
    } catch (err) {
      logError('Clientes.handleToggleBanned', err)
      showToast('Error al actualizar el estado: ' + (err.message ?? err))
    } finally {
      setBusyUserId(null)
    }
  }

  async function handleInviteUnlinked(rowId, clientEmail, clientFullName) {
    setBusyUserId(rowId)
    try {
      await inviteClient(clientEmail, clientFullName)
      showToast(`Invitación enviada a ${clientEmail}`, 'success')
      await loadClients()
    } catch (err) {
      logError('Clientes.handleInviteUnlinked', err)
      showToast('Error al invitar: ' + (err.message ?? err))
    } finally {
      setBusyUserId(null)
    }
  }


  return (
    <div className="content-wrapper fade-in">
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}><Users size={22} style={{ verticalAlign: 'middle', marginRight: 8 }} />Clientes</h1>
        <p style={{ color: 'var(--clr-text-light)', fontSize: 13, marginTop: 4 }}>Invita clientes y gestiona su acceso a K Maintenance Report</p>
      </div>

      {/* Invite form */}
      <div className="card" style={{ marginBottom: 24, maxWidth: 640 }}>
        <p className="section-tag">Invitar cliente</p>

        {inviteResult && (
          <div style={{
            background: inviteResult.success ? 'var(--clr-success-bg)' : 'var(--clr-danger-bg)',
            color: inviteResult.success ? 'var(--clr-success)' : 'var(--clr-danger)',
            border: inviteResult.success ? '1.5px solid var(--clr-success)' : 'none',
            padding: '10px 14px', borderRadius: 'var(--radius-md)',
            marginBottom: 16, fontSize: 13, fontWeight: 500,
            display: 'flex', gap: 8, alignItems: 'center',
          }}>
            {inviteResult.success ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
            {inviteResult.message}
          </div>
        )}

        <form onSubmit={handleInvite}>
          <div className="form-row form-row-2">
            <div className="form-group">
              <label className="form-label">Correo electrónico <span>*</span></label>
              <input type="email" className="form-control" required
                value={email} onChange={e => setEmail(e.target.value)}
                placeholder="cliente@empresa.com" />
            </div>
            <div className="form-group">
              <label className="form-label">Nombre completo</label>
              <input className="form-control"
                value={fullName} onChange={e => setFullName(e.target.value)}
                placeholder="Nombre del cliente" />
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={inviting}>
            {inviting ? <><Loader size={14} className="spin" /> Enviando...</> : <><UserPlus size={14} /> Enviar invitación</>}
          </button>
        </form>
      </div>

      {/* Clients list */}
      <div className="card">
        <p className="section-tag">Todos los clientes</p>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <Loader size={32} className="spin" color="var(--clr-primary)" />
          </div>
        ) : error ? (
          <div style={{ padding: 16 }}>
            <p style={{ color: 'var(--clr-danger)', fontSize: 14, marginBottom: 12 }}>{error}</p>
            <button className="btn btn-secondary btn-sm" onClick={loadClients}>Reintentar</button>
          </div>
        ) : (
          <>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Correo</th>
                    <th>Nombre</th>
                    <th>Estado</th>
                    <th>Último acceso</th>
                    <th>Vinculado al portal</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedClients.map(c => (
                    <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/clientes/${encodeURIComponent(c.id)}`)}>
                      <td>{c.email || '—'}</td>
                      <td>{c.full_name || '—'}</td>
                      <td>
                        {c.linked ? (
                          <span className={`badge ${c.banned ? 'badge-draft' : 'badge-signed'}`}>
                            {c.banned ? 'Deshabilitado' : 'Activo'}
                          </span>
                        ) : '—'}
                      </td>
                      <td style={{ color: 'var(--clr-text-light)' }}>
                        {c.linked ? (c.last_sign_in_at ? new Date(c.last_sign_in_at).toLocaleDateString('es-CR') : 'Nunca') : '—'}
                      </td>
                      <td>
                        <span className={`badge ${c.linked ? 'badge-signed' : 'badge-draft'}`}>
                          {c.linked ? 'Sí' : 'No'}
                        </span>
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        {c.linked ? (
                          // Disabling/enabling a portal account is admin-only, enforced
                          // server-side too (client-users edge function) -- a técnico
                          // never sees this button since it would just 403 for them.
                          isAdmin && (
                            <button
                              className="btn btn-secondary btn-sm"
                              disabled={busyUserId === c.id}
                              onClick={() => handleToggleBanned(c.id, c.banned)}
                            >
                              {c.banned ? <><CheckCircle size={13} /> Habilitar</> : <><Ban size={13} /> Deshabilitar</>}
                            </button>
                          )
                        ) : (
                          // Inviting an unlinked client is allowed for admin AND técnico
                          // server-side, so both get the button here too.
                          c.email && c.full_name && !existingEmails.has(c.email.toLowerCase()) && (
                            <button
                              className="btn btn-secondary btn-sm"
                              disabled={busyUserId === c.id}
                              onClick={() => handleInviteUnlinked(c.id, c.email, c.full_name)}
                            >
                              {busyUserId === c.id ? <Loader size={13} className="spin" /> : <UserPlus size={13} />} Invitar
                            </button>
                          )
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        )}
      </div>
    </div>
  )
}