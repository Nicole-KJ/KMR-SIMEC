import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, Camera, X, Loader } from 'lucide-react'
import {
  createReport, updateReport, getReport, getPhotoUrl, getTechnicians, getStaffDirectory, getAllReportClients, getEvents,
  uploadEquipmentFile, patchReportEquipmentData,
} from '../services/supabaseDB'
import { useAuth } from '../contexts/AuthContext'
import { MODULES, EQUIPMENT_MODULES, getDefaultEquipmentData, extractPendingFile } from '../constants/equipmentModules'
import GenericModuleForm from '../components/EquipmentGeneric/GenericModuleForm'
import { validateReport, todayISODate } from '../utils/validation'
import { useToast } from '../contexts/ToastContext'
import { logError } from '../utils/logger'
import { SERVICE_TYPES, VARIOS_SERVICE_TYPE } from '../constants/serviceTypes'
import { STATUS_LABELS as EVENT_STATUS_LABELS } from '../constants/eventStatus'
import { useBackNavigate } from '../hooks/useBackNavigate'

// Generador de IDs compatible con HTTP y HTTPS
const genId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

// Postgres `time` columns come back as "HH:MM:SS"; <input type="time"> wants "HH:MM"
const toTimeInput = (value) => value ? value.slice(0, 5) : ''

const emptyPart = () => ({ id: genId(), quantity: '', description: '', part_code: '' })
const emptyTech = () => ({ id: genId(), technician_id: '', technician_name: '', fault_time: '', arrival_pdv: '', departure_pdv: '', arrival_plant: '' })

// Leads with Código/Nombre del Evento -- what a técnico actually
// recognizes an event by -- then the date/client/status as context, same
// info the old date-first label had.
function eventOptionLabel(ev) {
  const time = ev.event_time ? ` ${ev.event_time.slice(0, 5)}` : ''
  const code = ev.event_code ? `${ev.event_code} — ` : ''
  return `${code}${ev.event_name || 'Sin nombre'} (${ev.event_date}${time} · ${ev.client_name || 'Sin cliente'} · ${EVENT_STATUS_LABELS[ev.status] || ev.status})`
}

