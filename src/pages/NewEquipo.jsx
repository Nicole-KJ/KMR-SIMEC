import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader, X, Camera } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { createEquipo, uploadEquipoPhoto } from '../services/equiposService'
import { INVENTORY_MODULES, getInventoryFields } from '../constants/equipmentInventoryFields'
import { isBlank } from '../utils/validation'
import { logError } from '../utils/logger'

function InventoryField({ field, value, onChange }) {
  if (field.type === 'select') {
    return (
      <select className="form-control form-control-select" value={value} onChange={e => onChange(field.key, e.target.value)}>
        <option value="">Seleccionar...</option>
        {field.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    )
  }
  return (
    <input className="form-control" value={value} onChange={e => onChange(field.key, e.target.value)} placeholder={field.placeholder || ''} />
  )
}

export default function NewEquipo() {
  const navigate = useNavigate()
  const { user, profile, isClient } = useAuth()
  const { showToast } = useToast()

  const [step, setStep] = useState(1)
  const [selectedType, setSelectedType] = useState('')

  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [notes, setNotes] = useState('')
  const [equipmentData, setEquipmentData] = useState({})
  const [photo, setPhoto] = useState(null) // { file, previewUrl }

  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  // A client always links themselves, automatically, silently -- staff
  // never picks a client here at all (054), so an equipo staff registers
  // just stays unlinked. Either way there's no "Clientes vinculados" section
  // on this form; that only ever shows on EquipoDetail.jsx.
  const clients = useMemo(
    () => (isClient ? [{ clientUserId: user.id, clientName: profile?.full_name || user.email }] : []),
    [isClient, user, profile]
  )

  const inventoryFields = useMemo(() => getInventoryFields(selectedType), [selectedType])
  const moduleInfo = INVENTORY_MODULES.find(m => m.id === selectedType)

  function selectType(typeId) {
    setSelectedType(typeId)
    setEquipmentData(Object.fromEntries(getInventoryFields(typeId).map(f => [f.key, ''])))
  }

  function updateField(key, value) {
    setEquipmentData(prev => ({ ...prev, [key]: value }))
  }

  // One photo per equipo -- picking a new one replaces whatever was
  // selected before (revoking its preview URL so it doesn't leak), same as
  // NewReport.jsx's handlePhotoAdd/removePhoto but singular rather than a
  // gallery.
  function handlePhotoChange(e) {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    setPhoto(prev => {
      if (prev) URL.revokeObjectURL(prev.previewUrl)
      return { file, previewUrl: URL.createObjectURL(file) }
    })
  }

  function removePhoto() {
    setPhoto(prev => {
      if (prev) URL.revokeObjectURL(prev.previewUrl)
      return null
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError('')
    if (isBlank(brand)) { setFormError('La marca es requerida.'); return }
    if (isBlank(model)) { setFormError('El modelo es requerido.'); return }

    setSaving(true)
    try {
      const equipo = await createEquipo({
        equipment_type: selectedType,
        brand: brand.trim(),
        model: model.trim(),
        equipment_data: equipmentData,
        notes: notes.trim() || null,
      }, clients, user.id)
      // Uploaded as a follow-up write, not part of the equipos insert --
      // the storage path is keyed by the equipo's id, which doesn't exist
      // until this point (same reasoning as report photos).
      if (photo) {
        try {
          await uploadEquipoPhoto(equipo.id, photo.file)
        } catch (err) {
          // The equipo itself saved fine -- a failed photo upload
          // shouldn't look like the whole save failed, just flag it.
          logError('NewEquipo.uploadEquipoPhoto', err)
          showToast('El equipo se guardó, pero la foto no se pudo subir: ' + (err.message ?? err))
        }
      }
      showToast('Equipo agregado al inventario', 'success')
      navigate('/inventario')
    } catch (err) {
      logError('NewEquipo.handleSubmit', err)
      setFormError(err.message ?? 'No se pudo guardar el equipo')
    } finally {
      setSaving(false)
    }
  }

  // ─── STEP 1: Type selector ──────────────────────
  if (step === 1) return (
    <div className="content-wrapper fade-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <button className="icon-btn" onClick={() => navigate('/inventario')}><ArrowLeft size={18} /></button>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>{isClient ? 'Agregar Mi Equipo' : 'Agregar Equipo'}</h1>
          <p style={{ color: 'var(--clr-text-light)', fontSize: 13 }}>Selecciona el tipo de equipo</p>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 640 }}>
        <p className="section-tag">Paso 1 de 2 · Tipo de equipo</p>
        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>¿Qué equipo vas a registrar?</h3>
        <p style={{ color: 'var(--clr-text-light)', fontSize: 14, marginBottom: 24 }}>
          Selecciona el tipo de equipo para cargar la plantilla correcta.
        </p>
        <div className="module-grid">
          {INVENTORY_MODULES.map(m => (
            <div key={m.id} className={`module-card ${selectedType === m.id ? 'selected' : ''}`} onClick={() => selectType(m.id)}>
              <div className="module-icon">{m.icon}</div>
              <div className="module-name">{m.name}</div>
              <div className="module-desc">{m.desc}</div>
            </div>
          ))}
        </div>

        <hr className="section-divider" />

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" disabled={!selectedType} onClick={() => setStep(2)}>
            Continuar →
          </button>
        </div>
      </div>
    </div>
  )

  // ─── STEP 2: Equipment form ──────────────────────
  return (
    <div className="content-wrapper fade-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <button className="icon-btn" onClick={() => setStep(1)}><ArrowLeft size={18} /></button>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>{isClient ? 'Agregar Mi Equipo' : 'Agregar Equipo'}</h1>
          <p style={{ color: 'var(--clr-text-light)', fontSize: 13 }}>{moduleInfo?.icon} {moduleInfo?.name}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {formError && (
          <div className="card" style={{ marginBottom: 20, borderColor: 'var(--clr-danger)' }}>
            <p style={{ color: 'var(--clr-danger)', fontSize: 13, fontWeight: 500, margin: 0 }}>{formError}</p>
          </div>
        )}

        <div className="card" style={{ marginBottom: 20 }}>
          <p className="section-tag">Datos del equipo</p>
          <div className="form-row form-row-2">
            <div className="form-group">
              <label className="form-label">Marca <span>*</span></label>
              <input className="form-control" value={brand} onChange={e => setBrand(e.target.value)} placeholder="Ej: Liebert, Vertiv" />
            </div>
            <div className="form-group">
              <label className="form-label">Modelo <span>*</span></label>
              <input className="form-control" value={model} onChange={e => setModel(e.target.value)} placeholder="Modelo del equipo" />
            </div>
          </div>
        </div>

        {inventoryFields.length > 0 && (
          <div className="card" style={{ marginBottom: 20 }}>
            <p className="section-tag">Datos específicos · {moduleInfo?.name}</p>
            <div className="form-row form-row-2">
              {inventoryFields.map(f => (
                <div className="form-group" key={f.key}>
                  <label className="form-label">{f.label}</label>
                  <InventoryField field={f} value={equipmentData[f.key] ?? ''} onChange={updateField} />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="card" style={{ marginBottom: 20 }}>
          <p className="section-tag">Foto del equipo</p>
          {photo ? (
            <div className="photo-grid">
              <div className="photo-thumb-wrapper">
                <img src={photo.previewUrl} alt="Foto del equipo" className="photo-thumb" />
                <button type="button" className="photo-remove-btn" onClick={removePhoto}>
                  <X size={10} />
                </button>
              </div>
            </div>
          ) : (
            <label className="photo-upload-area" htmlFor="equipo-photo-input" style={{ display: 'block' }}>
              <Camera size={28} color="var(--clr-primary)" style={{ margin: '0 auto 8px' }} />
              <p style={{ fontWeight: 600, color: 'var(--clr-primary)' }}>Agregar foto</p>
              <p style={{ fontSize: 13, color: 'var(--clr-text-light)' }}>Toca para abrir cámara o galería</p>
              <input id="equipo-photo-input" type="file" accept="image/*" capture="environment"
                style={{ display: 'none' }} onChange={handlePhotoChange} />
            </label>
          )}
        </div>

        <div className="card" style={{ marginBottom: 20 }}>
          <p className="section-tag">Notas</p>
          <textarea className="form-control" rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observaciones adicionales (opcional)" />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? <><Loader size={14} className="spin" /> Guardando...</> : 'Guardar Equipo'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/inventario')} disabled={saving}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}
