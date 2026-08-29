import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FilePlus, X, FileText } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useReports } from '../hooks/useReports'
import { usePagination } from '../hooks/usePagination'
import { useReportFilters } from '../hooks/useReportFilters'
import ReportsTable, { ReportsTableSkeleton } from '../components/ReportsTable'
import ReportFilters from '../components/ReportFilters'
import Pagination from '../components/Pagination'

export default function ReportsList() {
  const navigate = useNavigate()
  const { isAdmin, isClient } = useAuth()
  const { reports, loading, error, reload } = useReports()

  const filters = useReportFilters(reports, isAdmin)
  const { filteredReports, clearFilters,
    searchQuery, technicianFilter, statusFilter, equipmentFilter, dateFrom, dateTo } = filters

  const { page, setPage, totalPages, pageItems: paginatedReports } = usePagination(filteredReports)

  useEffect(() => {
    setPage(1)
  }, [searchQuery, technicianFilter, statusFilter, equipmentFilter, dateFrom, dateTo, setPage])

  return (
    <div className="content-wrapper fade-in">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:28 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800 }}><FileText size={22} style={{ verticalAlign: 'middle', marginRight: 8 }} />{isAdmin ? 'Todos los Reportes' : 'Mis Reportes'}</h1>
          <p style={{ color:'var(--clr-text-light)', fontSize:13, marginTop:4 }}>Busca y filtra todos los informes de servicio</p>
        </div>
        {!isClient && (
          <button className="btn btn-primary" onClick={() => navigate('/nuevo-reporte')}>
            <FilePlus size={16} /> Nuevo Reporte
          </button>
        )}
      </div>

      <div className="card">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <h3 style={{ fontSize:17, fontWeight:700 }}>Reportes</h3>
          {!loading && reports.length > 0 && (
            <span style={{ fontSize:13, color:'var(--clr-text-light)' }}>
              Mostrando {paginatedReports.length ? (page - 1) * 10 + 1 : 0}-{(page - 1) * 10 + paginatedReports.length} de {filteredReports.length}
            </span>
          )}
        </div>

        {!loading && reports.length > 0 && <ReportFilters {...filters} isAdmin={isAdmin} />}

        {loading ? (
          <ReportsTableSkeleton isAdmin={isAdmin} />
        ) : error ? (
          <div className="empty-state">
            <div className="empty-icon">⚠️</div>
            <p>No se pudieron cargar los reportes</p>
            <span>Verifica tu conexión e intenta de nuevo</span>
            <br /><br />
            <button className="btn btn-primary" onClick={reload}>Reintentar</button>
          </div>
        ) : reports.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <p>No hay reportes aún</p>
            {isClient ? (
              <span>Aún no tienes reportes asignados</span>
            ) : (
              <>
                <span>Crea tu primer informe de servicio</span>
                <br /><br />
                <button className="btn btn-primary" onClick={() => navigate('/nuevo-reporte')}>
                  <FilePlus size={16} /> Crear Reporte
                </button>
              </>
            )}
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🔍</div>
            <p>Ningún reporte coincide con los filtros</p>
            <span>Ajusta o limpia los filtros para ver más resultados</span>
            <br /><br />
            <button className="btn btn-secondary" onClick={clearFilters}>
              <X size={16} /> Limpiar Filtros
            </button>
          </div>
        ) : (
          <>
            <ReportsTable reports={paginatedReports} isAdmin={isAdmin} />
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        )}
      </div>
    </div>
  )
}
