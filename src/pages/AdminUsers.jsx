import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserPlus, Loader, ShieldCheck, Ban, CheckCircle, AlertCircle, KeyRound, Trash2, Search, X } from 'lucide-react'
import { listUsers, inviteUser, setUserBanned, setUserPassword } from '../services/adminUsersService'
import { setUserRole } from '../services/supabaseDB'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { logError } from '../utils/logger'
import { usePagination } from '../hooks/usePagination'
import { useUserFilters, ROLE_OPTIONS, STATUS_OPTIONS } from '../hooks/useUserFilters'
import Pagination from '../components/Pagination'
import DeleteUserModal from '../components/DeleteUserModal'

const FULL_NAME_PLACEHOLDER = {
  tecnico: 'Nombre del técnico',
  admin: 'Nombre del admin',
}

export default function AdminUsers() {
  const navigate = useNavigate()
  const { user: currentUser } = useAuth()
  const { showToast } = useToast()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyUserId, setBusyUserId] = useState(null)

  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState('tecnico')
  const [inviting, setInviting] = useState(false)
  const [inviteResult, setInviteResult] = useState(null)

  const [passwordTarget, setPasswordTarget] = useState(null)
  const [newPassword, setNewPassword] = useState('')
  const [settingPassword, setSettingPassword] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState(null)

  async function loadUsers() {
    setLoading(true)
    setError('')
    try {
      const data = await listUsers()
      // Clients are managed on their own page (Clientes), not here.
      setUsers(data.filter(u => u.role !== 'cliente'))
    } catch (err) {
      setError(err.message ?? 'Error al cargar usuarios')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadUsers() }, [])

  const {
    searchQuery, setSearchQuery, roleFilter, setRoleFilter, statusFilter, setStatusFilter,
    hasActiveFilters, clearFilters, filteredUsers,
  } = useUserFilters(users)
  const { page, setPage, totalPages, pageItems: paginatedUsers } = usePagination(filteredUsers)

  async function handleInvite(e) {
    e.preventDefault()
    setInviting(true)
    setInviteResult(null)
    try {
      await inviteUser(email, fullName, role)
      setInviteResult({ success: true, message: `Invitación enviada a ${email}` })
      setEmail(''); setFullName(''); setRole('tecnico')
      await loadUsers()
    } catch (err) {
      setInviteResult({ success: false, message: err.message ?? 'Error al invitar' })
    } finally {
      setInviting(false)
    }
  }

  async function handleRoleChange(userId, newRole) {
    setBusyUserId(userId)
    try {
      await setUserRole(userId, newRole)
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u))
    } catch (err) {
      logError('AdminUsers.handleRoleChange', err)
      showToast('Error al cambiar el rol: ' + (err.message ?? err))
    } finally {
      setBusyUserId(null)
    }
  }

  async function handleToggleBanned(userId, currentlyBanned) {
    setBusyUserId(userId)
    try {
      await setUserBanned(userId, !currentlyBanned)
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, banned: !currentlyBanned } : u))
    } catch (err) {
      logError('AdminUsers.handleToggleBanned', err)
      showToast('Error al actualizar el estado: ' + (err.message ?? err))
    } finally {
      setBusyUserId(null)
    }
  }

  async function handleSetPassword() {
    setSettingPassword(true)
    try {
      await setUserPassword(passwordTarget.id, newPassword)
      showToast(`Contraseña actualizada para ${passwordTarget.email}`, 'success')
      setPasswordTarget(null)
      setNewPassword('')
    } catch (err) {
      logError('AdminUsers.handleSetPassword', err)
      showToast('Error al establecer la contraseña: ' + (err.message ?? err))
    } finally {
      setSettingPassword(false)
    }
  }

  return (
    <div className="content-wrapper fade-in">
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}><ShieldCheck size={22} style={{ verticalAlign: 'middle', marginRight: 8 }} />Usuarios</h1>
        <p style={{ color: 'var(--clr-text-light)', fontSize: 13, marginTop: 4 }}>Invita técnicos, asigna roles y gestiona el acceso a K Maintenance Report</p>
      </div>

      {/* Invite form */}
      <div className="card" style={{ marginBottom: 24, maxWidth: 640 }}>
        <p className="section-tag">Invitar usuario</p>

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
          <div className="form-row form-row-3">
            <div className="form-group">
              <label className="form-label">Correo electrónico <span>*</span></label>
              <input type="email" className="form-control" required
                value={email} onChange={e => setEmail(e.target.value)}
                placeholder="tecnico@simec-cr.com" />
            </div>
            <div className="form-group">
              <label className="form-label">Nombre completo</label>
              <input className="form-control"
                value={fullName} onChange={e => setFullName(e.target.value)}
                placeholder={FULL_NAME_PLACEHOLDER[role]} />
            </div>
            <div className="form-group">
              <label className="form-label">Rol</label>
              <select className="form-control form-control-select" value={role} onChange={e => setRole(e.target.value)}>
                <option value="tecnico">Técnico</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={inviting}>
            {inviting ? <><Loader size={14} className="spin" /> Enviando...</> : <><UserPlus size={14} /> Enviar invitación</>}
          </button>
        </form>
      </div>

      {/* Users list */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <p className="section-tag" style={{ marginBottom: 0 }}>Todos los usuarios</p>
          {!loading && !error && users.length > 0 && (
            <span style={{ fontSize: 13, color: 'var(--clr-text-light)' }}>
              Mostrando {paginatedUsers.length ? (page - 1) * 10 + 1 : 0}-{(page - 1) * 10 + paginatedUsers.length} de {filteredUsers.length}
            </span>
          )}
        </div>

        {!loading && !error && users.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', margin: '16px 0 20px' }}>
            <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 180 }}>
              <Search size={14} color="var(--clr-text-light)" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
              <input className="form-control" style={{ paddingLeft: 32 }} placeholder="Buscar por correo o nombre..."
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
            <select className="form-control form-control-select" style={{ maxWidth: 180 }}
              value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
              <option value="">Todos los roles</option>
              {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <select className="form-control form-control-select" style={{ maxWidth: 180 }}
              value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">Todos los estados</option>
              {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            {hasActiveFilters && (
              <button className="btn btn-secondary btn-sm" onClick={clearFilters}>
                <X size={14} /> Limpiar
              </button>
            )}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <Loader size={32} className="spin" color="var(--clr-primary)" />
          </div>
        ) : error ? (
          <div style={{ padding: 16 }}>
            <p style={{ color: 'var(--clr-danger)', fontSize: 14, marginBottom: 12 }}>{error}</p>
            <button className="btn btn-secondary btn-sm" onClick={loadUsers}>Reintentar</button>
          </div>
        ) : users.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">👤</div>
            <p>No hay usuarios aún</p>
            <span>Invita a tu primer técnico o administrador arriba</span>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🔍</div>
            <p>Ningún usuario coincide con los filtros</p>
            <span>Ajusta o limpia los filtros para ver más resultados</span>
            <br /><br />
            <button className="btn btn-secondary" onClick={clearFilters}>
              <X size={16} /> Limpiar Filtros
            </button>
          </div>
        ) : (
          <>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Correo</th>
                    <th>Nombre</th>
                    <th>Rol</th>
                    <th>Estado</th>
                    <th>Último acceso</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedUsers.map(u => (
                    <tr key={u.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/admin/usuarios/${u.id}`)}>
                      <td>{u.email}</td>
                      <td>{u.full_name || '—'}</td>
                      <td onClick={e => e.stopPropagation()}>
                        <select
                          className="form-control form-control-select"
                          style={{ padding: '4px 28px 4px 8px', fontSize: 13, minWidth: 150 }}
                          value={u.role}
                          disabled={busyUserId === u.id || u.id === currentUser?.id}
                          onChange={e => handleRoleChange(u.id, e.target.value)}
                        >
                          <option value="tecnico">Técnico</option>
                          <option value="admin">Administrador</option>
                        </select>
                      </td>
                      <td>
                        <span className={`badge ${u.banned ? 'badge-draft' : 'badge-signed'}`}>
                          {u.banned ? 'Deshabilitado' : 'Activo'}
                        </span>
                      </td>
                      <td style={{ color: 'var(--clr-text-light)' }}>
                        {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString('es-CR') : 'Nunca'}
                      </td>
                      <td style={{ display: 'flex', gap: 8 }} onClick={e => e.stopPropagation()}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => { setPasswordTarget(u); setNewPassword('') }}
                        >
                          <KeyRound size={13} /> Contraseña
                        </button>
                        {u.id !== currentUser?.id && (
                          <button
                            className="btn btn-secondary btn-sm"
                            disabled={busyUserId === u.id}
                            onClick={() => handleToggleBanned(u.id, u.banned)}
                          >
                            {u.banned ? <><CheckCircle size={13} /> Habilitar</> : <><Ban size={13} /> Deshabilitar</>}
                          </button>
                        )}
                        {u.id !== currentUser?.id && (
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ color: 'var(--clr-danger)', borderColor: 'var(--clr-danger)' }}
                            onClick={() => setDeleteTarget(u)}
                          >
                            <Trash2 size={13} /> Eliminar
                          </button>
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

      {passwordTarget && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setPasswordTarget(null) }}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 200, padding: 16,
          }}
        >
          <div className="card fade-in" style={{ maxWidth: 400, width: '100%' }}>
            <p className="section-tag">Establecer contraseña</p>
            <p style={{ fontSize: 13, color: 'var(--clr-text-light)', marginBottom: 16 }}>
              Reemplaza la contraseña de <strong>{passwordTarget.email}</strong> directamente, sin enviar correo.
              Comparte la nueva contraseña con la persona por un canal seguro.
            </p>
            <div className="form-group">
              <label className="form-label">Nueva contraseña</label>
              <input className="form-control" type="text" value={newPassword}
                onChange={e => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <button className="btn btn-secondary" onClick={() => setPasswordTarget(null)} disabled={settingPassword}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={handleSetPassword}
                disabled={settingPassword || newPassword.length < 6}>
                {settingPassword ? <><Loader size={14} className="spin" /> Guardando...</> : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <DeleteUserModal
          user={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => {
            setDeleteTarget(null)
            loadUsers()
            navigate('/admin/usuarios')
          }}
        />
      )}
    </div>
  )
}
