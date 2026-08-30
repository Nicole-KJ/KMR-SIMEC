import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, CalendarDays, Loader } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { getEvent, createEvent, updateEvent, getAllReportClients, getTechnicians, getStaffDirectory, getNextEventCode } from '../services/supabaseDB'
import { notifyEventTechnician } from '../services/emailService'
import { isBlank, todayISODate } from '../utils/validation'
import { logError } from '../utils/logger'
import { SERVICE_TYPES } from '../constants/serviceTypes'
import { MODULES } from '../constants/equipmentModules'
import { EVENT_STATUSES } from '../constants/eventStatus'
import { useBackNavigate } from '../hooks/useBackNavigate'

export default function NewEvento() {
  const navigate = useNavigate()
  const goBack = useBackNavigate()
  const { id: eventId } = useParams()
  const isEditMode = Boolean(eventId)
  const [searchParams] = useSearchParams()
  const { user, profile, isAdmin } = useAuth()
  const { showToast } = useToast()

  const [clientOptions, setClientOptions] = useState([])
  // Tracks which <option> is picked (array index -- clientOptions entries
  // don't all have a usable unique id: unlinked clients have no
  // client_user_id at all, so several of them would collide on `null`).
  // Separate from clientUserId, which is what actually gets saved.
  const [selectedClientKey, setSelectedClientKey] = useState('')
  const [staffOptions, setStaffOptions] = useState([])
  const [loadingEvent, setLoadingEvent] = useState(isEditMode)
  const [loadError, setLoadError] = useState(null)

  const [serviceType, setServiceType] = useState('')
  const [equipmentType, setEquipmentType] = useState('')
  const [eventCode, setEventCode] = useState('')
  const [eventName, setEventName] = useState('')
  const [eventDate, setEventDate] = useState(searchParams.get('fecha') || todayISODate())
  const [eventTime, setEventTime] = useState(searchParams.get('hora') || '')
  const [technicianId, setTechnicianId] = useState(isAdmin ? '' : (user?.id ?? ''))
  const [clientUserId, setClientUserId] = useState('')
  const [clientName, setClientName] = useState('')
  const [clientAddress, setClientAddress] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState('pendiente')
  const [loadedTechnicianName, setLoadedTechnicianName] = useState('')
  // The técnico this event had when the edit screen opened -- compared
  // against the picked technicianId on save so notifyEventTechnician only
  // fires when a técnico is newly assigned or actually changed, not on
  // every unrelated edit to an event that already had the same one.
  const [originalTechnicianId, setOriginalTechnicianId] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    getAllReportClients().then(setClientOptions).catch(err => logError('NewEvento.getAllReportClients', err))
    const fetchStaff = isAdmin ? getStaffDirectory() : getTechnicians()
    fetchStaff.then(setStaffOptions).catch(err => logError('NewEvento.getStaff', err))
  }, [isAdmin])

  // Keeps the dropdown showing the right option selected when editing an
  // event that's already linked to a client, once clientOptions has
  // loaded -- only findable for a linked client (a real client_user_id to
  // match on); an edited unlinked event never had one to match either.
  useEffect(() => {
    if (!clientUserId) return
    const idx = clientOptions.findIndex(o => o.client_user_id === clientUserId)
    if (idx !== -1) setSelectedClientKey(String(idx))
  }, [clientOptions, clientUserId])

  // Código del Evento is auto-generated the moment this view opens to
  // create a new event -- never hand-typed (the field stays disabled
  // below). Edit mode already gets its code from loadEventForEdit instead.
  useEffect(() => {
    if (isEditMode) return
    getNextEventCode().then(setEventCode).catch(err => logError('NewEvento.getNextEventCode', err))
  }, [isEditMode])

  function loadEventForEdit() {
    setLoadingEvent(true)
    setLoadError(null)
    getEvent(eventId)
      .then(ev => {
        setServiceType(ev.service_type || '')
        setEquipmentType(ev.equipment_type || '')
        setEventCode(ev.event_code || '')
        setEventName(ev.event_name || '')
        setEventDate(ev.event_date)
        setEventTime(ev.event_time ? ev.event_time.slice(0, 5) : '')
        setTechnicianId(ev.technician_id || '')
        setOriginalTechnicianId(ev.technician_id || '')
        setClientUserId(ev.client_user_id || '')
        setClientName(ev.client_name || '')
        setClientAddress(ev.client_address || '')
        setClientPhone(ev.client_phone || '')
        setClientEmail(ev.client_email || '')
        setNotes(ev.notes || '')
        setStatus(ev.status)
        setLoadedTechnicianName(ev.technician_name || '')
      })
      .catch(err => { logError('NewEvento.loadEvent', err); setLoadError(err) })
      .finally(() => setLoadingEvent(false))
  }

  useEffect(() => {
    if (isEditMode) loadEventForEdit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditMode, eventId])

  // A técnico can only ever schedule for themself (enforced server-side too,
  // 035) -- same rule as NewReport.jsx's técnico dropdown and Eventos.jsx.
  const technicianPickOptions = isAdmin ? staffOptions : staffOptions.filter(o => o.id === user?.id)

  // technician_name is derived from staffOptions rather than tracked in its
  // own state -- staffOptions loads async, and a técnico's own name never
  // needs an explicit selection to appear once it does. loadedTechnicianName
  // is the last-resort fallback in edit mode, for a técnico who's since lost
  // staff access and no longer shows up in staffOptions.
  const technicianName = staffOptions.find(o => o.id === technicianId)?.full_name
    ?? (technicianId === user?.id ? profile?.full_name : '')
    ?? loadedTechnicianName ?? ''

  // key is clientOptions' array index, not client_user_id -- unlinked
  // clients don't have one (several would collide on null). Picking a
  // client autofills whichever of Nombre/Dirección/Teléfono/Correo they
  // actually have on file, overwriting what's currently typed (a field
  // they have no value for is left as-is rather than cleared). Picking
  // "Cliente no registrado" instead clears every Datos del Cliente field,
  // rather than just leaving whatever was there.
  function selectRegisteredClient(key) {
    setSelectedClientKey(key)
    const picked = key !== '' ? clientOptions[Number(key)] : null
    setClientUserId(picked?.client_user_id || '')
    if (!picked) {
      setClientName(''); setClientAddress(''); setClientPhone(''); setClientEmail('')
      return
    }
    if (picked.full_name) setClientName(picked.full_name)
    if (picked.address) setClientAddress(picked.address)
    if (picked.phone) setClientPhone(picked.phone)
    if (picked.email) setClientEmail(picked.email)
  }

  // Required fields are tiered by status: Pendiente only needs the basics
  // below; técnico is only required once the event has actually moved to
  // en_progreso (or beyond -- completado/cancelado both imply the visit
  // got at least that far). Creating an event always saves as Pendiente,
  // so this second tier only ever applies in edit mode.
  async function handleSave(e) {
    e.preventDefault()
    if (isBlank(serviceType)) { setFormError('Selecciona el tipo de evento.'); return }
    if (isBlank(equipmentType)) { setFormError('Selecciona el tipo de equipo.'); return }
    if (isBlank(eventName)) { setFormError('El nombre del evento es requerido.'); return }
    if (isBlank(eventDate)) { setFormError('La fecha es requerida.'); return }
    if (isBlank(eventTime)) { setFormError('La hora es requerida.'); return }
    if (!/^\d{2}:\d{2}$/.test(eventTime)) { setFormError('La hora no es válida.'); return }
    if (isBlank(clientName)) { setFormError('El nombre del cliente es requerido.'); return }
    if (isBlank(clientAddress)) { setFormError('La dirección es requerida.'); return }
    if (isBlank(clientEmail)) { setFormError('El correo del cliente es requerido.'); return }
    if (status !== 'pendiente' && isBlank(technicianId)) { setFormError('Selecciona un técnico.'); return }

    const payload = {
      // service_type/equipment_type are validated non-blank above, but kept
      // as `|| null` since both columns have a "null or one of these" CHECK
      // and technician_id (a uuid column, still optional while pendiente)
      // needs the same real-null treatment.
      service_type: serviceType || null,
      equipment_type: equipmentType || null,
      event_code: eventCode.trim(),
      event_name: eventName.trim(),
      event_date: eventDate,
      event_time: eventTime || null,
      client_user_id: clientUserId || null,
      client_name: clientName.trim(),
      client_address: clientAddress.trim(),
      client_phone: clientPhone.trim(),
      client_email: clientEmail.trim(),
      technician_id: technicianId || null,
      technician_name: technicianId ? technicianName : '',
      notes: notes.trim(),
      status,
    }

    setSaving(true)
    setFormError('')
    try {
      const saved = isEditMode ? await updateEvent(eventId, payload) : await createEvent(payload, user.id)
      showToast(isEditMode ? 'Evento actualizado' : 'Evento creado', 'success')

      // Email the técnico only when one is newly assigned or actually
      // reassigned -- never on creation without one (still 'pendiente'),
      // and never again on an edit that leaves the same técnico in place.
      // Fire-and-forget: a notification hiccup shouldn't block navigation
      // away from an otherwise successful save, just surface it if it fails.
      if (technicianId && (!isEditMode || technicianId !== originalTechnicianId)) {
        notifyEventTechnician(saved.id).then(result => {
          if (!result.success) showToast('Evento guardado, pero no se pudo notificar al técnico: ' + result.message)
        })
      }

      navigate(`/eventos/${saved.id}`)
    } catch (err) {
      logError('NewEvento.handleSave', err)
      setFormError(err.message ?? 'No se pudo guardar el evento')
    } finally {
      setSaving(false)
    }
  }

  if (loadingEvent) return (
    <div className="content-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
      <Loader size={32} className="spin" color="var(--clr-primary)" />
    </div>
  )

  if (loadError) return (
    <div className="content-wrapper fade-in">
      <div className="card">
        <div className="empty-state">
          <div className="empty-icon">⚠️</div>
          <p>No se pudo cargar el evento</p>
          <span>Verifica tu conexión e intenta de nuevo</span>
          <br /><br />
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={loadEventForEdit}>Reintentar</button>
            <button className="btn btn-secondary" onClick={() => navigate('/eventos')}>Volver a Eventos</button>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="content-wrapper fade-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <button className="icon-btn" onClick={goBack}><ArrowLeft size={18} /></button>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>
            <CalendarDays size={20} style={{ verticalAlign: 'middle', marginRight: 8 }} />{isEditMode ? 'Editar Evento' : 'Nuevo Evento'}
          </h1>
          <p style={{ color: 'var(--clr-text-light)', fontSize: 13 }}>Programa una visita de servicio</p>
        </div>
      </div>

      {formError && (
        <div className="card fade-in" style={{ marginBottom: 20, background: 'var(--clr-danger-bg)', border: '1.5px solid var(--clr-danger)' }}>
          <p style={{ margin: 0, color: 'var(--clr-danger)', fontSize: 14, fontWeight: 500 }}>{formError}</p>
        </div>
      )}

      <form onSubmit={handleSave}>
        <div className="card" style={{ marginBottom: 20 }}>
          <p className="section-tag">Tipo de Evento <span>*</span></p>
          <div className="service-type-grid">
            {SERVICE_TYPES.map(s => (
              <button key={s.id} type="button"
                className={`service-type-btn ${serviceType === s.id ? `selected-${s.id}` : ''}`}
                onClick={() => setServiceType(s.id)}>
                <div className="st-icon">{s.icon}</div>
                <div className="st-label" style={{ color: serviceType === s.id ? s.color : 'inherit' }}>{s.label}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="card" style={{ marginBottom: 20 }}>
          <p className="section-tag">Tipo de Equipo <span>*</span></p>
          <div className="module-grid">
            {MODULES.map(m => (
              <div key={m.id}
                className={`module-card ${equipmentType === m.id ? 'selected' : ''}`}
                onClick={() => setEquipmentType(m.id)}>
                <div className="module-icon">{m.icon}</div>
                <div className="module-name">{m.name}</div>
                <div className="module-desc">{m.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ marginBottom: 20 }}>
          <p className="section-tag">Encabezado</p>
          <div className="form-row form-row-2">
            <div className="form-group">
              <label className="form-label">Código del Evento</label>
              <input className="form-control" value={eventCode} disabled placeholder="Generando..." />
            </div>
            <div className="form-group">
              <label className="form-label">Nombre del evento <span>*</span></label>
              <input className="form-control" value={eventName} onChange={e => setEventName(e.target.value)} placeholder="Nombre del evento" />
            </div>
          </div>
          <div className="form-row form-row-2">
            <div className="form-group">
              <label className="form-label">Fecha del Evento <span>*</span></label>
              <input className="form-control" type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Hora del Evento <span>*</span></label>
              <input className="form-control" type="time" value={eventTime} onChange={e => setEventTime(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 20 }}>
          <p className="section-tag">Datos del Cliente</p>
          <div className="form-row form-row-2">
            <div className="form-group">
              <label className="form-label">Nombre del cliente <span>*</span></label>
              <input className="form-control" value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Nombre o empresa" />
            </div>
            <div className="form-group">
              <label className="form-label">Dirección <span>*</span></label>
              <input className="form-control" value={clientAddress} onChange={e => setClientAddress(e.target.value)} placeholder="Dirección de la visita" />
            </div>
          </div>
          <div className="form-row form-row-2">
            <div className="form-group">
              <label className="form-label">Teléfono del cliente</label>
              <input className="form-control" type="tel" value={clientPhone} onChange={e => setClientPhone(e.target.value)} placeholder="8888-8888" />
            </div>
            <div className="form-group">
              <label className="form-label">Correo del cliente <span>*</span></label>
              <input className="form-control" type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="cliente@empresa.com" />
            </div>
          </div>
          <div className="form-group" style={{ marginTop: 4 }}>
            <label className="form-label">Cliente registrado (opcional)</label>
            <select className="form-control form-control-select" value={selectedClientKey} onChange={e => selectRegisteredClient(e.target.value)}>
              <option value="">Cliente no registrado</option>
              {clientOptions.map((o, i) => <option key={i} value={i}>{o.full_name}</option>)}
            </select>
            <p style={{ fontSize: 12, color: 'var(--clr-text-light)', marginTop: 4 }}>
              Vincula este evento a una cuenta de cliente para que pueda verlo al iniciar sesión.
            </p>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 20 }}>
          <p className="section-tag">Técnico</p>
          <div className="form-group">
            <label className="form-label">Técnico asignado {status !== 'pendiente' && <span>*</span>}</label>
            <select className="form-control form-control-select" value={technicianId} onChange={e => setTechnicianId(e.target.value)}>
              <option value="">Seleccionar técnico</option>
              {technicianId && !technicianPickOptions.some(o => o.id === technicianId) &&
                <option value={technicianId}>{technicianName}</option>}
              {technicianPickOptions.map(o => (
                <option key={o.id} value={o.id}>{o.full_name}{o.role === 'admin' ? ' (Admin)' : ''}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 20 }}>
          <p className="section-tag">Notas</p>
          <div className="form-group">
            <textarea className="form-control" rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Detalles adicionales de la visita..." />
          </div>
        </div>

        {isEditMode && (
          <div className="card" style={{ marginBottom: 20 }}>
            <p className="section-tag">Estado</p>
            <div className="form-group">
              <label className="form-label">Estado del evento <span>*</span></label>
              <select className="form-control form-control-select" value={status} onChange={e => setStatus(e.target.value)}>
                {EVENT_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          {isEditMode && (
            <button type="button" className="btn btn-secondary" onClick={() => navigate(`/eventos/${eventId}`)} disabled={saving}>
              Cancelar
            </button>
          )}
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? <><Loader size={14} className="spin" /> Guardando...</> : (isEditMode ? 'Guardar Cambios' : 'Crear Evento')}
          </button>
        </div>
      </form>
    </div>
  )
}
