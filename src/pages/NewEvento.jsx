import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, CalendarDays, Loader, Plus, Trash2 } from 'lucide-react'
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

// Generador de IDs compatible con HTTP y HTTPS
const genId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
const emptyTech = () => ({ id: genId(), technician_id: '', technician_name: '' })

export default function NewEvento() {
  const navigate = useNavigate()
  const goBack = useBackNavigate()
  const { id: eventId } = useParams()
  const isEditMode = Boolean(eventId)
  const [searchParams] = useSearchParams()
  const { user, isAdmin } = useAuth()
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
  // Técnicos: an add/remove list, all equal (no "primary" técnico) -- same
  // shape as Nuevo Reporte's own Técnicos section (event_technicians, 059).
  // A técnico creating a new event defaults to listing themself, same
  // starting point the old single-técnico dropdown had.
  const [technicians, setTechnicians] = useState([
    isAdmin ? emptyTech() : { id: genId(), technician_id: user?.id ?? '', technician_name: '' },
  ])
  const [clientUserId, setClientUserId] = useState('')
  const [clientName, setClientName] = useState('')
  const [clientAddress, setClientAddress] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState('pendiente')
  // The técnico ids this event had when the edit screen opened -- compared
  // against the current list on save so notifyEventTechnician only emails
  // whoever's newly added, never someone already notified on a past save.
  const [originalTechnicianIds, setOriginalTechnicianIds] = useState(new Set())
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
        const loadedTechs = ev.technicians?.length
          ? ev.technicians.map(t => ({ id: genId(), technician_id: t.technician_id || '', technician_name: t.technician_name || '' }))
          : [emptyTech()]
        setTechnicians(loadedTechs)
        setOriginalTechnicianIds(new Set(loadedTechs.map(t => t.technician_id).filter(Boolean)))
        setClientUserId(ev.client_user_id || '')
        setClientName(ev.client_name || '')
        setClientAddress(ev.client_address || '')
        setClientPhone(ev.client_phone || '')
        setClientEmail(ev.client_email || '')
        setNotes(ev.notes || '')
        setStatus(ev.status)
      })
      .catch(err => { logError('NewEvento.loadEvent', err); setLoadError(err) })
      .finally(() => setLoadingEvent(false))
  }

  useEffect(() => {
    if (isEditMode) loadEventForEdit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditMode, eventId])

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

  // ── Técnicos table handlers (mirrors NewReport.jsx's own) ──
  function selectTech(id, technicianId) {
    const opt = staffOptions.find(o => o.id === technicianId)
    setTechnicians(prev => prev.map(t => t.id === id
      ? { ...t, technician_id: technicianId, technician_name: opt?.full_name ?? '' }
      : t))
  }
  // Admin can list anyone (técnico or admin, self included) in every row. A
  // técnico can only ever name themself as the first técnico -- they can't
  // schedule someone else's work -- and only gets the full técnico list to
  // add a colleague once that first row exists, for visits 2+ people work.
  function rowTechOptions(index) {
    if (isAdmin) return staffOptions
    if (index === 0) return staffOptions.filter(o => o.id === user?.id)
    return staffOptions
  }
  function addTech() { setTechnicians(prev => [...prev, emptyTech()]) }
  function removeTech(id) { setTechnicians(prev => prev.filter(t => t.id !== id)) }

  // Required fields are tiered by status: Pendiente only needs the basics
  // below; al menos un técnico is only required once the event has
  // actually moved to en_progreso (or beyond -- completado/cancelado both
  // imply the visit got at least that far). Creating an event always saves
  // as Pendiente, so this second tier only ever applies in edit mode.
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
    const hasTechnician = technicians.some(t => !isBlank(t.technician_name))
    if (status !== 'pendiente' && !hasTechnician) { setFormError('Agrega al menos un técnico.'); return }

    const payload = {
      // service_type/equipment_type are validated non-blank above, but kept
      // as `|| null` since both columns have a "null or one of these" CHECK.
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
      technicians: technicians.filter(t => t.technician_name.trim()),
      notes: notes.trim(),
      status,
    }

    setSaving(true)
    setFormError('')
    try {
      const saved = isEditMode ? await updateEvent(eventId, payload) : await createEvent(payload, user.id)
      showToast(isEditMode ? 'Evento actualizado' : 'Evento creado', 'success')

      // Email only whoever's newly added to the roster -- never someone
      // already on it before this save. Fire-and-forget: a notification
      // hiccup shouldn't block navigation away from an otherwise
      // successful save, just surface it if it fails.
      const newTechnicianIds = [...new Set(
        payload.technicians.map(t => t.technician_id).filter(id => id && !originalTechnicianIds.has(id))
      )]
      if (newTechnicianIds.length > 0) {
        notifyEventTechnician(saved.id, newTechnicianIds).then(result => {
          if (!result.success) showToast('Evento guardado, pero no se pudo notificar a los técnicos: ' + result.message)
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
          <div className="section-header">
            <p className="section-tag" style={{ margin: 0 }}>Técnicos {status !== 'pendiente' && <span style={{ color: 'var(--clr-danger)' }}>*</span>}</p>
            <button type="button" className="btn btn-secondary btn-sm" onClick={addTech} style={{ marginLeft: 'auto' }}>
              <Plus size={14} /> Agregar técnico
            </button>
          </div>
          <div className="parts-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Nombre del técnico</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {technicians.map((t, i) => {
                  const rowOptions = rowTechOptions(i)
                  const idIsVisible = t.technician_id && rowOptions.some(o => o.id === t.technician_id)
                  return (
                    <tr key={t.id}>
                      <td style={{ width: 32, color: 'var(--clr-text-light)' }}>{i + 1}</td>
                      <td>
                        <select className="form-control form-control-select"
                          value={idIsVisible ? t.technician_id : (t.technician_name ? 'legacy' : '')}
                          onChange={e => selectTech(t.id, e.target.value)}>
                          <option value="">Seleccionar técnico</option>
                          {t.technician_name && !idIsVisible &&
                            <option value="legacy">{t.technician_name}</option>}
                          {rowOptions.map(o => <option key={o.id} value={o.id}>{o.full_name}{o.role === 'admin' ? ' (Admin)' : ''}</option>)}
                        </select>
                      </td>
                      <td>
                        {technicians.length > 1 &&
                          <button type="button" className="icon-btn" onClick={() => removeTech(t.id)} style={{ borderColor: 'transparent', color: 'var(--clr-danger)' }}>
                            <Trash2 size={14} />
                          </button>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
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
