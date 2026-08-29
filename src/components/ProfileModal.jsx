import { useState } from 'react'
import { Camera, X, Loader, AlertCircle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { updateProfile, uploadAvatar } from '../services/supabaseDB'
import { isBlank, isValidEmail } from '../utils/validation'

const ROLE_LABELS = { admin: 'Administrador', tecnico: 'Técnico', cliente: 'Cliente' }

export default function ProfileModal({ onClose }) {
  const { user, profile, refreshProfile } = useAuth()
  const isCliente = profile?.role === 'cliente'

  const [fullName, setFullName] = useState(profile?.full_name || '')
  // Dirección/Teléfono/Correo del cliente -- only ever shown/edited for the
  // "cliente" role (see isCliente below). A técnico/admin's own contact
  // info isn't part of this modal.
  const [address, setAddress] = useState(profile?.address || '')
  const [phone, setPhone] = useState(profile?.phone || '')
  const [contactEmail, setContactEmail] = useState(profile?.contact_email || '')
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(profile?.avatar_url || null)
  // avatar_url can point at a file that's since been removed from storage --
  // falls back to initials instead of a broken image if it fails to load.
  const [avatarBroken, setAvatarBroken] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const initials = (profile?.full_name || user?.email || 'U')
    .split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

  function handleBackdropClick(e) {
    if (e.target === e.currentTarget) onClose()
  }

  function handleAvatarPick(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
    setAvatarBroken(false)
  }

  async function handleSave() {
    setError('')
    if (isCliente && !isBlank(contactEmail) && !isValidEmail(contactEmail)) {
      setError('El correo del cliente no es válido.')
      return
    }
    setSaving(true)
    try {
      let avatarUrl = profile?.avatar_url ?? null
      if (avatarFile) {
        avatarUrl = await uploadAvatar(user.id, avatarFile)
      } else if (avatarBroken) {
        avatarUrl = null
      }
      const fields = { full_name: fullName.trim(), avatar_url: avatarUrl }
      if (isCliente) {
        fields.address = address.trim()
        fields.phone = phone.trim()
        fields.contact_email = contactEmail.trim()
      }
      await updateProfile(user.id, fields)
      await refreshProfile()
      onClose()
    } catch (err) {
      setError(err.message ?? 'Error al guardar los cambios')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      onClick={handleBackdropClick}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 200, padding: 16,
      }}
    >
      <div className="card fade-in" style={{ maxWidth: 420, width: '100%', position: 'relative' }}>
        <button className="icon-btn" onClick={onClose}
          style={{ position: 'absolute', top: 16, right: 16 }}>
          <X size={16} />
        </button>

        <p className="section-tag">Mi Perfil</p>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24 }}>
          <div style={{ position: 'relative' }}>
            {avatarPreview && !avatarBroken ? (
              <img src={avatarPreview} alt="Foto de perfil" onError={() => setAvatarBroken(true)}
                style={{ width: 88, height: 88, borderRadius: '50%', objectFit: 'cover', boxShadow: 'var(--shadow-md)' }} />
            ) : (
              <div className="user-avatar" style={{ width: 88, height: 88, fontSize: 28 }}>{initials}</div>
            )}
            <label htmlFor="avatar-input" style={{
              position: 'absolute', bottom: 0, right: 0, width: 30, height: 30, borderRadius: '50%',
              background: 'var(--clr-primary)', color: 'white', display: 'flex', alignItems: 'center',
              justifyContent: 'center', cursor: 'pointer', border: '2px solid var(--clr-surface)',
            }}>
              <Camera size={14} />
              <input id="avatar-input" type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarPick} />
            </label>
          </div>
        </div>

        {error && (
          <div style={{
            background: 'var(--clr-danger-bg)', color: 'var(--clr-danger)',
            padding: '10px 14px', borderRadius: 'var(--radius-md)',
            marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center',
            fontSize: 13, fontWeight: 500,
          }}>
            <AlertCircle size={15} /> {error}
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Correo electrónico</label>
          <input className="form-control" value={user?.email || ''} disabled />
        </div>

        <div className="form-group">
          <label className="form-label">Nombre completo</label>
          <input className="form-control" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Tu nombre" />
        </div>

        {isCliente && (
          <>
            <div className="form-group">
              <label className="form-label">Dirección</label>
              <input className="form-control" value={address} onChange={e => setAddress(e.target.value)} placeholder="Dirección" />
            </div>
            <div className="form-group">
              <label className="form-label">Teléfono del cliente</label>
              <input className="form-control" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="8888-8888" />
            </div>
            <div className="form-group">
              <label className="form-label">Correo del cliente</label>
              <input className="form-control" type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="cliente@empresa.com" />
            </div>
          </>
        )}

        <div className="form-group">
          <label className="form-label">Rol</label>
          <input className="form-control" value={ROLE_LABELS[profile?.role] ?? profile?.role ?? '—'} disabled />
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
          <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !fullName.trim()}>
            {saving ? <><Loader size={14} className="spin" /> Guardando...</> : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
