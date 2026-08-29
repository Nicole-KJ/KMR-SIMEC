import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Boxes, PackagePlus, Loader } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { listEquipos, listMyEquipos, getEquipoPhotoUrl } from '../services/equiposService'
import { EQUIPMENT_MODULES } from '../constants/equipmentModules'
import { formatDate } from '../services/supabaseDB'
import { usePagination } from '../hooks/usePagination'
import { logError } from '../utils/logger'
import Pagination from '../components/Pagination'

export default function InventarioEquipos() {
  const navigate = useNavigate()
  const { user, isClient } = useAuth()
  const [equipos, setEquipos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // "Mis Equipos" (client) vs "Inventario" (staff) -- same split as
  // useReports.js's getClientReports/getAllReports.
  const load = useCallback(() => {
    setLoading(true)
    setError('')
    const fetchEquipos = isClient ? listMyEquipos(user.id) : listEquipos()
    fetchEquipos
      // photo_path lives in a private bucket (053) -- resolve each one to a
      // short-lived signed URL up front, same as NewReport.jsx does for
      // existingPhotos, rather than re-signing on every render.
      .then(data => Promise.all(
        data.map(async eq => ({ ...eq, photoUrl: eq.photo_path ? await getEquipoPhotoUrl(eq.photo_path) : null }))
      ))
      .then(setEquipos)
      .catch(err => {
        logError('InventarioEquipos.load', err)
        setError(err.message ?? 'Error al cargar el inventario')
      })
      .finally(() => setLoading(false))
  }, [isClient, user])

  useEffect(() => { load() }, [load])

  const { page, setPage, totalPages, pageItems: paginatedEquipos } = usePagination(equipos)

  return (
    <div className="content-wrapper fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800 }}><Boxes size={22} style={{ verticalAlign: 'middle', marginRight: 8 }} />{isClient ? 'Mis Equipos' : 'Inventario de Equipos'}</h1>
          <p style={{ color: 'var(--clr-text-light)', fontSize: 13, marginTop: 4 }}>
            {isClient ? 'Equipos registrados a tu nombre' : 'Registro de equipos en el sistema'}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/inventario/nuevo')}>
          <PackagePlus size={15} /> Agregar Equipo
        </button>
      </div>

      <div className="card">
        <p className="section-tag">{isClient ? 'Mis equipos' : 'Todos los equipos'}</p>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <Loader size={32} className="spin" color="var(--clr-primary)" />
          </div>
        ) : error ? (
          <div style={{ padding: 16 }}>
            <p style={{ color: 'var(--clr-danger)', fontSize: 14, marginBottom: 12 }}>{error}</p>
            <button className="btn btn-secondary btn-sm" onClick={load}>Reintentar</button>
          </div>
        ) : equipos.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📦</div>
            <p>{isClient ? 'Todavía no tienes equipos registrados' : 'Todavía no hay equipos en el inventario'}</p>
          </div>
        ) : (
          <>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Foto</th>
                    <th>Tipo</th>
                    <th>Marca</th>
                    <th>Modelo</th>
                    <th>Agregado</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedEquipos.map(eq => {
                    const module = EQUIPMENT_MODULES[eq.equipment_type]
                    return (
                      <tr key={eq.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/inventario/${eq.id}`)}>
                        <td onClick={e => e.stopPropagation()}>
                          {eq.photoUrl ? (
                            <a href={eq.photoUrl} target="_blank" rel="noopener noreferrer">
                              <img src={eq.photoUrl} alt={`${eq.brand ?? ''} ${eq.model ?? ''}`}
                                style={{ width: 36, height: 36, borderRadius: 'var(--radius-sm)', objectFit: 'cover', display: 'block' }} />
                            </a>
                          ) : (
                            <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-sm)', background: 'var(--clr-surface-2)' }} />
                          )}
                        </td>
                        <td>{module?.icon} {module?.name ?? eq.equipment_type}</td>
                        <td>{eq.brand || '—'}</td>
                        <td>{eq.model || '—'}</td>
                        <td style={{ color: 'var(--clr-text-light)' }}>{formatDate(eq.created_at)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        )}
      </div>
    </div>
  )
}
