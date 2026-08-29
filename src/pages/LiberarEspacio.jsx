import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, HardDrive, Download, FileX2, Trash2, Loader, X } from 'lucide-react'
import { useReports } from '../hooks/useReports'
import { useReportFilters } from '../hooks/useReportFilters'
import { downloadReportsPDFs, clearCachedPdfs } from '../services/pdfService'
import { deleteReports } from '../services/adminUsersService'
import { useToast } from '../contexts/ToastContext'
import { logError } from '../utils/logger'
import ReportsTable, { ReportsTableSkeleton } from '../components/ReportsTable'
import ReportFilters from '../components/ReportFilters'

export default function LiberarEspacio() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { reports, loading, error, reload } = useReports()

  // Admin-only page (getAllReports() via useReports), so the Técnico column
  // and its filter are always relevant here -- unlike ReportsList, isAdmin
  // isn't conditional on who's viewing.
  const filters = useReportFilters(reports, true)
  const { filteredReports, clearFilters } = filters

  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [downloading, setDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState(null)
  const [clearingPdfs, setClearingPdfs] = useState(false)
  const [clearProgress, setClearProgress] = useState(null)
  const [deleting, setDeleting] = useState(false)

  function toggleSelect(id) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // Both the toolbar button and ReportsTable's own header checkbox operate
  // on the same set: every currently *filtered* report, not just what's on
  // screen -- there's no pagination here to distinguish "page" from "all".
  function toggleSelectAll() {
    const allSelected = filteredReports.length > 0 && filteredReports.every(r => selectedIds.has(r.id))
    setSelectedIds(allSelected ? new Set() : new Set(filteredReports.map(r => r.id)))
  }

  function clearSelection() {
    setSelectedIds(new Set())
  }

  const selected = reports.filter(r => selectedIds.has(r.id))

  async function handleDownload() {
    setDownloading(true)
    setDownloadProgress(null)
    try {
      const result = await downloadReportsPDFs(selected, 'Seleccionados', setDownloadProgress)
      if (result.failed.length > 0) {
        showToast(`Se descargaron ${result.succeeded} de ${result.total} PDFs. ${result.failed.length} fallaron.`, 'warning')
        logError('LiberarEspacio.handleDownload', new Error('Some PDFs failed to download'), { failed: result.failed })
      } else {
        showToast(`Se descargaron ${result.succeeded} PDF(s).`, 'success')
      }
    } catch (err) {
      logError('LiberarEspacio.handleDownload', err)
      showToast('Error al descargar los PDFs: ' + (err.message ?? err))
    } finally {
      setDownloading(false)
    }
  }

  // Frees Storage space without touching the report itself -- the PDF is a
  // derived artifact, regenerated fresh from the report's current data the
  // next time someone downloads it. No confirm dialog: unlike deleting the
  // report, this doesn't lose anything.
  async function handleClearPdfs() {
    setClearingPdfs(true)
    setClearProgress(null)
    try {
      const result = await clearCachedPdfs(selected, setClearProgress)
      if (result.failed.length > 0) {
        showToast(`Se borraron ${result.cleared} PDF(s) en caché. ${result.failed.length} fallaron.`, 'warning')
        logError('LiberarEspacio.handleClearPdfs', new Error('Some cached PDFs failed to clear'), { failed: result.failed })
      } else {
        showToast(`Se borraron ${result.cleared} PDF(s) en caché.`, 'success')
      }
      reload()
    } catch (err) {
      logError('LiberarEspacio.handleClearPdfs', err)
      showToast('Error al borrar los PDFs en caché: ' + (err.message ?? err))
    } finally {
      setClearingPdfs(false)
    }
  }

  async function handleDelete() {
    const confirmMsg = `¿Eliminar ${selected.length} reporte(s) seleccionado(s), incluyendo sus fotos, firmas y PDFs en caché? Esta acción no se puede deshacer.`
    if (!window.confirm(confirmMsg)) return
    setDeleting(true)
    try {
      await deleteReports(selected.map(r => r.id))
      showToast(`${selected.length} reporte(s) eliminado(s).`, 'success')
      clearSelection()
      reload()
    } catch (err) {
      logError('LiberarEspacio.handleDelete', err)
      showToast('Error al eliminar los reportes: ' + (err.message ?? err))
    } finally {
      setDeleting(false)
    }
  }

  const busy = downloading || clearingPdfs || deleting

  return (
    <div className="content-wrapper fade-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <button className="icon-btn" onClick={() => navigate('/admin/configuracion')}><ArrowLeft size={18} /></button>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>
            <HardDrive size={20} style={{ verticalAlign: 'middle', marginRight: 8 }} />Liberar Espacio de Almacenamiento
          </h1>
          <p style={{ color: 'var(--clr-text-light)', fontSize: 13 }}>
            Selecciona reportes para descargar sus PDFs y/o eliminarlos junto con sus fotos y firmas.
          </p>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>
              {selectedIds.size} reporte(s) seleccionado(s)
            </span>
            <button className="btn btn-secondary btn-sm" onClick={toggleSelectAll} disabled={busy || filteredReports.length === 0}>
              Seleccionar todos
            </button>
            <button className="btn btn-secondary btn-sm" onClick={clearSelection} disabled={busy || selectedIds.size === 0}>
              Deseleccionar todos
            </button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <button className="btn btn-secondary" onClick={handleDownload} disabled={busy || selectedIds.size === 0}>
              {downloading
                ? <><Loader size={14} className="spin" /> Descargando {downloadProgress ? `${downloadProgress.done}/${downloadProgress.total}` : '...'}</>
                : <><Download size={14} /> Descargar PDFs (ZIP)</>}
            </button>
            <button className="btn btn-secondary" onClick={handleClearPdfs} disabled={busy || selectedIds.size === 0}>
              {clearingPdfs
                ? <><Loader size={14} className="spin" /> Borrando {clearProgress ? `${clearProgress.done}/${clearProgress.total}` : '...'}</>
                : <><FileX2 size={14} /> Borrar PDFs en caché</>}
            </button>
            <button className="btn btn-secondary" style={{ color: 'var(--clr-danger)', borderColor: 'var(--clr-danger)' }}
              onClick={handleDelete} disabled={busy || selectedIds.size === 0}>
              {deleting ? <><Loader size={14} className="spin" /> Eliminando...</> : <><Trash2 size={14} /> Eliminar Reportes</>}
            </button>
          </div>
        </div>

        {!loading && reports.length > 0 && <ReportFilters {...filters} isAdmin />}

        {loading ? (
          <ReportsTableSkeleton isAdmin />
        ) : error ? (
          <div className="empty-state">
            <div className="empty-icon">⚠️</div>
            <p>No se pudieron cargar los reportes</p>
            <br />
            <button className="btn btn-primary" onClick={reload}>Reintentar</button>
          </div>
        ) : reports.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <p>No hay reportes aún</p>
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
          <ReportsTable
            reports={filteredReports}
            isAdmin
            selectable
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onToggleSelectAll={toggleSelectAll}
          />
        )}

        {!loading && reports.length > 0 && (
          <p style={{ fontSize: 12, color: 'var(--clr-text-light)', marginTop: 12 }}>
            Mostrando {filteredReports.length} de {reports.length} reporte(s).
          </p>
        )}
      </div>
    </div>
  )
}
