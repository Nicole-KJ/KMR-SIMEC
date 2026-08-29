import { useNavigate } from 'react-router-dom'
import { BarChart3, FileText, CheckCircle, Clock, Zap } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { SkeletonBlock } from './Skeleton'

const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function groupCount(list, keyFn) {
  const map = new Map()
  for (const item of list) {
    const key = keyFn(item) || 'Sin especificar'
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
}

// Groups by technician_id (a stable identity) rather than the snapshotted
// technician_name text, which can differ across a person's own reports if
// their profile name was set/changed after some reports were created —
// grouping by name alone would otherwise split one technician into two bars.
// `list` is assumed newest-first (as returned by getReports/getAllReports),
// so the first name seen per id is that technician's most current one.
function groupCountByTechnician(list) {
  const counts = new Map()
  const labels = new Map()
  for (const item of list) {
    const key = item.technician_id || 'Sin especificar'
    counts.set(key, (counts.get(key) ?? 0) + 1)
    if (!labels.has(key)) labels.set(key, item.technician_name || 'Sin especificar')
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ id: key, label: labels.get(key), count }))
    .sort((a, b) => b.count - a.count)
}

function monthKey(dateStr) {
  if (!dateStr) return null
  const d = new Date(`${dateStr}T00:00:00`)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function lastTwelveMonths() {
  const now = new Date()
  const months = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: `${MONTH_LABELS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
    })
  }
  return months
}

// onRowClick is only ever wired up for the técnico ranking, and only for an
// admin viewer (see ReportStatsPanel) -- rows with no real id ("Sin
// especificar", a report missing technician_id) have nowhere to navigate to.
function RankBarList({ rows, onRowClick }) {
  const max = Math.max(1, ...rows.map(r => r.count))
  return (
    <div>
      {rows.map(row => {
        const clickable = Boolean(onRowClick) && row.id && row.id !== 'Sin especificar'
        return (
          <div
            className={`rank-bar-row${clickable ? ' rank-bar-row-clickable' : ''}`}
            key={row.label}
            onClick={clickable ? () => onRowClick(row) : undefined}
          >
            <div className="rank-bar-label" title={row.label}>{row.label}</div>
            <div className="rank-bar-track">
              <div className="rank-bar-fill" style={{ width: `${(row.count / max) * 100}%` }} />
            </div>
            <div className="rank-bar-count">{row.count}</div>
          </div>
        )
      })}
    </div>
  )
}

// Shared by Statistics.jsx (every report the viewer can see) and
// UserDetail.jsx (one técnico's reports only) -- same KPIs/charts, just fed
// a different, already-filtered `reports` array. `showByTechnician` hides
// the "Reportes por Técnico" ranking when the caller already scoped
// `reports` to a single técnico, where that bar chart would be redundant
// with the page it's shown on.
export default function ReportStatsPanel({ reports, loading, error, onRetry, showByTechnician = true }) {
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const total = reports.length
  const openCount = reports.filter(r => r.status === 'draft').length
  const completedCount = reports.filter(r => r.status === 'completed' || r.status === 'signed').length
  const completionRate = total > 0 ? Math.round((completedCount / total) * 100) : 0
  const signedCount = reports.filter(r => r.status === 'signed').length

  const byTechnician = showByTechnician ? groupCountByTechnician(reports) : null
  const byCustomer = groupCount(reports, r => r.client_name).slice(0, 8)

  const countsByMonthKey = {}
  for (const r of reports) {
    const key = monthKey(r.report_date)
    if (key) countsByMonthKey[key] = (countsByMonthKey[key] ?? 0) + 1
  }
  const byMonth = lastTwelveMonths().map(m => ({ ...m, count: countsByMonthKey[m.key] ?? 0 }))
  const maxMonthCount = Math.max(1, ...byMonth.map(m => m.count))

  if (loading) return (
    <>
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
      <div style={{ display:'grid', gridTemplateColumns: showByTechnician ? '1fr 1fr' : '1fr', gap:20, marginBottom:20 }}>
        {Array.from({ length: showByTechnician ? 2 : 1 }).map((_, i) => (
          <div className="card" key={i}>
            <SkeletonBlock width={140} height={16} style={{ marginBottom:18, borderRadius: 'var(--radius-full)' }} />
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
                <SkeletonBlock width={100} height={13} />
                <SkeletonBlock width="100%" height={16} style={{ borderRadius:4 }} />
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="card">
        <SkeletonBlock width={220} height={16} style={{ marginBottom:20, borderRadius: 'var(--radius-full)' }} />
        <div style={{ display:'flex', alignItems:'flex-end', gap:6, height:160 }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <SkeletonBlock key={i} width="100%" height={`${20 + (i * 37) % 100}%`} style={{ borderRadius:'4px 4px 0 0' }} />
          ))}
        </div>
      </div>
    </>
  )

  if (error) return (
    <div className="card">
      <div className="empty-state">
        <div className="empty-icon">⚠️</div>
        <p>No se pudieron cargar los reportes</p>
        <span>Verifica tu conexión e intenta de nuevo</span>
        <br /><br />
        <button className="btn btn-primary" onClick={onRetry}>Reintentar</button>
      </div>
    </div>
  )

  if (total === 0) return (
    <div className="card">
      <div className="empty-state">
        <div className="empty-icon">📊</div>
        <p>Aún no hay datos suficientes</p>
        <span>Las estadísticas aparecerán cuando existan reportes</span>
      </div>
    </div>
  )

  return (
    <>
      {/* KPI row */}
      <div className="stats-grid">
        <div className="stat-card">
          <div><div className="stat-info">
            <div className="stat-label">Total Reportes</div>
            <div className="stat-value">{total}</div>
          </div></div>
          <div className="stat-icon teal"><FileText size={22} /></div>
        </div>
        <div className="stat-card">
          <div><div className="stat-info">
            <div className="stat-label">Firmados</div>
            <div className="stat-value" style={{ color:'var(--clr-success)' }}>{signedCount}</div>
          </div></div>
          <div className="stat-icon green"><CheckCircle size={22} /></div>
        </div>
        <div className="stat-card">
          <div><div className="stat-info">
            <div className="stat-label">Completados</div>
            <div className="stat-value" style={{ color:'var(--clr-blue)' }}>
              {completedCount} <span style={{ fontSize:16, fontWeight:600, color:'var(--clr-text-light)' }}>({completionRate}%)</span>
            </div>
          </div></div>
          <div className="stat-icon blue"><Zap size={22} /></div>
        </div>
        <div className="stat-card">
          <div><div className="stat-info">
            <div className="stat-label">Borradores</div>
            <div className="stat-value" style={{ color:'var(--clr-warning)' }}>{openCount}</div>
          </div></div>
          <div className="stat-icon yellow"><Clock size={22} /></div>
        </div>
      </div>

      {/* By technician / By customer */}
      <div style={{ display:'grid', gridTemplateColumns: showByTechnician ? '1fr 1fr' : '1fr', gap:20, marginBottom:20 }}>
        {showByTechnician && (
          <div className="card">
            <p className="section-tag">Reportes por Técnico</p>
            <RankBarList rows={byTechnician} onRowClick={isAdmin ? (row) => navigate(`/admin/usuarios/${row.id}`) : undefined} />
          </div>
        )}
        <div className="card">
          <p className="section-tag">Reportes por Cliente</p>
          <RankBarList rows={byCustomer} />
        </div>
      </div>

      {/* By month */}
      <div className="card">
        <p className="section-tag"><BarChart3 size={14} style={{ verticalAlign:'-2px', marginRight:4 }} />Reportes por Mes (últimos 12 meses)</p>
        <div className="month-chart">
          {byMonth.map(m => (
            <div className="month-bar-col" key={m.key}>
              <div className="month-bar-value">{m.count > 0 ? m.count : ''}</div>
              <div className="month-bar" style={{ height: `${(m.count / maxMonthCount) * 100}%` }} />
              <div className="month-bar-label">{m.label}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
