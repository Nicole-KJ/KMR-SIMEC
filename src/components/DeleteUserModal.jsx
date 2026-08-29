import { useState } from 'react'
import { X, Loader, Check, AlertCircle } from 'lucide-react'
import { deleteUserReports, deleteUser } from '../services/adminUsersService'
import { regenerateReportsPDFsForUser, downloadReportsPDFsForUser } from '../services/pdfService'
import { logError } from '../utils/logger'
import { useToast } from '../contexts/ToastContext'

// Sequential 4-step teardown for permanently removing a user:
//   1. Regenerar PDFs en caché  ->  2. Descargar PDFs  ->
//   3. Eliminar reportes (+ fotos/firmas)  ->  4. Eliminar Usuario
// Each step only unlocks once the previous one finishes successfully, since
// each is a prerequisite for the next -- you can't safely delete a report
// before its PDF is archived, and you can't delete the user while their
// reports (an FK, ON DELETE NO ACTION) still exist. Steps 3 and 4 are each
// independently destructive, so each gets its own "are you sure" on top of
// this modal's own warning.
const STEPS = ['regenerate', 'download', 'deleteReports', 'deleteUser']

export default function DeleteUserModal({ user, onClose, onDeleted }) {
  const { showToast } = useToast()
  const [status, setStatus] = useState({ regenerate: 'idle', download: 'idle', deleteReports: 'idle', deleteUser: 'idle' })
  const [progress, setProgress] = useState({})
  const [errorMsg, setErrorMsg] = useState({})

  const enabled = {
    regenerate: status.regenerate !== 'running',
    download: status.regenerate === 'done' && status.download !== 'running',
    deleteReports: status.download === 'done' && status.deleteReports !== 'running',
    deleteUser: status.deleteReports === 'done' && status.deleteUser !== 'running',
  }

  function setStepStatus(step, value) {
    setStatus(prev => ({ ...prev, [step]: value }))
  }

  async function handleRegenerate() {
    setStepStatus('regenerate', 'running')
    setErrorMsg(prev => ({ ...prev, regenerate: null }))
    try {
      const result = await regenerateReportsPDFsForUser(user.id, p => setProgress(prev => ({ ...prev, regenerate: p })))
      if (result.failed.length > 0) throw new Error(`${result.failed.length} de ${result.total} PDFs no se pudieron regenerar`)
      setStepStatus('regenerate', 'done')
    } catch (err) {
      logError('DeleteUserModal.handleRegenerate', err)
      setStepStatus('regenerate', 'error')
      setErrorMsg(prev => ({ ...prev, regenerate: err.message ?? 'Error al regenerar los PDFs' }))
    }
  }

  async function handleDownload() {
    setStepStatus('download', 'running')
    setErrorMsg(prev => ({ ...prev, download: null }))
    try {
      const result = await downloadReportsPDFsForUser(user.id, user.full_name || user.email, p => setProgress(prev => ({ ...prev, download: p })))
      if (result.failed.length > 0) throw new Error(`${result.failed.length} de ${result.total} PDFs no se pudieron descargar`)
      setStepStatus('download', 'done')
    } catch (err) {
      logError('DeleteUserModal.handleDownload', err)
      setStepStatus('download', 'error')
      setErrorMsg(prev => ({ ...prev, download: err.message ?? 'Error al descargar los PDFs' }))
    }
  }

  async function handleDeleteReports() {
    if (!window.confirm('¿Estás seguro de eliminar todos los reportes de este usuario, incluyendo sus imágenes y firmas? Esta acción no se puede deshacer.')) return
    setStepStatus('deleteReports', 'running')
    setErrorMsg(prev => ({ ...prev, deleteReports: null }))
    try {
      await deleteUserReports(user.id)
      setStepStatus('deleteReports', 'done')
    } catch (err) {
      logError('DeleteUserModal.handleDeleteReports', err)
      setStepStatus('deleteReports', 'error')
      setErrorMsg(prev => ({ ...prev, deleteReports: err.message ?? 'Error al eliminar los reportes' }))
    }
  }

  async function handleDeleteUser() {
    if (!window.confirm('¿Estás seguro de eliminar a este usuario? Esta acción no se puede deshacer.')) return
    setStepStatus('deleteUser', 'running')
    setErrorMsg(prev => ({ ...prev, deleteUser: null }))
    try {
      await deleteUser(user.id)
      setStepStatus('deleteUser', 'done')
      showToast('Usuario eliminado', 'success')
      setTimeout(() => onDeleted?.(), 600)
    } catch (err) {
      logError('DeleteUserModal.handleDeleteUser', err)
      setStepStatus('deleteUser', 'error')
      setErrorMsg(prev => ({ ...prev, deleteUser: err.message ?? 'Error al eliminar el usuario' }))
    }
  }

  const HANDLERS = { regenerate: handleRegenerate, download: handleDownload, deleteReports: handleDeleteReports, deleteUser: handleDeleteUser }
  const LABELS = {
    regenerate: 'Regenerar PDFs en caché de este usuario',
    download: 'Descargar PDFs de este usuario',
    deleteReports: 'Eliminar reportes de este usuario, incluyendo imágenes y firmas relacionadas',
    deleteUser: 'Eliminar Usuario',
  }

  const anyRunning = STEPS.some(s => status[s] === 'running')

  function renderStep(step) {
    const s = status[step]
    const p = progress[step]
    return (
      <div key={step} style={{ marginBottom: 12 }}>
        <button
          className={`btn ${step === 'deleteUser' || step === 'deleteReports' ? 'btn-secondary' : 'btn-primary'} btn-block`}
          style={s === 'done'
            ? { color: 'var(--clr-success)', borderColor: 'var(--clr-success)' }
            : (step === 'deleteUser' || step === 'deleteReports') ? { color: 'var(--clr-danger)', borderColor: 'var(--clr-danger)' } : undefined}
          disabled={!enabled[step] || s === 'done'}
          onClick={HANDLERS[step]}
        >
          {s === 'running' ? (
            <><Loader size={14} className="spin" /> {p ? `Procesando ${p.done}/${p.total}...` : 'Procesando...'}</>
          ) : s === 'done' ? (
            <><Check size={14} /> {LABELS[step]}</>
          ) : LABELS[step]}
        </button>
        {errorMsg[step] && (
          <p style={{ color: 'var(--clr-danger)', fontSize: 12, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
            <AlertCircle size={12} /> {errorMsg[step]}
          </p>
        )}
      </div>
    )
  }

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget && !anyRunning) onClose() }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 200, padding: 16,
      }}
    >
      <div className="card fade-in" style={{ maxWidth: 520, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <p className="section-tag" style={{ marginBottom: 0 }}>Eliminar Usuario</p>
          <button className="icon-btn" onClick={onClose} disabled={anyRunning}><X size={16} /></button>
        </div>

        <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
          {user.full_name || user.email}
        </p>

        <p style={{ fontSize: 13, color: 'var(--clr-text-light)', marginBottom: 16 }}>
          Para eliminar a este usuario primero debes regenerar los PDFs en caché de sus reportes,
          descargarlos, y eliminar todos sus reportes junto con las imágenes y firmas relacionadas.
          Solo entonces podrás eliminar al usuario. <strong style={{ color: 'var(--clr-danger)' }}>Esta acción no se puede deshacer.</strong>
        </p>

        {STEPS.map(renderStep)}
      </div>
    </div>
  )
}
