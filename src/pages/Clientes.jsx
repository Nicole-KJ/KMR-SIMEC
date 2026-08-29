import { useNavigate } from 'react-router-dom'
import { Loader, Users } from 'lucide-react'
import { useClientsDirectory } from '../hooks/useClientsDirectory'
import { usePagination } from '../hooks/usePagination'
import Pagination from '../components/Pagination'

export default function Clientes() {
  const navigate = useNavigate()
  const { clients, loading, error, reload: loadClients } = useClientsDirectory()

  const { page, setPage, totalPages, pageItems: paginatedClients } = usePagination(clients)

  return (
    <div className="content-wrapper fade-in">
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}><Users size={22} style={{ verticalAlign: 'middle', marginRight: 8 }} />Clientes</h1>
        <p style={{ color: 'var(--clr-text-light)', fontSize: 13, marginTop: 4 }}>Gestiona el acceso de clientes a K Maintenance Report</p>
      </div>

      {/* Clients list */}
      <div className="card">
        <p className="section-tag">Todos los clientes</p>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <Loader size={32} className="spin" color="var(--clr-primary)" />
          </div>
        ) : error ? (
          <div style={{ padding: 16 }}>
            <p style={{ color: 'var(--clr-danger)', fontSize: 14, marginBottom: 12 }}>{error}</p>
            <button className="btn btn-secondary btn-sm" onClick={loadClients}>Reintentar</button>
          </div>
        ) : (
          <>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Correo</th>
                    <th>Nombre</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedClients.map(c => (
                    <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/clientes/${encodeURIComponent(c.id)}`)}>
                      <td>{c.email || '—'}</td>
                      <td>{c.full_name || '—'}</td>
                      <td onClick={e => e.stopPropagation()}></td>
                    </tr>
                  ))}
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