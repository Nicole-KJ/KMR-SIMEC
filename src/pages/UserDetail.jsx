import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader } from 'lucide-react'
import { listUsers } from '../services/adminUsersService'
import { useReports } from '../hooks/useReports'
import ReportStatsPanel from '../components/ReportStatsPanel'
import { logError } from '../utils/logger'

const ROLE_LABELS = { admin: 'Administrador', tecnico: 'Técnico', cliente: 'Cliente' }

export default function UserDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [users, setUsers] = useState([])
  const [usersLoading, setUsersLoading] = useState(true)
  const [usersError, setUsersError] = useState('')
  const { reports, loading: reportsLoading, error: reportsError, reload } = useReports()

  useEffect(() => {
    let cancelled = false
    setUsersLoading(true)
    listUsers()
      .then(data => { if (!cancelled) setUsers(data) })
      .catch(err => {
        logError('UserDetail.listUsers', err)
        if (!cancelled) setUsersError(err.message ?? 'Error al cargar el usuario')
      })
      .finally(() => { if (!cancelled) setUsersLoading(false) })
    return () => { cancelled = true }
  }, [])

  const targetUser = useMemo(() => users.find(u => u.id === id), [users, id])

  // getAllReports() (admin, the only role that can reach this page — see
  // App.jsx) embeds each report's listed técnicos, not just its creator, so
  // a report counts for this user whether they made it or were just added
  // to its Técnicos table — same "reports where they're a técnico" rule
  // used everywhere else this session (RLS's is_report_technician, 027).
  const userReports = useMemo(() => {
    if (!id) return []
    return reports.filter(r => r.technician_id === id || r.technicians?.some(t => t.technician_id === id))
  }, [reports, id])

  const loading = usersLoading || reportsLoading

  if (!loading && !targetUser) {
    return (
      <div className="content-wrapper fade-in">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <button className="icon-btn" onClick={() => navigate('/admin/usuarios')}><ArrowLeft size={18} /></button>
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>Usuario no encontrado</h1>
        </div>
        {usersError && <p style={{ color: 'var(--clr-danger)', fontSize: 14 }}>{usersError}</p>}
      </div>
    )
  }

  return (
    <div className="content-wrapper fade-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <button className="icon-btn" onClick={() => navigate('/admin/usuarios')}><ArrowLeft size={18} /></button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>{usersLoading ? 'Cargando…' : (targetUser.full_name || targetUser.email)}</h1>
          <p style={{ color: 'var(--clr-text-light)', fontSize: 13 }}>Estadísticas del usuario</p>
        </div>
        {!usersLoading && (
          <span className={`badge ${targetUser.banned ? 'badge-draft' : 'badge-signed'}`} style={{ fontSize: 13, padding: '6px 14px' }}>
            {targetUser.banned ? 'Deshabilitado' : 'Activo'}
          </span>
        )}
      </div>

      {usersLoading ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Loader size={32} className="spin" color="var(--clr-primary)" />
        </div>
      ) : (
        <>
          <div className="card" style={{ marginBottom: 24 }}>
            <p className="section-tag">Datos del usuario</p>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {[
                  ['Nombre', targetUser.full_name || '—'],
                  ['Correo', targetUser.email || '—'],
                  ['Rol', ROLE_LABELS[targetUser.role] ?? targetUser.role ?? '—'],
                  ['Último acceso', targetUser.last_sign_in_at ? new Date(targetUser.last_sign_in_at).toLocaleDateString('es-CR') : 'Nunca'],
                ].map(([k, v]) => (
                  <tr key={k}>
                    <td style={{ padding: '6px 0', color: 'var(--clr-text-light)', fontSize: 13, width: '40%', fontWeight: 600 }}>{k}</td>
                    <td style={{ padding: '6px 0', fontSize: 14, fontWeight: 500, wordBreak: 'break-word' }}>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ReportStatsPanel reports={userReports} loading={reportsLoading} error={reportsError} onRetry={reload} showByTechnician={false} />
        </>
      )}
    </div>
  )
}
