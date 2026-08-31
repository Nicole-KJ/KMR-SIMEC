import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { formatDate } from '../services/supabaseDB'
import { EQUIPMENT_MODULES } from '../constants/equipmentModules'
import { STATUS_LABELS } from '../constants/eventStatus'
import { SkeletonBlock } from './Skeleton'

const STUB_ICONS = { bees: '🌿', microdatacenter: '🖥️' }
const equipIcon = (id) => EQUIPMENT_MODULES[id]?.icon ?? STUB_ICONS[id] ?? '📄'

export default function EventsTable({ events }) {
  const navigate = useNavigate()

  return (
    <div className="table-wrapper">
      <table className="data-table">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Hora</th>
            <th>Cliente</th>
            <th>Técnico(s)</th>
            <th>Equipo</th>
            <th>Tipo</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {events.map(ev => (
            <tr key={ev.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/eventos/${ev.id}`)}>
              <td>{formatDate(ev.event_date)}</td>
              <td style={{ color: 'var(--clr-text-light)' }}>{ev.event_time ? ev.event_time.slice(0, 5) : '—'}</td>
              <td>{ev.client_name || '—'}</td>
              <td>{(ev.technicians ?? []).map(t => t.technician_name).filter(Boolean).join(', ') || '—'}</td>
              <td>
                {ev.equipment_type ? (
                  <span className="equip-chip">
                    {equipIcon(ev.equipment_type)} {ev.equipment_type.toUpperCase()}
                  </span>
                ) : '—'}
              </td>
              <td>
                {ev.service_type ? <span className={`badge badge-${ev.service_type}`}>{ev.service_type}</span> : '—'}
              </td>
              <td>
                <span className={`badge badge-${ev.status}`}>{STATUS_LABELS[ev.status] || ev.status}</span>
              </td>
              <td><ChevronRight size={16} color="var(--clr-text-light)" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function EventsTableSkeleton({ rows = 5 }) {
  return (
    <div className="table-wrapper">
      <table className="data-table">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Hora</th>
            <th>Cliente</th>
            <th>Técnico(s)</th>
            <th>Equipo</th>
            <th>Tipo</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={i}>
              <td><SkeletonBlock width={80} height={14} /></td>
              <td><SkeletonBlock width={50} height={14} /></td>
              <td><SkeletonBlock width={120} height={14} /></td>
              <td><SkeletonBlock width={100} height={14} /></td>
              <td><SkeletonBlock width={80} height={22} style={{ borderRadius: 'var(--radius-full)' }} /></td>
              <td><SkeletonBlock width={70} height={22} style={{ borderRadius: 'var(--radius-full)' }} /></td>
              <td><SkeletonBlock width={70} height={22} style={{ borderRadius: 'var(--radius-full)' }} /></td>
              <td><SkeletonBlock width={16} height={16} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
