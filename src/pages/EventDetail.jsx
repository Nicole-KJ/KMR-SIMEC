import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarDays, ChevronRight, FilePlus, Loader, Pencil, Trash2 } from 'lucide-react'
import { getEvent, updateEvent, deleteEvent, getReportsForEvent, formatDate } from '../services/supabaseDB'
import { useToast } from '../contexts/ToastContext'
import { logError } from '../utils/logger'
import { SERVICE_TYPES } from '../constants/serviceTypes'
import { MODULES, EQUIPMENT_MODULES } from '../constants/equipmentModules'
import { EVENT_STATUSES, STATUS_LABELS } from '../constants/eventStatus'
import { BADGE_CLASS, STATUS_LABEL as REPORT_STATUS_LABEL } from '../constants/reportStatus'
import { useBackNavigate } from '../hooks/useBackNavigate'

export default function EventDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const goBack = useBackNavigate()
  const { showToast } = useToast()

  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [linkedReports, setLinkedReports] = useState([])
  const [loadingReports, setLoadingReports] = useState(true)

  function loadEvent() {
    setLoading(true)
    setLoadError(null)
    getEvent(id)
      .then(setEvent)
      .catch(err => { logError('EventDetail.loadEvent', err); setLoadError(err) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadEvent() }, [id])

  // A separate query/loading state from the event itself -- an event can
  // have 1+ reports linked (e.g. a separate report per piece of equipment
  // serviced in the same visit), never blocking on it shouldn't hold up
  // showing the event's own details above.
  useEffect(() => {
    setLoadingReports(true)
    getReportsForEvent(id)
      .then(setLinkedReports)
      .catch(err => logError('EventDetail.getReportsForEvent', err))
      .finally(() => setLoadingReports(false))
  }, [id])

  async function handleStatusChange(newStatus) {
    setUpdatingStatus(true)
    try {
      const updated = await updateEvent(id, { status: newStatus })
      setEvent(updated)
      showToast('Estado actualizado', 'success')
    } catch (err) {
      logError('EventDetail.handleStatusChange', err)
      showToast('Error al actualizar el estado: ' + (err.message ?? err))
    } finally {
      setUpdatingStatus(false)
    }
  }

  async function handleDelete() {
    if (!window.confirm(`¿Eliminar el evento "${event.event_name || event.event_code || 'sin nombre'}"? Esta acción no se puede deshacer.`)) return
    setDeleting(true)
    try {
      await deleteEvent(id)
      navigate('/eventos')
    } catch (err) {
      logError('EventDetail.handleDelete', err)
      showToast('Error al eliminar el evento: ' + (err.message ?? err))
      setDeleting(false)
    }
  }

  if (loading) return (
    <div className="content-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
      <Loader size={32} className="spin" color="var(--clr-primary)" />
    </div>
  )

  if (loadError || !event) return (
    <div className="content-wrapper fade-in">
      <div className="card">
        <div className="empty-state">
          <div className="empty-icon">⚠️</div>
          <p>No se pudo cargar el evento</p>
          <span>Verifica tu conexión e intenta de nuevo</span>
          <br /><br />
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={loadEvent}>Reintentar</button>
            <button className="btn btn-secondary" onClick={() => navigate('/eventos')}>Volver a Eventos</button>
          </div>
        </div>
      </div>
    </div>
  )

  const serviceTypeInfo = SERVICE_TYPES.find(s => s.id === event.service_type)
  const equipmentInfo = MODULES.find(m => m.id === event.equipment_type)

  return (
    <div className="content-wrapper fade-in">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <button className="icon-btn" onClick={goBack}><ArrowLeft size={18} /></button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>
            <CalendarDays size={20} style={{ verticalAlign: 'middle', marginRight: 8 }} />
            {event.event_name || 'Evento'}{event.event_code ? ` (${event.event_code})` : ''}
          </h1>
          <p style={{ color: 'var(--clr-text-light)', fontSize: 13 }}>
            {formatDate(event.event_date)}{event.event_time ? ` · ${event.event_time.slice(0, 5)}` : ''}
          </p>
        </div>
        <span className={`badge badge-${event.status}`} style={{ fontSize: 13, padding: '6px 14px' }}>
          {STATUS_LABELS[event.status] || event.status}
        </span>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
        <select className="form-control form-control-select" style={{ width: 'auto' }}
          value={event.status} disabled={updatingStatus} onChange={e => handleStatusChange(e.target.value)}>
          {EVENT_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <button className="btn btn-secondary" onClick={() => navigate(`/eventos/${id}/editar`)}>
          <Pencil size={16} /> Editar
        </button>
        <button className="btn btn-secondary" style={{ color: 'var(--clr-danger)', borderColor: 'var(--clr-danger)' }}
          onClick={handleDelete} disabled={deleting}>
          {deleting ? <Loader size={16} className="spin" /> : <Trash2 size={16} />} Eliminar
        </button>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <p className="section-tag">Tipo de Evento</p>
        {serviceTypeInfo ? (
          <span className={`badge badge-${serviceTypeInfo.id}`} style={{ fontSize: 13, padding: '6px 14px' }}>
            {serviceTypeInfo.icon} {serviceTypeInfo.label}
          </span>
        ) : <p style={{ color: 'var(--clr-text-light)' }}>Sin definir</p>}
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <p className="section-tag">Tipo de Equipo</p>
        {equipmentInfo ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22 }}>{equipmentInfo.icon}</span>
            <div>
              <div style={{ fontWeight: 700 }}>{equipmentInfo.name}</div>
              <div style={{ fontSize: 12, color: 'var(--clr-text-light)' }}>{equipmentInfo.desc}</div>
            </div>
          </div>
        ) : <p style={{ color: 'var(--clr-text-light)' }}>Sin definir</p>}
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <p className="section-tag">Encabezado</p>
        <div className="responsive-grid-2" style={{ display: 'grid', gap: 16 }}>
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--clr-text-light)', textTransform: 'uppercase' }}>Código del Evento</p>
            <p style={{ fontSize: 14 }}>{event.event_code || '—'}</p>
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--clr-text-light)', textTransform: 'uppercase' }}>Nombre del evento</p>
            <p style={{ fontSize: 14 }}>{event.event_name || '—'}</p>
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--clr-text-light)', textTransform: 'uppercase' }}>Fecha del Evento</p>
            <p style={{ fontSize: 14 }}>{formatDate(event.event_date)}</p>
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--clr-text-light)', textTransform: 'uppercase' }}>Hora del Evento</p>
            <p style={{ fontSize: 14 }}>{event.event_time ? event.event_time.slice(0, 5) : '—'}</p>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <p className="section-tag">Datos del Cliente</p>
        <div className="responsive-grid-2" style={{ display: 'grid', gap: 16 }}>
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--clr-text-light)', textTransform: 'uppercase' }}>Nombre del cliente</p>
            <p style={{ fontSize: 14 }}>{event.client_name || '—'}</p>
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--clr-text-light)', textTransform: 'uppercase' }}>Dirección</p>
            <p style={{ fontSize: 14 }}>{event.client_address || '—'}</p>
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--clr-text-light)', textTransform: 'uppercase' }}>Teléfono del cliente</p>
            <p style={{ fontSize: 14 }}>{event.client_phone || '—'}</p>
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--clr-text-light)', textTransform: 'uppercase' }}>Correo del cliente</p>
            <p style={{ fontSize: 14 }}>{event.client_email || '—'}</p>
          </div>
        </div>
        {event.client_user_id && (
          <p style={{ fontSize: 12, color: 'var(--clr-text-light)', marginTop: 12 }}>
            Vinculado a una cuenta de cliente del portal.
          </p>
        )}
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <p className="section-tag">Técnicos</p>
        {event.technicians?.length ? (
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {event.technicians.map(t => <li key={t.id} style={{ fontSize: 14 }}>{t.technician_name}</li>)}
          </ul>
        ) : <p style={{ fontSize: 14, color: 'var(--clr-text-light)' }}>—</p>}
      </div>

      {event.notes && (
        <div className="card" style={{ marginBottom: 20 }}>
          <p className="section-tag">Notas</p>
          <p style={{ fontSize: 14, whiteSpace: 'pre-wrap' }}>{event.notes}</p>
        </div>
      )}

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="section-header">
          <p className="section-tag" style={{ margin: 0 }}>Reportes Vinculados</p>
          <button className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto' }}
            onClick={() => navigate(`/nuevo-reporte?event_id=${id}`)}>
            <FilePlus size={13} /> Nuevo Reporte
          </button>
        </div>
        {loadingReports ? (
          <div style={{ textAlign: 'center', padding: 16 }}>
            <Loader size={20} className="spin" color="var(--clr-primary)" />
          </div>
        ) : linkedReports.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--clr-text-light)' }}>Ningún reporte vinculado todavía.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {linkedReports.map(r => (
              <div key={r.id} onClick={() => navigate(`/reporte/${r.id}`)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                  padding: '8px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--clr-border)',
                }}>
                <span className="equip-chip">{EQUIPMENT_MODULES[r.equipment_type]?.icon ?? '📄'} {r.equipment_type?.toUpperCase()}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 700 }}>#{String(r.report_number).padStart(4, '0')} · {r.client_name || '—'}</p>
                </div>
                <span className={`badge ${BADGE_CLASS[r.status] || 'badge-draft'}`}>{REPORT_STATUS_LABEL[r.status] || r.status}</span>
                <ChevronRight size={16} color="var(--clr-text-light)" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
