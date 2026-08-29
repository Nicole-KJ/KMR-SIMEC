import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { formatDate } from '../services/supabaseDB'
import { EQUIPMENT_MODULES } from '../constants/equipmentModules'
import { BADGE_CLASS, STATUS_LABEL } from '../constants/reportStatus'
import { SkeletonBlock } from './Skeleton'

const STUB_ICONS = { bees: '🌿', microdatacenter: '🖥️' }
const equipIcon = (id) => EQUIPMENT_MODULES[id]?.icon ?? STUB_ICONS[id] ?? '📄'

// selectable/selectedIds/onToggleSelect/onToggleSelectAll are all optional --
// omit them and this renders exactly as before (Dashboard, ReportsList,
// ClienteDetail). LiberarEspacio opts into selection mode instead of
// row-click-to-navigate, since picking reports is the point there.
export default function ReportsTable({ reports, isAdmin, selectable, selectedIds, onToggleSelect, onToggleSelectAll }) {
  const navigate = useNavigate()
  const allSelected = selectable && reports.length > 0 && reports.every(r => selectedIds?.has(r.id))

  return (
    <div className="table-wrapper">
      <table className="data-table">
        <thead>
          <tr>
            {selectable && (
              <th style={{ width: 32 }}>
                <input type="checkbox" checked={allSelected} onChange={onToggleSelectAll} title="Seleccionar todos" />
              </th>
            )}
            <th>N° Reporte</th>
            <th>Cliente</th>
            <th>Proyecto</th>
            {isAdmin && <th>Técnico</th>}
            <th>Equipo</th>
            <th>Tipo</th>
            <th>Estado</th>
            <th>Fecha</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {reports.map(r => (
            <tr key={r.id} style={{ cursor:'pointer' }}
              onClick={() => selectable ? onToggleSelect(r.id) : navigate(`/reporte/${r.id}`)}>
              {selectable && (
                <td onClick={e => e.stopPropagation()}>
                  <input type="checkbox" checked={selectedIds?.has(r.id) ?? false} onChange={() => onToggleSelect(r.id)} />
                </td>
              )}
              <td><strong style={{ color:'var(--clr-primary)' }}>#{String(r.report_number).padStart(4,'0')}</strong></td>
              <td>{r.client_name || '—'}</td>
              <td>{r.project_name || '-'}</td>
              {isAdmin && <td>{r.technician_name || '—'}</td>}
              <td>
                <span className="equip-chip">
                  {equipIcon(r.equipment_type)} {r.equipment_type?.toUpperCase()}
                </span>
              </td>
              <td>
                <span className={`badge badge-${r.service_type}`}>{r.service_type}</span>
              </td>
              <td>
                <span className={`badge ${BADGE_CLASS[r.status] || 'badge-draft'}`}>{STATUS_LABEL[r.status] || r.status}</span>
              </td>
              <td style={{ color:'var(--clr-text-light)' }}>{formatDate(r.created_at)}</td>
              <td>{!selectable && <ChevronRight size={16} color="var(--clr-text-light)" />}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ReportsTableSkeleton({ rows = 5, isAdmin }) {
  return (
    <div className="table-wrapper">
      <table className="data-table">
        <thead>
          <tr>
            <th>N° Reporte</th>
            <th>Cliente</th>
            <th>Proyecto</th>
            {isAdmin && <th>Técnico</th>}
            <th>Equipo</th>
            <th>Tipo</th>
            <th>Estado</th>
            <th>Fecha</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={i}>
              <td><SkeletonBlock width={60} height={14} /></td>
              <td><SkeletonBlock width={120} height={14} /></td>
              <td><SkeletonBlock width={100} height={14} /></td>
              {isAdmin && <td><SkeletonBlock width={100} height={14} /></td>}
              <td><SkeletonBlock width={80} height={22} style={{ borderRadius:'var(--radius-full)' }} /></td>
              <td><SkeletonBlock width={70} height={22} style={{ borderRadius:'var(--radius-full)' }} /></td>
              <td><SkeletonBlock width={70} height={22} style={{ borderRadius:'var(--radius-full)' }} /></td>
              <td><SkeletonBlock width={80} height={14} /></td>
              <td><SkeletonBlock width={16} height={16} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