export default function NewReport() {
  const navigate = useNavigate()
  const goBack = useBackNavigate()
  const { id: reportId } = useParams()
  const [searchParams] = useSearchParams()
  const isEditMode = Boolean(reportId)
  const { user, profile, isAdmin } = useAuth()
  const { showToast } = useToast()

  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(null)
  const [validationErrors, setValidationErrors] = useState([])
  const [loadingReport, setLoadingReport] = useState(isEditMode)
  const [loadError, setLoadError] = useState(null)
  const cancelledRef = useRef(false)
  // reportDate always has a real value (defaults to today, never blank),
  // so unlike serviceType/clientName/etc. below it can't use "still empty"
  // as its own one-shot guard -- this ref stands in for that.
  const prefilledDateRef = useRef(false)
  const [reportNumber, setReportNumber] = useState(null)
  const [existingPhotos, setExistingPhotos] = useState([])
  // The status this report actually had when the edit screen opened --
  // "Guardar Cambios" saves without changing status, so it needs the
  // original value rather than always forcing 'completed' (that's what
  // "Completar Reporte"/first-time completion is for).
  const [originalStatus, setOriginalStatus] = useState('draft')

  const [selectedModule, setSelectedModule] = useState('')
  const [serviceType, setServiceType] = useState('')

  const [scCode, setScCode] = useState('')
  const [projectName, setProjectName] = useState('')
  const [reportDate, setReportDate] = useState(todayISODate())
  const [eventId, setEventId] = useState(searchParams.get('event_id') || '')
  // Fallback event object for when the linked event isn't in eventOptions --
  // e.g. an admin editing a técnico's report where the event's own técnico
  // was since reassigned. Same "not in the list but still show it" pattern
  // as technicianName elsewhere in this file. Kept as the full object, not
  // just a label string, so the Evento/Nombre del Evento fields below can
  // read event_code/event_name off it too.
  const [loadedEvent, setLoadedEvent] = useState(null)

  const [clientName, setClientName] = useState('')
  const [clientAddress, setClientAddress] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [clientEmailSecondary, setClientEmailSecondary] = useState('')
  const [clientUserId, setClientUserId] = useState('')

  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [serial, setSerial] = useState('')
  const [asset, setAsset] = useState('')
  const [location, setLocation] = useState('')

  const [technicians, setTechnicians] = useState([emptyTech()])
  const [parts, setParts] = useState([emptyPart()])

  const [workDescription, setWorkDescription] = useState('')
  const [observations, setObservations] = useState('')
  const [photos, setPhotos] = useState([])

  // Equipment-specific data
  const [equipmentData, setEquipmentData] = useState(null)

  const [technicianOptions, setTechnicianOptions] = useState([])
  const [clientOptions, setClientOptions] = useState([])
  // Tracks which <option> is picked (array index -- clientOptions entries
  // don't all have a usable unique id: unlinked clients have no
  // client_user_id at all, so several of them would collide on `null`).
  // Separate from clientUserId, which is what actually gets saved.
  const [selectedClientKey, setSelectedClientKey] = useState('')
  const [eventOptions, setEventOptions] = useState([])

  // ── Load technician/client directories for their dropdowns ──
  // Admin picks from técnicos + admins (including themself); a técnico only
  // ever sees técnicos (see rowTechOptions below for the per-row narrowing).
  useEffect(() => {
    const fetchStaff = isAdmin ? getStaffDirectory() : getTechnicians()
    fetchStaff.then(setTechnicianOptions).catch(err => logError('NewReport.getTechnicians', err))
    getAllReportClients().then(setClientOptions).catch(err => logError('NewReport.getAllReportClients', err))
    // Same events a técnico would see on Eventos (their own) or admin
    // (every event) -- an event can end up with more than one report
    // linked (e.g. separate reports per piece of equipment serviced in the
    // same visit), so this isn't filtered down to "unlinked" events only.
    getEvents().then(setEventOptions).catch(err => logError('NewReport.getEvents', err))
  }, [isAdmin])

  // Keeps the dropdown showing the right option selected whenever
  // clientUserId gets set out from under it without going through
  // selectRegisteredClient itself -- editing a report that's already
  // linked to a client, or the event-prefill effect below setting it from
  // ev.client_user_id -- once clientOptions has loaded. Only findable for
  // a linked client (a real client_user_id to match on); an unlinked one
  // never had one to match either, same as before this dropdown covered
  // unlinked clients at all.
  useEffect(() => {
    if (!clientUserId) return
    const idx = clientOptions.findIndex(o => o.client_user_id === clientUserId)
    if (idx !== -1) setSelectedClientKey(String(idx))
  }, [clientOptions, clientUserId])

  // Pre-fill Tipo de Equipo, Tipo de Servicio, Fecha, and Datos del Cliente
  // from the event this report is being created from (EventDetail.jsx's
  // own "Nuevo Reporte" button, which links via ?event_id=), once
  // eventOptions has loaded -- saves retyping what the event already has
  // on file. Edit mode already loads all of these from the report's own
  // saved values above, and a user who's already picked/typed one manually
  // shouldn't get overridden by this. service_type falls back to 'varios'
  // rather than the event's own (never 'varios', 050) once the equipment
  // type resolves to Trabajos Varios -- same forced value its step-1
  // module click applies, and the only option Tipo de Servicio's UI shows
  // once isTrabajosVarios is true. event_date is copied as-is even when
  // it's in the future (a report created ahead of a scheduled visit) --
  // Fecha has no future-date restriction at all, so there's nothing to
  // reconcile once the técnico gets to the actual visit.
  useEffect(() => {
    if (isEditMode || !eventId) return
    const ev = eventOptions.find(e => e.id === eventId)
    if (!ev) return
    if (!selectedModule && ev.equipment_type) setSelectedModule(ev.equipment_type)
    if (!serviceType) {
      if (ev.equipment_type === 'trabajos_varios') setServiceType('varios')
      else if (ev.service_type) setServiceType(ev.service_type)
    }
    if (!prefilledDateRef.current && ev.event_date) {
      setReportDate(ev.event_date)
      prefilledDateRef.current = true
    }
    if (!clientName && !clientAddress && !clientPhone && !clientEmail) {
      if (ev.client_name) setClientName(ev.client_name)
      if (ev.client_address) setClientAddress(ev.client_address)
      if (ev.client_phone) setClientPhone(ev.client_phone)
      if (ev.client_email) setClientEmail(ev.client_email)
    }
    // The event's own técnicos (event_technicians, 059 -- an event can have
    // more than one) replace the still-blank, single default Técnicos row --
    // same "don't overwrite something already picked/typed" guard as the
    // client fields above. Each technician_id is looked up against this
    // técnico's own technicianOptions so RLS recognizes them as listed on
    // the report (027) the same way picking from the dropdown would; the
    // event's own saved technician_name is only a fallback for the rare
    // case they're not in that list (e.g. an admin's dropdown scope differs
    // from a técnico's).
    if (ev.technicians?.length && technicians.length === 1 && !technicians[0].technician_name.trim()) {
      setTechnicians(ev.technicians.map(t => {
        const opt = technicianOptions.find(o => o.id === t.technician_id)
        return {
          id: genId(),
          technician_id: t.technician_id || '',
          technician_name: opt?.full_name ?? t.technician_name ?? '',
          fault_time: '', arrival_pdv: '', departure_pdv: '', arrival_plant: '',
        }
      }))
    }
    // Auto-selects "Cliente registrado" to match, whether or not the match
    // is portal-linked -- clientOptions (051) is portal 'cliente' profiles
    // UNION distinct free-text client_name off past reports (client_user_id
    // null on those), and "registrado" here means either: a client already
    // known to the system at all, same as what Clientes.jsx's own "Todos
    // los clientes" table shows regardless of its "Vinculado al portal"
    // column. Prefer the event's own link (client_user_id) when it has
    // one -- setting clientUserId alone is enough, the sync effect above
    // finds its matching option once clientOptions has loaded. Otherwise
    // look the event's client up in clientOptions by email, then by name,
    // same case/whitespace-insensitive comparison 051's own dedup already
    // uses, and select whichever entry matches directly (it may well be
    // the unlinked one, if this client has never had a portal account) --
    // only carry over its client_user_id if that particular entry has one.
    // No match at all (a client truly new to the system) leaves it on
    // "Cliente no registrado", same as it already starts. Kept in its own
    // guard, separate from the text fields above -- eventOptions and
    // clientOptions load independently, so clientOptions can easily still
    // be empty (no match possible yet) on the pass that fills clientName/
    // etc.; nesting this inside that same "still blank" check would mean
    // once those four fields are no longer blank, this never gets a
    // second chance to run once clientOptions actually arrives.
    if (!selectedClientKey) {
      if (ev.client_user_id) {
        setClientUserId(ev.client_user_id)
      } else {
        const norm = s => (s || '').trim().toLowerCase()
        const idx = clientOptions.findIndex(o => (
          (ev.client_email && norm(o.email) === norm(ev.client_email))
          || (ev.client_name && norm(o.full_name) === norm(ev.client_name))
        ))
        if (idx !== -1) {
          setSelectedClientKey(String(idx))
          if (clientOptions[idx].client_user_id) setClientUserId(clientOptions[idx].client_user_id)
        }
      }
    }
  }, [isEditMode, eventId, eventOptions, clientOptions, selectedModule, serviceType, clientName, clientAddress, clientPhone, clientEmail, selectedClientKey, technicians, technicianOptions])

  // ── Load existing report when editing ──
  useEffect(() => {
    if (!reportId) return
    cancelledRef.current = false
    loadForEdit()
    return () => { cancelledRef.current = true }
  }, [reportId])

  function loadForEdit() {
    setLoadingReport(true)
    setLoadError(null)

    getReport(reportId).then(async r => {
      if (cancelledRef.current) return
      if (r.status === 'signed') {
        showToast('No se puede editar un reporte ya firmado')
        navigate(`/reporte/${reportId}`)
        return
      }

      setOriginalStatus(r.status || 'draft')
      setReportNumber(r.report_number)
      setSelectedModule(r.equipment_type)
      setServiceType(r.service_type)
      setScCode(r.sc_code || '')
      setProjectName(r.project_name || '')
      setReportDate(r.report_date || todayISODate())
      setEventId(r.event_id || '')
      setLoadedEvent(r.event || null)
      setClientName(r.client_name || '')
      setClientAddress(r.client_address || '')
      setClientPhone(r.client_phone || '')
      setClientEmail(r.client_email || '')
      setClientEmailSecondary(r.client_email_secondary || '')
      setClientUserId(r.client_user_id || '')
      setBrand(r.brand || '')
      setModel(r.model || '')
      setSerial(r.serial_number || '')
      setAsset(r.asset_number || '')
      setLocation(r.location || '')
      setTechnicians(r.technicians?.length ? r.technicians.map(t => ({
        id: genId(),
        technician_id: t.technician_id || '',
        technician_name: t.technician_name || '',
        fault_time: toTimeInput(t.fault_time),
        arrival_pdv: toTimeInput(t.arrival_pdv),
        departure_pdv: toTimeInput(t.departure_pdv),
        arrival_plant: toTimeInput(t.arrival_plant),
      })) : [emptyTech()])
      setParts(r.parts?.length ? r.parts.map(p => ({
        id: genId(), quantity: p.quantity ?? '', description: p.description || '', part_code: p.part_code || '',
      })) : [emptyPart()])
      setWorkDescription(r.work_description || '')
      setObservations(r.observations || '')
      setEquipmentData(
        r.equipment_data && Object.keys(r.equipment_data).length > 0
          // Merge over the defaults (not a straight replace) so a field added to a
          // module after this report was created — e.g. UPS's network_card — still
          // exists on the object instead of leaving the form to read undefined.
          ? { ...getDefaultEquipmentData(r.equipment_type), ...r.equipment_data }
          : getDefaultEquipmentData(r.equipment_type)
      )
      setStep(2)

      if (r.photos?.length) {
        const withUrls = await Promise.all(
          r.photos.map(async p => ({ ...p, url: await getPhotoUrl(p.storage_path) }))
        )
        if (!cancelledRef.current) setExistingPhotos(withUrls)
      }
      setLoadingReport(false)
    }).catch(err => {
      if (cancelledRef.current) return
      logError('NewReport.loadForEdit', err)
      setLoadError(err)
      setLoadingReport(false)
    })
  }

  // ── Equipment data helpers ──
  function updateEquipment(field, value) {
    setEquipmentData(prev => ({ ...prev, [field]: value }))
  }
  function updateEquipmentNested(section, field, value) {
    setEquipmentData(prev => ({
      ...prev,
      [section]: { ...prev[section], [field]: value }
    }))
  }
  function toggleChecklist(section, field) {
    setEquipmentData(prev => ({
      ...prev,
      [section]: { ...prev[section], [field]: !prev[section][field] }
    }))
  }
  function updateOperatingData(equipKey, phase, value) {
    setEquipmentData(prev => ({
      ...prev,
      operating_data: {
        ...prev.operating_data,
        [equipKey]: { ...prev.operating_data[equipKey], [phase]: value }
      }
    }))
  }

  // ── Tech table handlers ──
  function updateTech(id, field, val) {
    setTechnicians(prev => prev.map(t => t.id === id ? { ...t, [field]: val } : t))
  }
  // Picking from the dropdown sets id + name together -- technician_id is what
  // RLS uses (027) to recognize a listed técnico as allowed to view/edit this
  // report, so it has to come from the actual selected option, not be inferred
  // from the name text alone.
  function selectTech(id, technicianId) {
    const opt = technicianOptions.find(o => o.id === technicianId)
    setTechnicians(prev => prev.map(t => t.id === id
      ? { ...t, technician_id: technicianId, technician_name: opt?.full_name ?? '' }
      : t))
  }
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
      setClientName(''); setClientAddress(''); setClientPhone(''); setClientEmail(''); setClientEmailSecondary('')
      return
    }
    if (picked.full_name) setClientName(picked.full_name)
    if (picked.address) setClientAddress(picked.address)
    if (picked.phone) setClientPhone(picked.phone)
    if (picked.email) setClientEmail(picked.email)
  }
  // Admin can list anyone (técnico or admin, self included) in every row. A
  // técnico can only ever name themself as the first técnico -- they can't
  // credit the report to someone else -- and only gets the full técnico list
  // to add a colleague once that first row exists, for jobs 2+ people worked.
  function rowTechOptions(index) {
    if (isAdmin) return technicianOptions
    if (index === 0) return technicianOptions.filter(o => o.id === user?.id)
    return technicianOptions
  }
  function addTech() { setTechnicians(prev => [...prev, emptyTech()]) }
  function removeTech(id) { setTechnicians(prev => prev.filter(t => t.id !== id)) }

  // ── Parts table handlers ──
  function updatePart(id, field, val) {
    setParts(prev => prev.map(p => p.id === id ? { ...p, [field]: val } : p))
  }
  function addPart() { setParts(prev => [...prev, emptyPart()]) }
  function removePart(id) { setParts(prev => prev.filter(p => p.id !== id)) }

  // ── Photo handlers ──
  function handlePhotoAdd(e, type) {
    const files = Array.from(e.target.files)
    setPhotos(prev => [
      ...prev,
      ...files.map(file => ({ id: genId(), file, previewUrl: URL.createObjectURL(file), name: file.name, type })),
    ])
    e.target.value = ''
  }
  function removePhoto(id) {
    setPhotos(prev => {
      const target = prev.find(p => p.id === id)
      if (target) URL.revokeObjectURL(target.previewUrl)
      return prev.filter(p => p.id !== id)
    })
  }

  // ── Save ──
  async function handleSave(status = 'draft') {
    if (!selectedModule) { showToast('Selecciona el tipo de equipo'); return }
    if (status === 'completed') {
      const errors = validateReport({
        clientName, clientAddress, clientEmail, clientEmailSecondary, serviceType, reportDate, technicians, brand, model, serial,
        workDescription, moduleConfig: EQUIPMENT_MODULES[selectedModule], equipmentData, equipmentType: selectedModule,
      })
      if (errors.length > 0) {
        setValidationErrors(errors)
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }
    }
    setValidationErrors([])
    setSaving(true)
    setUploadProgress(null)
    const onProgress = (p) => setUploadProgress(p)
    try {
      // A pending File (e.g. Batería's Mediciones attachment) can't be written
      // into equipment_data directly — its storage path needs the report id,
      // which for a new report doesn't exist yet. Save without it first, then
      // upload and patch it in once the report id is known either way.
      const pendingFile = extractPendingFile(EQUIPMENT_MODULES[selectedModule], equipmentData)
      const reportData = {
        equipment_type: selectedModule,
        service_type: serviceType,
        sc_code: scCode,
        project_name: projectName,
        report_date: reportDate,
        event_id: eventId || null,
        client_name: clientName,
        client_address: clientAddress,
        client_phone: clientPhone.trim(),
        client_email: clientEmail.trim(),
        client_email_secondary: clientEmailSecondary.trim(),
        client_user_id: clientUserId || null,
        brand, model,
        serial_number: serial,
        asset_number: asset,
        location,
        technicians: technicians.filter(t => t.technician_name.trim()),
        parts: parts.filter(p => p.description.trim()),
        photos: photos.map(p => ({ file: p.file, caption: p.name, type: p.type })),
        work_description: workDescription,
        observations,
        equipment_data: pendingFile ? pendingFile.dataWithoutFile : equipmentData,
        status,
      }
      let finalReportId = reportId
      if (isEditMode) {
        await updateReport(reportId, reportData, onProgress)
      } else {
        const saved = await createReport(reportData, user.id, profile?.full_name || user?.email, onProgress)
        finalReportId = saved.id
      }

      if (pendingFile) {
        const meta = await uploadEquipmentFile(finalReportId, pendingFile.file)
        await patchReportEquipmentData(finalReportId, {
          ...pendingFile.dataWithoutFile,
          [pendingFile.groupKey]: { ...pendingFile.dataWithoutFile[pendingFile.groupKey], attached_file: meta },
        })
      }
      navigate(`/reporte/${finalReportId}`)
    } catch (err) {
      logError('NewReport.handleSave', err)
      showToast('Error guardando el reporte: ' + (err.message ?? err))
    } finally {
      setSaving(false)
      setUploadProgress(null)
    }
  }

  // Helper: proceed to step 2
  function goToStep2() {
    if (!equipmentData) {
      setEquipmentData(getDefaultEquipmentData(selectedModule))
    }
    setStep(2)
  }

  // ── Condition fields renderer (UPS) ──
  function renderConditionSection(sectionKey, title, icon) {
    const cond = equipmentData[sectionKey] ?? {}
    const isThreePhase = equipmentData.phase_type === 'three'
    return (
      <div className="card" style={{ marginBottom:20 }}>
        <p className="section-tag">{icon} {title}</p>

        <div className="condition-header">
          <span className="condition-icon">⚡</span>
          <h4>Voltaje</h4>
        </div>
        <div className="measurement-grid" style={{ marginBottom:16 }}>
          <div className="measurement-field">
            <label>L1</label>
            <input type="number" inputMode="decimal" min="0" step="any" value={cond.l1} onChange={e => updateEquipmentNested(sectionKey, 'l1', e.target.value)} placeholder="V" />
          </div>
          <div className="measurement-field">
            <label>L2</label>
            <input type="number" inputMode="decimal" min="0" step="any" value={cond.l2} onChange={e => updateEquipmentNested(sectionKey, 'l2', e.target.value)} placeholder="V" />
          </div>
          {isThreePhase && (
            <div className="measurement-field">
              <label>L3</label>
              <input type="number" inputMode="decimal" min="0" step="any" value={cond.l3} onChange={e => updateEquipmentNested(sectionKey, 'l3', e.target.value)} placeholder="V" />
            </div>
          )}
          <div className="measurement-field">
            <label>N</label>
            <input type="number" inputMode="decimal" min="0" step="any" value={cond.n} onChange={e => updateEquipmentNested(sectionKey, 'n', e.target.value)} placeholder="V" />
          </div>
          <div className="measurement-field">
            <label>T</label>
            <input type="number" inputMode="decimal" min="0" step="any" value={cond.t} onChange={e => updateEquipmentNested(sectionKey, 't', e.target.value)} placeholder="V" />
          </div>
        </div>

        <div className="condition-header">
          <span className="condition-icon">🔌</span>
          <h4>Corriente</h4>
        </div>
        <div className="measurement-grid" style={{ marginBottom:16 }}>
          <div className="measurement-field">
            <label>L1</label>
            <input type="number" inputMode="decimal" min="0" step="any" value={cond.current_l1} onChange={e => updateEquipmentNested(sectionKey, 'current_l1', e.target.value)} placeholder="A" />
          </div>
          <div className="measurement-field">
            <label>L2</label>
            <input type="number" inputMode="decimal" min="0" step="any" value={cond.current_l2} onChange={e => updateEquipmentNested(sectionKey, 'current_l2', e.target.value)} placeholder="A" />
          </div>
          {isThreePhase && (
            <div className="measurement-field">
              <label>L3</label>
              <input type="number" inputMode="decimal" min="0" step="any" value={cond.current_l3} onChange={e => updateEquipmentNested(sectionKey, 'current_l3', e.target.value)} placeholder="A" />
            </div>
          )}
          <div className="measurement-field">
            <label>Neutro</label>
            <input type="number" inputMode="decimal" min="0" step="any" value={cond.current_neutral} onChange={e => updateEquipmentNested(sectionKey, 'current_neutral', e.target.value)} placeholder="A" />
          </div>
          <div className="measurement-field">
            <label>Tierra</label>
            <input type="number" inputMode="decimal" min="0" step="any" value={cond.current_ground} onChange={e => updateEquipmentNested(sectionKey, 'current_ground', e.target.value)} placeholder="A" />
          </div>
        </div>

        <div className="form-row form-row-2">
          <div className="form-group">
            <label className="form-label">Estado visual</label>
            <select className="form-control form-control-select"
              value={cond.visual_state}
              onChange={e => updateEquipmentNested(sectionKey, 'visual_state', e.target.value)}>
              <option value="">Seleccionar...</option>
              <option value="bueno">Bueno</option>
              <option value="regular">Regular</option>
              <option value="malo">Malo</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Observaciones</label>
            <input className="form-control"
              value={cond.observations}
              onChange={e => updateEquipmentNested(sectionKey, 'observations', e.target.value)}
              placeholder="Observaciones de la condición" />
          </div>
        </div>
      </div>
    )
  }

  // ── Current table renderer (AC) ──
  function renderCurrentTable(equipmentList) {
    return (
      <div style={{ overflowX:'auto' }}>
        <table className="current-table">
          <thead>
            <tr>
              <th>Equipo</th>
              <th>L1</th>
              <th>L2</th>
              <th>L3</th>
            </tr>
          </thead>
          <tbody>
            {equipmentList.map(eq => (
              <tr key={eq.key}>
                <td className="equip-label">{eq.label}</td>
                <td><input type="number" inputMode="decimal" min="0" step="any" value={equipmentData.operating_data[eq.key].l1}
                  onChange={e => updateOperatingData(eq.key, 'l1', e.target.value)} placeholder="A" /></td>
                <td><input type="number" inputMode="decimal" min="0" step="any" value={equipmentData.operating_data[eq.key].l2}
                  onChange={e => updateOperatingData(eq.key, 'l2', e.target.value)} placeholder="A" /></td>
                <td><input type="number" inputMode="decimal" min="0" step="any" value={equipmentData.operating_data[eq.key].l3}
                  onChange={e => updateOperatingData(eq.key, 'l3', e.target.value)} placeholder="A" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  // ── Photo section renderer (equipo / antes / despues) ──
  function renderPhotoSection(type, title, hint) {
    const inputId = `photo-input-${type}`
    const existing = existingPhotos.filter(p => p.photo_type === type)
    const added = photos.filter(p => p.type === type)
    return (
      <div className="card" style={{ marginBottom:20 }}>
        <p className="section-tag">{title}</p>
        {existing.length > 0 && (
          <>
            <p style={{ fontSize:13, color:'var(--clr-text-light)', marginBottom:8 }}>Fotos ya guardadas</p>
            <div className="photo-grid" style={{ marginBottom:16 }}>
              {existing.map(p => (
                <div key={p.id} className="photo-thumb-wrapper">
                  {p.url && <img src={p.url} alt={p.caption || 'Foto'} className="photo-thumb" />}
                </div>
              ))}
            </div>
          </>
        )}
        <label className="photo-upload-area" htmlFor={inputId} style={{ display:'block' }}>
          <Camera size={28} color="var(--clr-primary)" style={{ margin:'0 auto 8px' }} />
          <p style={{ fontWeight:600, color:'var(--clr-primary)' }}>Agregar fotos</p>
          <p style={{ fontSize:13, color:'var(--clr-text-light)' }}>{hint}</p>
          <input id={inputId} type="file" accept="image/*" multiple capture="environment"
            style={{ display:'none' }} onChange={e => handlePhotoAdd(e, type)} />
        </label>
        {added.length > 0 && (
          <div className="photo-grid">
            {added.map(p => (
              <div key={p.id} className="photo-thumb-wrapper">
                <img src={p.previewUrl} alt={p.name} className="photo-thumb" />
                <button className="photo-remove-btn" onClick={()=>removePhoto(p.id)}>
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (loadingReport) return (
    <div className="content-wrapper" style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:300 }}>
      <Loader size={32} className="spin" color="var(--clr-primary)" />
    </div>
  )

  if (loadError) return (
    <div className="content-wrapper fade-in">
      <div className="card">
        <div className="empty-state">
          <div className="empty-icon">⚠️</div>
          <p>No se pudo cargar el reporte</p>
          <span>Verifica tu conexión e intenta de nuevo</span>
          <br /><br />
          <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
            <button className="btn btn-primary" onClick={loadForEdit}>Reintentar</button>
            <button className="btn btn-secondary" onClick={() => navigate('/dashboard')}>Volver al Dashboard</button>
          </div>
        </div>
      </div>
    </div>
  )

  // ─── STEP 1: Module selector ──────────────────────
  if (step === 1) return (
    <div className="content-wrapper fade-in">
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:28 }}>
        <button className="icon-btn" onClick={goBack}><ArrowLeft size={18} /></button>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800 }}>Nuevo Reporte</h1>
          <p style={{ color:'var(--clr-text-light)', fontSize:13 }}>Selecciona el tipo de equipo</p>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 640 }}>
        <p className="section-tag">Paso 1 de 2 · Módulo</p>
        <h3 style={{ fontSize:18, fontWeight:700, marginBottom:6 }}>¿Qué equipo vas a reportar?</h3>
        <p style={{ color:'var(--clr-text-light)', fontSize:14, marginBottom:24 }}>
          Selecciona el tipo de equipo para cargar la plantilla correcta.
        </p>
        <div className="module-grid">
          {MODULES.map(m => (
            <div key={m.id}
              className={`module-card ${selectedModule === m.id ? 'selected' : ''}`}
              onClick={() => {
                setSelectedModule(m.id)
                // Varios is only ever offered for this module (see the Tipo
                // de Servicio card below) -- default straight to it so
                // picking Trabajos Varios doesn't leave Tipo de Servicio
                // unset for no reason.
                if (m.id === 'trabajos_varios') setServiceType('varios')
              }}>
              <div className="module-icon">{m.icon}</div>
              <div className="module-name">{m.name}</div>
              <div className="module-desc">{m.desc}</div>
            </div>
          ))}
        </div>

        <hr className="section-divider" />

        <div style={{ display:'flex', justifyContent:'flex-end' }}>
          <button className="btn btn-primary" disabled={!selectedModule}
            onClick={goToStep2}>
            Continuar →
          </button>
        </div>
      </div>
    </div>
  )

  // ─── STEP 2: Report form ──────────────────────────
  const module = MODULES.find(m => m.id === selectedModule)
  const moduleConfig = EQUIPMENT_MODULES[selectedModule]
  const isUPS = selectedModule === 'ups'
  const isAC = selectedModule === 'ac'
  const isGeneric = moduleConfig?.kind === 'generic'
  // Only Encabezado/Datos del Cliente/Técnicos/Descripción del Trabajo
  // apply to a Trabajos Varios report -- no single piece of equipment to
  // describe, so Datos del Equipo, the generic module's own form,
  // Repuestos and Fotos are all skipped for it.
  const isTrabajosVarios = selectedModule === 'trabajos_varios'

  return (
    <div className="content-wrapper fade-in">
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:28 }}>
        <button className="icon-btn" onClick={() => isEditMode ? goBack() : setStep(1)}><ArrowLeft size={18} /></button>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800 }}>
            {module?.icon} {isEditMode ? `Editar Reporte #${String(reportNumber ?? 0).padStart(4, '0')}` : 'Informe de Servicio'} – {module?.name}
          </h1>
          <p style={{ color:'var(--clr-text-light)', fontSize:13 }}>
            {isEditMode ? 'Editando reporte existente' : 'Paso 2 de 2 · Llena el formulario'}
          </p>
        </div>
      </div>

      {/* ── Validation errors ── */}
      {validationErrors.length > 0 && (
        <div className="card fade-in" style={{
          marginBottom: 20, background: 'var(--clr-danger-bg)',
          border: '1.5px solid var(--clr-danger)',
        }}>
          <p className="section-tag" style={{ color: 'var(--clr-danger)' }}>
            ⚠️ No se pudo completar el reporte
          </p>
          <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--clr-danger)', fontSize: 14 }}>
            {validationErrors.map((err, i) => <li key={i} style={{ marginBottom: 4 }}>{err}</li>)}
          </ul>
        </div>
      )}

      <div>
      {/* ── Service Type ── */}
      <div className="card" style={{ marginBottom:20 }}>
        <p className="section-tag">Tipo de Servicio <span>*</span></p>
        <div className="service-type-grid">
          {/* Varios is the only option for a Trabajos Varios report --
              fixed, not a real choice, so it's locked instead of just
              pre-selected among the other 3 (which aren't offered at all
              here). */}
          {isTrabajosVarios ? (
            <button type="button" disabled
              className="service-type-btn selected-varios" style={{ cursor:'default' }}>
              <div className="st-icon">{VARIOS_SERVICE_TYPE.icon}</div>
              <div className="st-label" style={{ color: VARIOS_SERVICE_TYPE.color }}>{VARIOS_SERVICE_TYPE.label}</div>
            </button>
          ) : SERVICE_TYPES.map(s => (
            <button key={s.id} type="button"
              className={`service-type-btn ${serviceType === s.id ? `selected-${s.id}` : ''}`}
              onClick={() => setServiceType(s.id)}>
              <div className="st-icon">{s.icon}</div>
              <div className="st-label" style={{ color: serviceType === s.id ? s.color : 'inherit' }}>{s.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Header ── */}
      <div className="card" style={{ marginBottom:20 }}>
        <p className="section-tag">Encabezado</p>
        <div className="form-group">
          <label className="form-label">Evento relacionado (opcional)</label>
          <select className="form-control form-control-select" value={eventId} onChange={e => setEventId(e.target.value)}>
            <option value="">Sin vincular a un evento</option>
            {eventId && !eventOptions.some(ev => ev.id === eventId) && loadedEvent &&
              <option value={eventId}>{eventOptionLabel(loadedEvent)}</option>}
            {eventOptions.map(ev => <option key={ev.id} value={ev.id}>{eventOptionLabel(ev)}</option>)}
          </select>
          <p style={{ fontSize: 12, color: 'var(--clr-text-light)', marginTop: 4 }}>
            Un evento puede tener más de un reporte vinculado -- por ejemplo, un reporte por cada equipo atendido en la misma visita.
          </p>
        </div>
        <div className="form-row form-row-3" style={{ marginTop: 4 }}>
          <div className="form-group">
            <label className="form-label">Código SC</label>
            <input className="form-control" value={scCode} onChange={e=>setScCode(e.target.value)} placeholder="SC-001" />
          </div>
          <div className="form-group">
            <label className="form-label">Proyecto</label>
            <input className="form-control" value={projectName} onChange={e=>setProjectName(e.target.value)} placeholder="Nombre del proyecto" />
          </div>
          <div className="form-group">
            <label className="form-label">Fecha <span>*</span></label>
            <input className="form-control" type="date" value={reportDate} onChange={e=>setReportDate(e.target.value)} />
          </div>
        </div>
      </div>

      {/* ── Client ── */}
      <div className="card" style={{ marginBottom:20 }}>
        <p className="section-tag">Datos del Cliente</p>
        <div className="form-row form-row-3">
          <div className="form-group">
            <label className="form-label">Nombre del cliente <span>*</span></label>
            <input className="form-control" value={clientName} onChange={e=>setClientName(e.target.value)} placeholder="Nombre o empresa" />
          </div>
          <div className="form-group">
            <label className="form-label">Dirección <span>*</span></label>
            <input className="form-control" value={clientAddress} onChange={e=>setClientAddress(e.target.value)} placeholder="Dirección de la visita" />
          </div>
          <div className="form-group">
            <label className="form-label">Teléfono del cliente</label>
            <input className="form-control" type="tel" value={clientPhone} onChange={e=>setClientPhone(e.target.value)} placeholder="8888-8888" />
          </div>
          <div className="form-group">
            <label className="form-label">Correo del cliente <span>*</span></label>
            <input className="form-control" type="email" value={clientEmail} onChange={e=>setClientEmail(e.target.value)} placeholder="cliente@empresa.com" />
          </div>
          <div className="form-group">
            <label className="form-label">Correo adicional</label>
            <input className="form-control" type="email" value={clientEmailSecondary} onChange={e=>setClientEmailSecondary(e.target.value)} placeholder="copia@empresa.com" />
          </div>
        </div>
        <div className="form-group" style={{ marginTop: 4 }}>
          <label className="form-label">Cliente registrado (opcional)</label>
          <select className="form-control form-control-select" value={selectedClientKey}
            onChange={e => selectRegisteredClient(e.target.value)}>
            <option value="">Cliente no registrado</option>
            {clientOptions.map((o, i) => <option key={i} value={i}>{o.full_name}</option>)}
          </select>
          <p style={{ fontSize: 12, color: 'var(--clr-text-light)', marginTop: 4 }}>
            Vincula este reporte a una cuenta de cliente para que pueda verlo al iniciar sesión.
          </p>
        </div>
      </div>
      </div>

      {/* ── Technicians table ── */}
      <div className="card" style={{ marginBottom:20 }}>
        <div className="section-header">
          <p className="section-tag" style={{ margin:0 }}>Técnicos</p>
          <span style={{ color:'var(--clr-danger)', marginLeft:-4, fontWeight:700 }}>*</span>
          <button className="btn btn-secondary btn-sm" onClick={addTech} style={{ marginLeft:'auto' }}>
            <Plus size={14} /> Agregar técnico
          </button>
        </div>
        <div className="parts-table-wrapper">
          <table className="data-table technicians-table">
            <thead>
              <tr>
                <th>#</th>
                <th style={{ minWidth:200 }}>Nombre del técnico</th>
                <th>H. Reporte Falla</th>
                <th>H. Llegada PDV</th>
                <th>H. Salida PDV</th>
                <th>H. Llegada Planta</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {technicians.map((t, i) => {
                const rowOptions = rowTechOptions(i)
                const idIsVisible = t.technician_id && rowOptions.some(o => o.id === t.technician_id)
                return (
                <tr key={t.id}>
                  <td style={{ width:32, color:'var(--clr-text-light)' }}>{i+1}</td>
                  <td>
                    <select className="form-control form-control-select"
                      value={idIsVisible ? t.technician_id : (t.technician_name ? 'legacy' : '')}
                      onChange={e=>selectTech(t.id, e.target.value)}>
                      <option value="">Seleccionar técnico</option>
                      {t.technician_name && !idIsVisible &&
                        <option value="legacy">{t.technician_name}</option>}
                      {rowOptions.map(o => <option key={o.id} value={o.id}>{o.full_name}{o.role === 'admin' ? ' (Admin)' : ''}</option>)}
                    </select>
                  </td>
                  <td><input className="form-control" type="time" value={t.fault_time} onChange={e=>updateTech(t.id,'fault_time',e.target.value)} /></td>
                  <td><input className="form-control" type="time" value={t.arrival_pdv} onChange={e=>updateTech(t.id,'arrival_pdv',e.target.value)} /></td>
                  <td><input className="form-control" type="time" value={t.departure_pdv} onChange={e=>updateTech(t.id,'departure_pdv',e.target.value)} /></td>
                  <td><input className="form-control" type="time" value={t.arrival_plant} onChange={e=>updateTech(t.id,'arrival_plant',e.target.value)} /></td>
                  <td>
                    {technicians.length > 1 &&
                      <button className="icon-btn" onClick={()=>removeTech(t.id)} style={{ borderColor:'transparent', color:'var(--clr-danger)' }}>
                        <Trash2 size={14} />
                      </button>}
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      </div>

      <div>
      {/* Tipo de Equipo a Revisar (AC) -- moved ahead of "Datos del Equipo"
          so the AC subtype is picked before its identity fields, rather
          than down among the rest of the AC-specific sections. */}
      {isAC && equipmentData && (
        <div className="card" style={{ marginBottom:20 }}>
          <p className="section-tag">❄️ Tipo de Equipo a Revisar</p>
          <div className="radio-grid">
            {EQUIPMENT_MODULES.ac.subtypes.map(sub => (
              <div key={sub.id}
                className={`radio-card ${equipmentData.equipment_subtype === sub.id ? 'active' : ''}`}
                onClick={() => updateEquipment('equipment_subtype', sub.id)}>
                <div className="radio-icon">
                  {sub.image ? <img src={sub.image} alt="" className={`radio-icon-img ${sub.id === 'minisplit' ? 'radio-icon-img-lg' : ''}`} /> : sub.icon}
                </div>
                <div className="radio-label">{sub.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Equipment Data ── */}
      {!isTrabajosVarios && (
      <div className="card" style={{ marginBottom:20 }}>
        <p className="section-tag">Datos del Equipo – {module?.name}</p>
        <div className="form-row form-row-3">
          <div className="form-group">
            <label className="form-label">Marca <span>*</span></label>
            <input className="form-control" value={brand} onChange={e=>setBrand(e.target.value)} placeholder="Ej: Liebert, Vertiv" />
          </div>
          <div className="form-group">
            <label className="form-label">Modelo <span>*</span></label>
            <input className="form-control" value={model} onChange={e=>setModel(e.target.value)} placeholder="Modelo del equipo" />
          </div>
          <div className="form-group">
            <label className="form-label">Serie <span>*</span></label>
            <input className="form-control" value={serial} onChange={e=>setSerial(e.target.value)} placeholder="N° de serie" />
          </div>
          <div className="form-group">
            <label className="form-label">Activo</label>
            <input className="form-control" value={asset} onChange={e=>setAsset(e.target.value)} placeholder="Código de activo" />
          </div>
          <div className="form-group" style={{ gridColumn:'span 2' }}>
            <label className="form-label">Ubicación</label>
            <input className="form-control" value={location} onChange={e=>setLocation(e.target.value)} placeholder="Cuarto TI, Sala de servidores, etc." />
          </div>
        </div>
      </div>
      )}

      {/* ══════════════════════════════════════════════════════
          ██  UPS-SPECIFIC SECTIONS
          ══════════════════════════════════════════════════════ */}
      {isUPS && equipmentData && (<>

        {/* Contrato y Contacto */}
        <div className="card" style={{ marginBottom:20 }}>
          <p className="section-tag">📋 Contrato y Contacto</p>
          <div className="contract-toggle-row">
            <span className="toggle-text">¿Mantenimiento contratado?</span>
            <label className="toggle-switch">
              <input type="checkbox" checked={equipmentData.maintenance_contracted === true}
                onChange={e => updateEquipment('maintenance_contracted', e.target.checked)} />
              <span className="toggle-slider"></span>
            </label>
            <span className="toggle-label">{equipmentData.maintenance_contracted ? 'SÍ' : 'NO'}</span>
          </div>
          <div className="form-row form-row-2">
            <div className="form-group">
              <label className="form-label">Proveedor</label>
              <input className="form-control" value={equipmentData.provider}
                onChange={e => updateEquipment('provider', e.target.value)} placeholder="Nombre del proveedor" />
            </div>
            <div className="form-group">
              <label className="form-label">Contacto</label>
              <input className="form-control" value={equipmentData.contact}
                onChange={e => updateEquipment('contact', e.target.value)} placeholder="Teléfono o correo" />
            </div>
          </div>
        </div>

        {/* Tipo de Red */}
        <div className="card" style={{ marginBottom:20 }}>
          <p className="section-tag">⚡ Tipo de Red</p>
          <div className="phase-selector">
            <button type="button" className={`phase-option ${equipmentData.phase_type === 'single' ? 'active' : ''}`}
              onClick={() => updateEquipment('phase_type', 'single')}>
              <div className="phase-icon">⚡</div>
              Monofásico (1F)
            </button>
            <button type="button" className={`phase-option ${equipmentData.phase_type === 'three' ? 'active' : ''}`}
              onClick={() => updateEquipment('phase_type', 'three')}>
              <div className="phase-icon">⚡⚡⚡</div>
              Trifásico (3F)
            </button>
          </div>
          <div className="form-row form-row-3" style={{ marginTop:12 }}>
            <div className="form-group">
              <label className="form-label">Potencia UPS</label>
              <input className="form-control" value={equipmentData.ups_power}
                onChange={e => updateEquipment('ups_power', e.target.value)} placeholder="kVA" />
            </div>
            <div className="form-group">
              <label className="form-label">Capacidad</label>
              <input className="form-control" value={equipmentData.capacity}
                onChange={e => updateEquipment('capacity', e.target.value)} placeholder="kW / kVA" />
            </div>
            <div className="form-group">
              <label className="form-label">Garantía</label>
              <input className="form-control" value={equipmentData.guarantee}
                onChange={e => updateEquipment('guarantee', e.target.value)} placeholder="Vigencia" />
            </div>
          </div>
        </div>

        {/* Revisión de estado de la tarjeta de red */}
        <div className="card" style={{ marginBottom:20 }}>
          <p className="section-tag">🌐 Revisión de estado de la tarjeta de red</p>
          <div className="contract-toggle-row">
            <span className="toggle-text">¿Cuenta con tarjeta de red?</span>
            <label className="toggle-switch">
              <input type="checkbox" checked={equipmentData.network_card.has_card === true}
                onChange={e => updateEquipmentNested('network_card', 'has_card', e.target.checked)} />
              <span className="toggle-slider"></span>
            </label>
            <span className="toggle-label">{equipmentData.network_card.has_card ? 'SÍ' : 'NO'}</span>
          </div>
          <div className="contract-toggle-row">
            <span className="toggle-text">¿Comunica?</span>
            <label className="toggle-switch">
              <input type="checkbox" checked={equipmentData.network_card.communicates === true}
                onChange={e => updateEquipmentNested('network_card', 'communicates', e.target.checked)} />
              <span className="toggle-slider"></span>
            </label>
            <span className="toggle-label">{equipmentData.network_card.communicates ? 'SÍ' : 'NO'}</span>
          </div>
          <div className="contract-toggle-row">
            <span className="toggle-text">¿Se descarga el histórico del UPS?</span>
            <label className="toggle-switch">
              <input type="checkbox" checked={equipmentData.network_card.downloads_history === true}
                onChange={e => updateEquipmentNested('network_card', 'downloads_history', e.target.checked)} />
              <span className="toggle-slider"></span>
            </label>
            <span className="toggle-label">{equipmentData.network_card.downloads_history ? 'SÍ' : 'NO'}</span>
          </div>
          <div className="form-group" style={{ marginTop:12 }}>
            <label className="form-label">Protocolo que se está usando</label>
            <input className="form-control" value={equipmentData.network_card.protocol}
              onChange={e => updateEquipmentNested('network_card', 'protocol', e.target.value)} placeholder="Ej. SNMP, HTTP..." />
          </div>
        </div>

        {/* Condición de Entrada */}
        {renderConditionSection('entry_condition', 'Condición de Entrada', '⚡')}

        {/* Condiciones Ambientales */}
        <div className="card" style={{ marginBottom:20 }}>
          <p className="section-tag">🌡️ Condiciones Ambientales</p>
          <div className="form-row form-row-3">
            <div className="form-group">
              <label className="form-label">Temperatura (°C)</label>
              <input className="form-control" type="number" inputMode="decimal" step="any" value={equipmentData.environmental.temperature}
                onChange={e => updateEquipmentNested('environmental', 'temperature', e.target.value)} placeholder="°C" />
            </div>
            <div className="form-group">
              <label className="form-label">Humedad (%)</label>
              <input className="form-control" type="number" inputMode="decimal" min="0" step="any" value={equipmentData.environmental.humidity}
                onChange={e => updateEquipmentNested('environmental', 'humidity', e.target.value)} placeholder="%" />
            </div>
            <div className="form-group">
              <label className="form-label">Altitud (msnm)</label>
              <input className="form-control" type="number" inputMode="decimal" min="0" step="any" value={equipmentData.environmental.altitude}
                onChange={e => updateEquipmentNested('environmental', 'altitude', e.target.value)} placeholder="msnm" />
            </div>
          </div>
        </div>

        {/* Baterías */}
        <div className="card" style={{ marginBottom:20 }}>
          <p className="section-tag">🔋 Baterías</p>
          <div className="form-row form-row-3" style={{ marginBottom:12 }}>
            <div className="form-group">
              <label className="form-label">Calibre</label>
              <input className="form-control" value={equipmentData.batteries.caliber}
                onChange={e => updateEquipmentNested('batteries', 'caliber', e.target.value)} placeholder="AWG" />
            </div>
            <div className="form-group">
              <label className="form-label">Cantidad</label>
              <input className="form-control" type="number" inputMode="numeric" min="0" step="1" value={equipmentData.batteries.bat_quantity}
                onChange={e => updateEquipmentNested('batteries', 'bat_quantity', e.target.value)} placeholder="Cantidad" />
            </div>
            <div className="form-group">
              <label className="form-label">N° Banco</label>
              <input className="form-control" value={equipmentData.batteries.bank_number}
                onChange={e => updateEquipmentNested('batteries', 'bank_number', e.target.value)} placeholder="N° banco" />
            </div>
          </div>
          <div className="form-row form-row-2">
            <div className="form-group">
              <label className="form-label">Voltaje Batería</label>
              <input className="form-control" type="number" inputMode="decimal" min="0" step="any" value={equipmentData.batteries.v_batt}
                onChange={e => updateEquipmentNested('batteries', 'v_batt', e.target.value)} placeholder="V" />
            </div>
            <div className="form-group">
              <label className="form-label">Observaciones</label>
              <input className="form-control" value={equipmentData.batteries.observations}
                onChange={e => updateEquipmentNested('batteries', 'observations', e.target.value)} placeholder="Observaciones" />
            </div>
          </div>
        </div>

        {/* Condición de Salida */}
        {renderConditionSection('output_condition', 'Condición de Salida', '⚡')}

        {/* Actividades a Realizar */}
        <div className="card" style={{ marginBottom:20 }}>
          <p className="section-tag">📋 Actividades a Realizar</p>
          <div className="checklist-grid">
            {EQUIPMENT_MODULES.ups.activities.map((act, i) => (
              <div key={act.key} className="checklist-item">
                <span className="checklist-number">{i+1}</span>
                <span className="checklist-label">{act.label}</span>
                <label className="toggle-switch">
                  <input type="checkbox" checked={equipmentData.activities_checklist[act.key]}
                    onChange={() => toggleChecklist('activities_checklist', act.key)} />
                  <span className="toggle-slider"></span>
                </label>
                <span className="toggle-label">
                  {equipmentData.activities_checklist[act.key] ? 'SÍ' : 'NO'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Pruebas */}
        <div className="card" style={{ marginBottom:20 }}>
          <p className="section-tag">🧪 Pruebas</p>
          <div className="tests-grid">
            {EQUIPMENT_MODULES.ups.tests.map(test => (
              <div key={test.key} className={`test-item ${equipmentData.tests[test.key] ? 'checked' : ''}`}
                onClick={() => toggleChecklist('tests', test.key)}>
                <input type="checkbox" checked={equipmentData.tests[test.key]} readOnly />
                <label>{test.label}</label>
              </div>
            ))}
          </div>
          <hr className="section-divider" />
          <div className="contract-toggle-row">
            <span className="toggle-text">¿Pendiente de ejecución?</span>
            <label className="toggle-switch">
              <input type="checkbox" checked={equipmentData.pending_execution === true}
                onChange={e => updateEquipment('pending_execution', e.target.checked)} />
              <span className="toggle-slider"></span>
            </label>
            <span className="toggle-label">{equipmentData.pending_execution ? 'SÍ' : 'NO'}</span>
          </div>
        </div>

        {/* Tiempo de Ejecución */}
        <div className="card" style={{ marginBottom:20 }}>
          <p className="section-tag">⏱️ Tiempo de Ejecución</p>
          <div className="form-row form-row-2">
            <div className="form-group">
              <label className="form-label">Hora de Llegada</label>
              <input className="form-control" type="time" value={equipmentData.execution_time.arrival_time}
                onChange={e => updateEquipmentNested('execution_time', 'arrival_time', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Hora de Salida</label>
              <input className="form-control" type="time" value={equipmentData.execution_time.departure_time}
                onChange={e => updateEquipmentNested('execution_time', 'departure_time', e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Observaciones / Cancelación</label>
            <textarea className="form-control" rows={2} value={equipmentData.cancellation}
              onChange={e => updateEquipment('cancellation', e.target.value)}
              placeholder="Observaciones sobre la ejecución o cancelación..." />
          </div>
        </div>

      </>)}

      {/* ══════════════════════════════════════════════════════
          ██  AC-SPECIFIC SECTIONS
          ══════════════════════════════════════════════════════ */}
      {isAC && equipmentData && (<>

        {/* Contrato y Contacto */}
        <div className="card" style={{ marginBottom:20 }}>
          <p className="section-tag">📋 Contrato y Contacto</p>
          <div className="contract-toggle-row">
            <span className="toggle-text">¿Mantenimiento contratado?</span>
            <label className="toggle-switch">
              <input type="checkbox" checked={equipmentData.maintenance_contracted === true}
                onChange={e => updateEquipment('maintenance_contracted', e.target.checked)} />
              <span className="toggle-slider"></span>
            </label>
            <span className="toggle-label">{equipmentData.maintenance_contracted ? 'SÍ' : 'NO'}</span>
          </div>
          <div className="form-row form-row-3">
            <div className="form-group">
              <label className="form-label">Proveedor</label>
              <input className="form-control" value={equipmentData.provider}
                onChange={e => updateEquipment('provider', e.target.value)} placeholder="Nombre del proveedor" />
            </div>
            <div className="form-group">
              <label className="form-label">Contacto</label>
              <input className="form-control" value={equipmentData.contact}
                onChange={e => updateEquipment('contact', e.target.value)} placeholder="Teléfono o correo" />
            </div>
            <div className="form-group">
              <label className="form-label">Técnico auxiliar</label>
              <input className="form-control" value={equipmentData.auxiliary_technician}
                onChange={e => updateEquipment('auxiliary_technician', e.target.value)} placeholder="Nombre del auxiliar" />
            </div>
          </div>
        </div>

        {/* Trabajos Realizados */}
        <div className="card" style={{ marginBottom:20 }}>
          <p className="section-tag">🔧 Trabajos Realizados</p>
          <div className="checkbox-grid">
            {EQUIPMENT_MODULES.ac.workItems.map(item => (
              <div key={item.key}
                className={`checkbox-item ${equipmentData.work_performed[item.key] ? 'checked' : ''}`}
                onClick={() => toggleChecklist('work_performed', item.key)}>
                <input type="checkbox" checked={equipmentData.work_performed[item.key]} readOnly />
                <label>{item.label}</label>
              </div>
            ))}
          </div>
          <div className="form-group" style={{ marginTop:12 }}>
            <label className="form-label">Otro</label>
            <input className="form-control" value={equipmentData.work_performed.other}
              onChange={e => updateEquipmentNested('work_performed', 'other', e.target.value)}
              placeholder="Otro trabajo realizado..." />
          </div>
        </div>

        {/* Datos de Funcionamiento */}
        <div className="card" style={{ marginBottom:20 }}>
          <p className="section-tag">📊 Datos de Funcionamiento del Equipo</p>
          <div className="current-table-container">
            {renderCurrentTable(EQUIPMENT_MODULES.ac.leftEquipment)}
            {renderCurrentTable(EQUIPMENT_MODULES.ac.rightEquipment)}
          </div>

          <hr className="section-divider" />
          <p className="section-tag" style={{ marginBottom:12 }}>Presiones</p>
          <div className="pressure-grid">
            <div className="pressure-group">
              <h5>Presión Alta</h5>
              <div className="pressure-inputs">
                <div className="form-group" style={{ marginBottom:0 }}>
                  <label className="form-label">Etapa 1</label>
                  <input className="form-control" type="number" inputMode="decimal" min="0" step="any" value={equipmentData.operating_data.high_pressure_1}
                    onChange={e => setEquipmentData(prev => ({
                      ...prev, operating_data: { ...prev.operating_data, high_pressure_1: e.target.value }
                    }))} placeholder="PSI" />
                </div>
                <div className="form-group" style={{ marginBottom:0 }}>
                  <label className="form-label">Etapa 2</label>
                  <input className="form-control" type="number" inputMode="decimal" min="0" step="any" value={equipmentData.operating_data.high_pressure_2}
                    onChange={e => setEquipmentData(prev => ({
                      ...prev, operating_data: { ...prev.operating_data, high_pressure_2: e.target.value }
                    }))} placeholder="PSI" />
                </div>
              </div>
            </div>
            <div className="pressure-group">
              <h5>Presión Baja</h5>
              <div className="pressure-inputs">
                <div className="form-group" style={{ marginBottom:0 }}>
                  <label className="form-label">Etapa 1</label>
                  <input className="form-control" type="number" inputMode="decimal" min="0" step="any" value={equipmentData.operating_data.low_pressure_1}
                    onChange={e => setEquipmentData(prev => ({
                      ...prev, operating_data: { ...prev.operating_data, low_pressure_1: e.target.value }
                    }))} placeholder="PSI" />
                </div>
                <div className="form-group" style={{ marginBottom:0 }}>
                  <label className="form-label">Etapa 2</label>
                  <input className="form-control" type="number" inputMode="decimal" min="0" step="any" value={equipmentData.operating_data.low_pressure_2}
                    onChange={e => setEquipmentData(prev => ({
                      ...prev, operating_data: { ...prev.operating_data, low_pressure_2: e.target.value }
                    }))} placeholder="PSI" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Repuestos toggle */}
        <div className="card" style={{ marginBottom:20 }}>
          <div className="contract-toggle-row" style={{ marginBottom:0 }}>
            <span className="toggle-text">¿Se utilizaron repuestos?</span>
            <label className="toggle-switch">
              <input type="checkbox" checked={equipmentData.parts_used === true}
                onChange={e => updateEquipment('parts_used', e.target.checked)} />
              <span className="toggle-slider"></span>
            </label>
            <span className="toggle-label">{equipmentData.parts_used ? 'SÍ' : 'NO'}</span>
          </div>
        </div>

      </>)}

      {/* ══════════════════════════════════════════════════════
          ██  GENERIC MODULE SECTIONS (Generador, Batería, ATS, Tablero)
          ══════════════════════════════════════════════════════ */}
      {isGeneric && !isTrabajosVarios && equipmentData && (
        <GenericModuleForm config={moduleConfig} data={equipmentData}
          onUpdate={updateEquipment} onUpdateNested={updateEquipmentNested} onToggleChecklist={toggleChecklist} />
      )}

      {/* ── Parts ── */}
      {!isTrabajosVarios && (
      <div className="card" style={{ marginBottom:20 }}>
        <div className="section-header">
          <p className="section-tag" style={{ margin:0 }}>Repuestos Utilizados</p>
          <button className="btn btn-secondary btn-sm" onClick={addPart} style={{ marginLeft:'auto' }}>
            <Plus size={14} /> Agregar repuesto
          </button>
        </div>
        <div className="parts-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width:80 }}>Cantidad</th>
                <th>Descripción</th>
                <th style={{ width:120 }}>Código</th>
                <th style={{ width:40 }}></th>
              </tr>
            </thead>
            <tbody>
              {parts.map(p => (
                <tr key={p.id}>
                  <td><input className="form-control" type="number" min="0" value={p.quantity} onChange={e=>updatePart(p.id,'quantity',e.target.value)} placeholder="0" /></td>
                  <td><input className="form-control" value={p.description} onChange={e=>updatePart(p.id,'description',e.target.value)} placeholder="Descripción del repuesto" /></td>
                  <td><input className="form-control" value={p.part_code} onChange={e=>updatePart(p.id,'part_code',e.target.value)} placeholder="Código" /></td>
                  <td>
                    {parts.length > 1 &&
                      <button className="icon-btn" onClick={()=>removePart(p.id)} style={{ borderColor:'transparent', color:'var(--clr-danger)' }}>
                        <Trash2 size={14} />
                      </button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* ── Work description & Observations ── */}
      <div className="card" style={{ marginBottom:20 }}>
        <p className="section-tag">Descripción del Trabajo</p>
        <div className="form-group">
          <label className="form-label">Trabajo realizado <span>*</span></label>
          <textarea className="form-control" rows={5} value={workDescription}
            onChange={e=>setWorkDescription(e.target.value)}
            placeholder="Describe detalladamente el trabajo realizado..." />
        </div>
        <div className="form-group">
          <label className="form-label">Observaciones</label>
          <textarea className="form-control" rows={3} value={observations}
            onChange={e=>setObservations(e.target.value)}
            placeholder="Observaciones adicionales, recomendaciones..." />
        </div>
      </div>

      {/* ── Photos ── */}
      {!isTrabajosVarios && (<>
        {renderPhotoSection('equipo', '📷 Fotos del Equipo', 'Toca para abrir cámara o galería')}
        {renderPhotoSection('antes', '⏮️ Fotos Antes', 'Estado del equipo antes del servicio')}
        {renderPhotoSection('despues', '⏭️ Fotos Después', 'Estado del equipo después del servicio')}
      </>)}
      </div>

      {/* ── Actions ── */}
      {saving && uploadProgress && (
        <div style={{ marginBottom:12, maxWidth:320, marginLeft:'auto' }}>
          <p style={{ fontSize:12, color:'var(--clr-text-light)', marginBottom:4, textAlign:'right' }}>
            Subiendo foto {uploadProgress.done} de {uploadProgress.total}
          </p>
          <div className="upload-progress-bar">
            <div className="upload-progress-fill" style={{ width: `${(uploadProgress.done / uploadProgress.total) * 100}%` }} />
          </div>
        </div>
      )}
      <div style={{ display:'flex', gap:12, justifyContent:'flex-end', marginBottom:40 }}>
        <button className="btn btn-secondary" onClick={()=>handleSave('draft')} disabled={saving}>
          {saving ? <><Loader size={14} className="spin" /> Guardando...</> : 'Guardar Borrador'}
        </button>
        <button id="btn-completar-reporte" className="btn btn-primary"
          onClick={()=>handleSave(isEditMode ? originalStatus : 'completed')}
          disabled={saving}>
          {saving ? <><Loader size={14} className="spin" /> Guardando...</> : (isEditMode ? 'Guardar Cambios' : 'Completar Reporte →')}
        </button>
      </div>
    </div>
  )
}
