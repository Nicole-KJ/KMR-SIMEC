import { useNavigate } from 'react-router-dom'
import { FilePlus, FileText, Clock, CheckCircle, Zap, ArrowRight, LayoutDashboard } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useReports } from '../hooks/useReports'
import { SkeletonBlock } from '../components/Skeleton'
import ReportsTable, { ReportsTableSkeleton } from '../components/ReportsTable'

const RECENT_COUNT = 5

export default function Dashboard() {
  const navigate = useNavigate()
  const { isAdmin, isClient } = useAuth()
  const { reports, loading, error, reload } = useReports()

  const total = reports.length
  const signed = reports.filter(r => r.status === 'signed').length
  const completed = reports.filter(r => r.status === 'completed').length
  const drafts = reports.filter(r => r.status === 'draft').length
  const recentReports = reports.slice(0, RECENT_COUNT)

  return (
    <div className="content-wrapper fade-in">
      {/* Page header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:28 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800 }}><LayoutDashboard size={22} style={{ verticalAlign: 'middle', marginRight: 8 }} />Dashboard</h1>
          <p style={{ color:'var(--clr-text-light)', fontSize:13, marginTop:4 }}>
            {new Date().toLocaleDateString('es-CR', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}
          </p>
        </div>
        {!isClient && (
          <button id="btn-nuevo-reporte" className="btn btn-primary" onClick={() => navigate('/nuevo-reporte')}>
            <FilePlus size={16} /> Nuevo Reporte
          </button>
        )}
      </div>

      {/* Stats */}
      {loading ? (
        <div className="stats-grid">
          {Array.from({ length: 4 }).map((_, i) => (
            <div className="stat-card" key={i}>
              <div style={{ flex: 1 }}>
                <SkeletonBlock width={90} height={12} style={{ marginBottom: 10 }} />
                <SkeletonBlock width={50} height={26} />
              </div>
              <SkeletonBlock width={48} height={48} style={{ borderRadius: 'var(--radius-md)', flexShrink: 0 }} />
            </div>
          ))}
        </div>
      ) : (
        <div className="stats-grid">
          <div className="stat-card">
            <div>
              <div className="stat-info">
                <div className="stat-label">Total Reportes</div>
                <div className="stat-value">{total}</div>
              </div>
            </div>
            <div className="stat-icon teal"><FileText size={22} /></div>
          </div>
          <div className="stat-card">
            <div>
              <div className="stat-info">
                <div className="stat-label">Firmados</div>
                <div className="stat-value" style={{ color:'var(--clr-success)' }}>{signed}</div>
              </div>
            </div>
            <div className="stat-icon green"><CheckCircle size={22} /></div>
          </div>
          <div className="stat-card">
            <div>
              <div className="stat-info">
                <div className="stat-label">Completados</div>
                <div className="stat-value" style={{ color:'var(--clr-blue)' }}>{completed}</div>
              </div>
            </div>
            <div className="stat-icon blue"><Zap size={22} /></div>
          </div>
          <div className="stat-card">
            <div>
              <div className="stat-info">
                <div className="stat-label">Borradores</div>
                <div className="stat-value" style={{ color:'var(--clr-warning)' }}>{drafts}</div>
              </div>
            </div>
            <div className="stat-icon yellow"><Clock size={22} /></div>
          </div>
        </div>
      )}

      {/* Recent activity preview */}
      <div className="card">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <h3 style={{ fontSize:17, fontWeight:700 }}>Actividad Reciente</h3>
          {!loading && reports.length > 0 && (
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/reportes')}>
              Ver todos los reportes <ArrowRight size={14} />
            </button>
          )}
        </div>

        {loading ? (
          <ReportsTableSkeleton isAdmin={isAdmin} />
        ) : error ? (
          <div className="empty-state">
            <div className="empty-icon">⚠️</div>
            <p>No se pudieron cargar los reportes</p>
            <span>Verifica tu conexión e intenta de nuevo</span>
            <br /><br />
            <button className="btn btn-primary" onClick={reload}>Reintentar</button>
          </div>
        ) : reports.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <p>No hay reportes aún</p>
            {isClient ? (
              <span>Aún no tienes reportes asignados</span>
            ) : (
              <>
                <span>Crea tu primer informe de servicio</span>
                <br /><br />
                <button className="btn btn-primary" onClick={() => navigate('/nuevo-reporte')}>
                  <FilePlus size={16} /> Crear Reporte
                </button>
              </>
            )}
          </div>
        ) : (
          <ReportsTable reports={recentReports} isAdmin={isAdmin} />
        )}
      </div>
    </div>
  )
}
