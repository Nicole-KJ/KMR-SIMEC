import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Loader } from 'lucide-react'
import { getEquipo, getEquipoPhotoUrl } from '../services/equiposService'
import { EQUIPMENT_MODULES } from '../constants/equipmentModules'
import { getInventoryFields, formatInventoryFieldValue } from '../constants/equipmentInventoryFields'
import { formatDate } from '../services/supabaseDB'
import { logError } from '../utils/logger'

export default function EquipoDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [equipo, setEquipo] = useState(null)
  const [photoUrl, setPhotoUrl] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  function load() {
    setLoading(true)
    setLoadError(null)
    getEquipo(id)
      .then(async eq => {
        setEquipo(eq)
        // photo_path lives in a private bucket (053) -- resolve to a
        // short-lived signed URL, same as InventarioEquipos.jsx's list.
        setPhotoUrl(eq.photo_path ? await getEquipoPhotoUrl(eq.photo_path) : null)
      })
      .catch(err => { logError('EquipoDetail.load', err); setLoadError(err) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [id])

  if (loading) return (
    <div className="content-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
      <Loader size={32} className="spin" color="var(--clr-primary)" />
    </div>
  )

  if (loadError || !equipo) return (
    <div className="content-wrapper fade-in">
      <div className="card">
        <div className="empty-state">
          <div className="empty-icon">⚠️</div>
          <p>No se pudo cargar el equipo</p>
          <span>Verifica tu conexión e intenta de nuevo</span>
          <br /><br />
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={load}>Reintentar</button>
            <button className="btn btn-secondary" onClick={() => navigate('/inventario')}>Volver al Inventario</button>
          </div>
        </div>
      </div>
    </div>
  )

  const moduleInfo = EQUIPMENT_MODULES[equipo.equipment_type]
  const inventoryFields = getInventoryFields(equipo.equipment_type)

  return (
    <div className="content-wrapper fade-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <button className="icon-btn" onClick={() => navigate('/inventario')}><ArrowLeft size={18} /></button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>{equipo.brand} {equipo.model}</h1>
          <p style={{ color: 'var(--clr-text-light)', fontSize: 13 }}>
            {moduleInfo?.icon} {moduleInfo?.name ?? equipo.equipment_type} · Agregado el {formatDate(equipo.created_at)}
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <p className="section-tag">Datos del equipo</p>
        <div className="responsive-grid-2" style={{ display: 'grid', gap: 16 }}>
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--clr-text-light)', textTransform: 'uppercase' }}>Marca</p>
            <p style={{ fontSize: 14 }}>{equipo.brand || '—'}</p>
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--clr-text-light)', textTransform: 'uppercase' }}>Modelo</p>
            <p style={{ fontSize: 14 }}>{equipo.model || '—'}</p>
          </div>
        </div>
      </div>

      {inventoryFields.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <p className="section-tag">Datos específicos · {moduleInfo?.name}</p>
          <div className="responsive-grid-2" style={{ display: 'grid', gap: 16 }}>
            {inventoryFields.map(f => (
              <div key={f.key}>
                <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--clr-text-light)', textTransform: 'uppercase' }}>{f.label}</p>
                <p style={{ fontSize: 14 }}>{formatInventoryFieldValue(f, equipo.equipment_data?.[f.key]) || '—'}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {photoUrl && (
        <div className="card" style={{ marginBottom: 20 }}>
          <p className="section-tag">Foto del equipo</p>
          <a href={photoUrl} target="_blank" rel="noopener noreferrer">
            <img src={photoUrl} alt={`${equipo.brand ?? ''} ${equipo.model ?? ''}`}
              style={{ maxWidth: 240, borderRadius: 'var(--radius-md)', objectFit: 'cover', display: 'block' }} />
          </a>
        </div>
      )}

      {equipo.notes && (
        <div className="card" style={{ marginBottom: 20 }}>
          <p className="section-tag">Notas</p>
          <p style={{ fontSize: 14, whiteSpace: 'pre-wrap' }}>{equipo.notes}</p>
        </div>
      )}

      <div className="card" style={{ marginBottom: 20 }}>
        <p className="section-tag">Clientes vinculados</p>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr><th>Cliente</th></tr>
            </thead>
            <tbody>
              {equipo.clients?.length > 0 ? (
                equipo.clients.map(c => <tr key={c.id}><td>{c.client_name}</td></tr>)
              ) : (
                <tr>
                  <td style={{ color: 'var(--clr-text-light)' }}>
                    Sin cliente vinculado. Los clientes ven y vinculan sus propios equipos al registrarlos desde su cuenta.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
