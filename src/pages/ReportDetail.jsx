import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, PenLine, Share2, Download, Mail, CheckCircle, Loader, Pencil, Trash2, X, RefreshCw } from 'lucide-react'
import { getReport, getPhotoUrl, getEquipmentFileUrl, deleteReport, formatDate } from '../services/supabaseDB'
import { useAuth } from '../contexts/AuthContext'
import { downloadReportPDF, regenerateReportPDF } from '../services/pdfService'
import { sendReportByEmail } from '../services/emailService'
import { EQUIPMENT_MODULES } from '../constants/equipmentModules'
import { STATUS_LABELS as EVENT_STATUS_LABELS } from '../constants/eventStatus'
import { MeasurementItem, ChecklistItem } from '../components/EquipmentGeneric/shared'
import GenericModuleDetail from '../components/EquipmentGeneric/GenericModuleDetail'
import { useToast } from '../contexts/ToastContext'
import { logError } from '../utils/logger'
import { SkeletonBlock } from '../components/Skeleton'
import { useBackNavigate } from '../hooks/useBackNavigate'
import SignatureModal from '../components/SignatureModal'

const UPS_ACTIVITIES_LABELS = EQUIPMENT_MODULES.ups.activitiesLabels
const UPS_TESTS_LABELS = EQUIPMENT_MODULES.ups.testsLabels
const AC_WORK_LABELS = EQUIPMENT_MODULES.ac.workLabels
const AC_SUBTYPE_LABELS = EQUIPMENT_MODULES.ac.subtypeLabels
const AC_EQUIP_LABELS = EQUIPMENT_MODULES.ac.equipLabels

const PHOTO_TYPE_LABELS = { equipo: '📷 Fotos del Equipo', antes: '⏮️ Fotos Antes', despues: '⏭️ Fotos Después' }

export default function ReportDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const goBack = useBackNavigate()
  const { isAdmin, isClient } = useAuth()
  const { showToast } = useToast()
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [regeneratingPdf, setRegeneratingPdf] = useState(false)
  const [emailLoading, setEmailLoading] = useState(false)
  const [clientEmail, setClientEmail] = useState('')
  const [showEmailForm, setShowEmailForm] = useState(false)
  const [emailResult, setEmailResult] = useState(null)
  const [copySuccess, setCopySuccess] = useState(false)
  const [showSignatureModal, setShowSignatureModal] = useState(false)
  const [photoUrls, setPhotoUrls] = useState({})
  const [previewPhoto, setPreviewPhoto] = useState(null)
  const [equipmentFileUrls, setEquipmentFileUrls] = useState({})
  const [deleting, setDeleting] = useState(false)
  const [loadError, setLoadError] = useState(null)

  async function loadReport({ silent } = {}) {
    if (!silent) { setLoading(true); setLoadError(null) }
    try {
      const r = await getReport(id)
      setReport(r)
    } catch (err) {
      logError('ReportDetail.load', err)
      if (!silent) setLoadError(err)
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    loadReport()

    // Re-fetch when user returns to this tab (e.g. after signing in another tab).
    // Silent: don't disrupt an already-loaded view over a background refresh blip.
    function handleFocus() { loadReport({ silent: true }) }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [id])

  // Let Escape close the photo preview, same as clicking the backdrop/close button
  useEffect(() => {
    if (!previewPhoto) return
    function handleKeyDown(e) { if (e.key === 'Escape') setPreviewPhoto(null) }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [previewPhoto])

  // Photos live in a private Storage bucket — resolve a short-lived signed URL for each
  useEffect(() => {
    if (!report?.photos?.length) return
    let cancelled = false
    Promise.all(report.photos.map(async p => [p.id, await getPhotoUrl(p.storage_path)]))
      .then(entries => { if (!cancelled) setPhotoUrls(Object.fromEntries(entries)) })
    return () => { cancelled = true }
  }, [report?.photos])

  // Same idea for any generic module's readingsGroup file attachment (e.g.
  // Batería's Mediciones) — keyed by group so more than one could exist.
  useEffect(() => {
    const groups = EQUIPMENT_MODULES[report?.equipment_type]?.readingsGroups?.filter(g => g.fileUpload) ?? []
    const withFile = groups
      .map(g => [g.key, report?.equipment_data?.[g.key]?.attached_file?.storage_path])
      .filter(([, path]) => path)
    if (withFile.length === 0) return
    let cancelled = false
    Promise.all(withFile.map(async ([key, path]) => [key, await getEquipmentFileUrl(path)]))
      .then(entries => { if (!cancelled) setEquipmentFileUrls(Object.fromEntries(entries)) })
    return () => { cancelled = true }
  }, [report])

  if (loading) return (
    <div className="content-wrapper fade-in">
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:28 }}>
        <SkeletonBlock width={36} height={36} style={{ borderRadius: 'var(--radius-md)' }} />
        <div style={{ flex:1 }}>
          <SkeletonBlock width={160} height={22} style={{ marginBottom:8 }} />
          <SkeletonBlock width={100} height={13} />
        </div>
        <SkeletonBlock width={90} height={26} style={{ borderRadius: 'var(--radius-full)' }} />
      </div>
      <div style={{ display:'flex', gap:10, marginBottom:24, flexWrap:'wrap' }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonBlock key={i} width={130} height={38} style={{ borderRadius: 'var(--radius-md)' }} />
        ))}
      </div>
      <div className="report-detail-grid" style={{ display:'grid', gap:20 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div className="card" key={i}>
            <SkeletonBlock width={80} height={18} style={{ marginBottom:16, borderRadius: 'var(--radius-full)' }} />
            <SkeletonBlock width="90%" height={14} style={{ marginBottom:10 }} />
            <SkeletonBlock width="70%" height={14} style={{ marginBottom:10 }} />
            <SkeletonBlock width="80%" height={14} />
          </div>
        ))}
      </div>
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
            <button className="btn btn-primary" onClick={() => loadReport()}>Reintentar</button>
            <button className="btn btn-secondary" onClick={() => navigate('/dashboard')}>Volver al Dashboard</button>
          </div>
        </div>
      </div>
    </div>
  )

  if (!report) return null

  const statusLabel = { signed: 'Firmado ✓', completed: 'Completado', draft: 'Borrador' }
  const badgeClass  = { signed: 'badge-signed', completed: 'badge-completed', draft: 'badge-draft' }
  const sigLink = `${window.location.origin}/firma/${report.id}`
  const ed = report.equipment_data
  const hasEquipData = ed && Object.keys(ed).length > 0
  const isUPS = report.equipment_type === 'ups'
  const isAC = report.equipment_type === 'ac'
  const moduleConfig = EQUIPMENT_MODULES[report.equipment_type]
  const isGeneric = moduleConfig?.kind === 'generic'
  // Trabajos Varios only ever shows Encabezado/Cliente/Técnicos/Descripción
  // del Trabajo -- no Equipo, generic module detail, Repuestos or Fotos,
  // matching NewReport.jsx's own form for this equipment type.
  const isTrabajosVarios = report.equipment_type === 'trabajos_varios'
  // Loading the report at all already proves RLS let this user in -- creator,
  // admin, or a listed técnico (see is_report_technician, 027). Any admin
  // gets a full edit here, not just a técnico listed on this report (049).
  const canEdit = !isClient && report.status !== 'signed'

  function copyLink() {
    navigator.clipboard.writeText(sigLink)
    setCopySuccess(true)
    setTimeout(() => setCopySuccess(false), 2500)
  }

  async function handleDelete() {
    if (!window.confirm(`¿Eliminar el reporte #${String(report.report_number ?? 0).padStart(4, '0')}? Esta acción no se puede deshacer.`)) return
    setDeleting(true)
    try {
      await deleteReport(report.id)
      navigate('/dashboard')
    } catch (err) {
      logError('ReportDetail.handleDelete', err)
      showToast('Error al eliminar el reporte: ' + (err.message ?? err))
      setDeleting(false)
    }
  }

  async function handleDownloadPDF() {
    setPdfLoading(true)
    try {
      const { pdfStoragePath } = await downloadReportPDF(report)
      if (pdfStoragePath && pdfStoragePath !== report.pdf_storage_path) {
        setReport(prev => ({ ...prev, pdf_storage_path: pdfStoragePath }))
      }
    } catch (err) {
      logError('ReportDetail.handleDownloadPDF', err)
      showToast('Error generando PDF: ' + (err.message ?? err))
    } finally {
      setPdfLoading(false)
    }
  }

  async function handleRegenerateCachedPDF() {
    setRegeneratingPdf(true)
    try {
      const { pdfStoragePath } = await regenerateReportPDF(report.id)
      setReport(prev => ({ ...prev, pdf_storage_path: pdfStoragePath }))
      showToast('PDF regenerado.', 'success')
    } catch (err) {
      logError('ReportDetail.handleRegenerateCachedPDF', err)
      showToast('Error al regenerar el PDF: ' + (err.message ?? err))
    } finally {
      setRegeneratingPdf(false)
    }
  }

  async function handleSendEmail(e) {
    e.preventDefault()
    if (!clientEmail) return
    setEmailLoading(true)
    setEmailResult(null)
    try {
      const result = await sendReportByEmail(report, clientEmail)
      setEmailResult(result)
      if (result.success) {
        setShowEmailForm(false)
        setClientEmail('')
      }
    } catch (err) {
      setEmailResult({ success: false, message: err.message })
    } finally {
      setEmailLoading(false)
    }
  }

  // Render UPS condition section (entry or output)
  function renderConditionDetail(cond, title, icon) {
    if (!cond) return null
    const isThree = ed.phase_type === 'three'
    return (
      <div className="card" style={{ gridColumn:'span 2' }}>
        <p className="section-tag">{icon} {title}</p>
        <div style={{ marginBottom:12 }}>
          <p style={{ fontSize:12, fontWeight:700, color:'var(--clr-text-light)', marginBottom:8, textTransform:'uppercase' }}>Voltaje</p>
          <div className="detail-measurement-grid">
            <MeasurementItem label="L1" value={cond.l1} />
            <MeasurementItem label="L2" value={cond.l2} />
            {isThree && <MeasurementItem label="L3" value={cond.l3} />}
            <MeasurementItem label="N" value={cond.n} />
            <MeasurementItem label="T" value={cond.t} />
          </div>
        </div>
        <div style={{ marginBottom:12 }}>
          <p style={{ fontSize:12, fontWeight:700, color:'var(--clr-text-light)', marginBottom:8, textTransform:'uppercase' }}>Corriente</p>
          <div className="detail-measurement-grid">
            <MeasurementItem label="L1" value={cond.current_l1} />
            <MeasurementItem label="L2" value={cond.current_l2} />
            {isThree && <MeasurementItem label="L3" value={cond.current_l3} />}
            <MeasurementItem label="Neutro" value={cond.current_neutral} />
            <MeasurementItem label="Tierra" value={cond.current_ground} />
          </div>
        </div>
        {(cond.visual_state || cond.observations) && (
          <div style={{ display:'flex', gap:16, flexWrap:'wrap', marginTop:8 }}>
            {cond.visual_state && (
              <div><span style={{ fontSize:12, fontWeight:700, color:'var(--clr-text-light)' }}>Estado visual: </span>
              <span style={{ fontSize:14, fontWeight:600, textTransform:'capitalize' }}>{cond.visual_state}</span></div>
            )}
            {cond.observations && (
              <div><span style={{ fontSize:12, fontWeight:700, color:'var(--clr-text-light)' }}>Obs: </span>
              <span style={{ fontSize:14 }}>{cond.observations}</span></div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="content-wrapper fade-in">
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:28 }}>
        <button className="icon-btn" onClick={goBack}><ArrowLeft size={18} /></button>
        <div style={{ flex:1 }}>
          <h1 style={{ fontSize:22, fontWeight:800 }}>
            Reporte #{String(report.report_number ?? 0).padStart(4,'0')}
          </h1>
          <p style={{ color:'var(--clr-text-light)', fontSize:13 }}>
            {report.equipment_type?.toUpperCase()} · {formatDate(report.report_date)}
          </p>
        </div>
        <span className={`badge ${badgeClass[report.status] || 'badge-draft'}`} style={{ fontSize:13, padding:'6px 14px' }}>
          {statusLabel[report.status] || report.status}
        </span>
      </div>

      {/* Email result notification */}
      {emailResult && (
        <div style={{
          background: emailResult.success ? 'var(--clr-success-bg)' : 'var(--clr-warning-bg)',
          color: emailResult.success ? 'var(--clr-success)' : 'var(--clr-warning)',
          border: `1.5px solid ${emailResult.success ? 'var(--clr-success)' : 'var(--clr-warning)'}`,
          padding: '12px 16px', borderRadius: 'var(--radius-md)',
          marginBottom: 20, fontWeight: 600, fontSize: 14
        }}>
          {emailResult.success ? '✅ ' : '⚠️ '}{emailResult.message}
          {!emailResult.success && (
            <p style={{ fontWeight: 400, fontSize: 12, marginTop: 6, color: 'var(--clr-warning)' }}>
              Para enviar correos a cualquier destinatario, verifica el dominio <strong>simec-cr.com</strong> en
              {' '}<a href="https://resend.com/domains" target="_blank" rel="noopener" style={{ color: 'var(--clr-primary)' }}>resend.com/domains</a>.
              Por ahora solo puedes enviar al correo de tu cuenta Resend.
            </p>
          )}
        </div>
      )}

      {/* Actions */}
      <div style={{ display:'flex', gap:10, marginBottom:24, flexWrap:'wrap', alignItems:'flex-start' }}>
        {!isClient && report.pdf_storage_path && (
          <button className="btn btn-secondary" onClick={handleRegenerateCachedPDF} disabled={regeneratingPdf}>
            {regeneratingPdf ? <Loader size={16} className="spin" /> : <RefreshCw size={16} />}
            {regeneratingPdf ? 'Regenerando...' : 'Regenerar PDF en Caché'}
          </button>
        )}
        {/* A client can't download while it's still a draft -- nothing final
            to hand them yet -- but can once staff marks it completed, even
            before it's signed. Staff can always download, at any status,
            same as before. */}
        {(!isClient || report.status === 'completed' || report.status === 'signed') && (
          <button className="btn btn-primary" onClick={handleDownloadPDF} disabled={pdfLoading}>
            {pdfLoading ? <Loader size={16} className="spin" /> : <Download size={16} />}
            {pdfLoading ? 'Generando PDF...' : 'Descargar PDF'}
          </button>
        )}
        {!isClient && (
          <button className="btn btn-secondary" onClick={() => {
            if (!showEmailForm && !clientEmail && report.client_email) setClientEmail(report.client_email)
            setShowEmailForm(!showEmailForm)
          }}>
            <Mail size={16} /> Enviar por Correo
          </button>
        )}
        {report.status === 'signed' ? (
          <button className="btn btn-secondary" style={{ color:'var(--clr-success)', borderColor:'var(--clr-success)' }}
            onClick={() => setShowSignatureModal(true)}>
            <CheckCircle size={16} /> Ver Firma
          </button>
        ) : report.status === 'completed' && (
          // A report can only be signed once it's marked completed --
          // signing a draft would finalize work that isn't actually done
          // yet. Enforced at the DB layer too (sign_report, 057) since the
          // signing link is a public, unauthenticated URL -- this is just
          // keeping the button consistent with what that RPC will actually
          // allow, for staff and clients alike.
          <button className="btn btn-primary"
            style={{ background: 'linear-gradient(135deg, #10B981, #059669)', boxShadow: '0 4px 14px rgba(16,185,129,0.35)' }}
            onClick={() => setShowSignatureModal(true)}>
            <PenLine size={16} /> Firmar Reporte
          </button>
        )}
        {!isClient && report.status === 'completed' && (
          <button className="btn btn-secondary" onClick={copyLink}>
            <Share2 size={16} /> {copySuccess ? '¡Enlace Copiado!' : 'Copiar Enlace de Firma'}
          </button>
        )}
        {canEdit && (
          <button className="btn btn-secondary" onClick={() => navigate(`/reporte/${report.id}/editar`)}>
            <Pencil size={16} /> Editar
          </button>
        )}
        {isAdmin && (
          <button className="btn btn-secondary" style={{ color:'var(--clr-danger)', borderColor:'var(--clr-danger)' }}
            onClick={handleDelete} disabled={deleting}>
            {deleting ? <Loader size={16} className="spin" /> : <Trash2 size={16} />} Eliminar
          </button>
        )}
      </div>

      {/* Email form */}
      {showEmailForm && (
        <div className="card fade-in" style={{ marginBottom:20, background:'var(--clr-info-bg)', border:'1.5px solid var(--clr-primary)' }}>
          <p className="section-tag">Enviar reporte por correo</p>
          <form onSubmit={handleSendEmail} style={{ display:'flex', gap:10, alignItems:'flex-end', flexWrap:'wrap', marginTop:8 }}>
            <div className="form-group" style={{ flex:1, minWidth:240, marginBottom:0 }}>
              <label className="form-label">Correo del cliente <span>*</span></label>
              <input type="email" className="form-control" placeholder="cliente@empresa.com"
                value={clientEmail} onChange={e => setClientEmail(e.target.value)} required />
            </div>
            <button type="submit" className="btn btn-primary" disabled={emailLoading}>
              {emailLoading ? <><Loader size={15} className="spin" /> Enviando...</> : <><Mail size={15} /> Enviar PDF</>}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setShowEmailForm(false)}>
              Cancelar
            </button>
          </form>
          <p style={{ fontSize:12, color:'var(--clr-text-light)', marginTop:8 }}>
            Se enviará el PDF del reporte adjunto al correo indicado.
          </p>
        </div>
      )}

      {/* Report content */}
      <div className="report-detail-grid" style={{ display:'grid', gap:20 }}>

        {/* Linked event -- an event can have more than one report linked to
            it, so this doesn't imply exclusivity in either direction. Only
            shows up if report.event embedded successfully (it's null both
            when there's no event_id and when RLS can't resolve it, e.g. a
            técnico who no longer has access to that event -- either way,
            nothing to show). */}
        {report.event && (
          <div className="card">
            <p className="section-tag">Evento Vinculado</p>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:10, marginBottom:12 }}>
              <div>
                <p style={{ fontSize:14, fontWeight:600 }}>{report.event.client_name || 'Sin cliente'}</p>
                <p style={{ fontSize:12, color:'var(--clr-text-light)' }}>
                  {formatDate(report.event.event_date)}{report.event.event_time ? ` · ${report.event.event_time.slice(0,5)}` : ''}
                </p>
              </div>
              <span className={`badge badge-${report.event.status}`}>{EVENT_STATUS_LABELS[report.event.status] || report.event.status}</span>
            </div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate(`/eventos/${report.event.id}`)}>
              Ver Evento
            </button>
          </div>
        )}

        {/* Client */}
        <div className="card">
          <p className="section-tag">Cliente</p>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <tbody>
              {[
                ['Nombre', report.client_name],
                ['Dirección', report.client_address],
                ['Correo', report.client_email],
                ['Fecha', formatDate(report.report_date)],
                ['SC', report.sc_code],
                ['Proyecto', report.project_name],
                ['Evento', report.event?.event_code],
                ['Nombre del Evento', report.event?.event_name],
              ].map(([k,v]) => v ? (
                <tr key={k}>
                  <td style={{ padding:'6px 0', color:'var(--clr-text-light)', fontSize:13, width:'40%', fontWeight:600 }}>{k}</td>
                  <td style={{ padding:'6px 0', fontSize:14, wordBreak:'break-word' }}>{v}</td>
                </tr>
              ) : null)}
            </tbody>
          </table>
        </div>

        {/* Equipment */}
        {!isTrabajosVarios && (
        <div className="card">
          <p className="section-tag">Equipo</p>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <tbody>
              {[
                ['Tipo', report.equipment_type?.toUpperCase()],
                ['Marca', report.brand],
                ['Modelo', report.model],
                ['Serie', report.serial_number],
                ['Activo', report.asset_number],
                ['Ubicación', report.location],
              ].map(([k,v]) => v ? (
                <tr key={k}>
                  <td style={{ padding:'6px 0', color:'var(--clr-text-light)', fontSize:13, width:'40%', fontWeight:600 }}>{k}</td>
                  <td style={{ padding:'6px 0', fontSize:14, wordBreak:'break-word' }}>{v}</td>
                </tr>
              ) : null)}
            </tbody>
          </table>
        </div>
        )}

        {/* ══════ UPS EQUIPMENT DATA ══════ */}
        {hasEquipData && isUPS && (<>
          {/* Contrato */}
          <div className="card" style={{ gridColumn:'span 2' }}>
            <p className="section-tag">📋 Contrato y Contacto</p>
            <div className="detail-measurement-grid">
              <MeasurementItem label="Contratado" value={ed.maintenance_contracted ? 'SÍ' : 'NO'} />
              <MeasurementItem label="Proveedor" value={ed.provider} />
              <MeasurementItem label="Contacto" value={ed.contact} />
              <MeasurementItem label="Tipo de Red" value={ed.phase_type === 'three' ? 'Trifásico (3F)' : 'Monofásico (1F)'} />
              <MeasurementItem label="Potencia" value={ed.ups_power} />
              <MeasurementItem label="Capacidad" value={ed.capacity} />
            </div>
          </div>

          {/* Network Card */}
          <div className="card" style={{ gridColumn:'span 2' }}>
            <p className="section-tag">🌐 Revisión de estado de la tarjeta de red</p>
            <div className="detail-measurement-grid">
              <MeasurementItem label="Cuenta con tarjeta de red" value={ed.network_card?.has_card ? 'SÍ' : 'NO'} />
              <MeasurementItem label="Comunica" value={ed.network_card?.communicates ? 'SÍ' : 'NO'} />
              <MeasurementItem label="Descarga histórico del UPS" value={ed.network_card?.downloads_history ? 'SÍ' : 'NO'} />
              <MeasurementItem label="Protocolo" value={ed.network_card?.protocol} />
            </div>
          </div>

          {/* Entry Condition */}
          {ed.entry_condition && renderConditionDetail(ed.entry_condition, 'Condición de Entrada', '⚡')}

          {/* Environmental */}
          <div className="card">
            <p className="section-tag">🌡️ Condiciones Ambientales</p>
            <div className="detail-measurement-grid">
              <MeasurementItem label="Temperatura" value={ed.environmental?.temperature ? `${ed.environmental.temperature} °C` : ''} />
              <MeasurementItem label="Humedad" value={ed.environmental?.humidity ? `${ed.environmental.humidity} %` : ''} />
              <MeasurementItem label="Altitud" value={ed.environmental?.altitude ? `${ed.environmental.altitude} msnm` : ''} />
            </div>
          </div>

          {/* Batteries */}
          <div className="card">
            <p className="section-tag">🔋 Baterías</p>
            <div className="detail-measurement-grid">
              <MeasurementItem label="Calibre" value={ed.batteries?.caliber} />
              <MeasurementItem label="Cantidad" value={ed.batteries?.bat_quantity} />
              <MeasurementItem label="N° Banco" value={ed.batteries?.bank_number} />
              <MeasurementItem label="Voltaje" value={ed.batteries?.v_batt} />
            </div>
            {ed.batteries?.observations && (
              <p style={{ fontSize:13, color:'var(--clr-text-light)', marginTop:8 }}>Obs: {ed.batteries.observations}</p>
            )}
          </div>

          {/* Output Condition */}
          {ed.output_condition && renderConditionDetail(ed.output_condition, 'Condición de Salida', '⚡')}

          {/* Activities Checklist */}
          {ed.activities_checklist && (
            <div className="card" style={{ gridColumn:'span 2' }}>
              <p className="section-tag">📋 Actividades Realizadas</p>
              <div className="detail-checklist">
                {Object.entries(UPS_ACTIVITIES_LABELS).map(([key, label]) => (
                  <ChecklistItem key={key} done={ed.activities_checklist[key]} label={label} />
                ))}
              </div>
            </div>
          )}

          {/* Tests */}
          {ed.tests && (
            <div className="card" style={{ gridColumn:'span 2' }}>
              <p className="section-tag">🧪 Pruebas</p>
              <div className="detail-checklist">
                {Object.entries(UPS_TESTS_LABELS).map(([key, label]) => (
                  <ChecklistItem key={key} done={ed.tests[key]} label={label} />
                ))}
              </div>
              {ed.pending_execution !== null && (
                <div style={{ marginTop:12, padding:'10px 14px', background: ed.pending_execution ? 'var(--clr-warning-bg)' : 'var(--clr-success-bg)', borderRadius:'var(--radius-md)', fontSize:13, fontWeight:600 }}>
                  Pendiente de ejecución: {ed.pending_execution ? '⚠️ SÍ' : '✅ NO'}
                </div>
              )}
            </div>
          )}

          {/* Execution Time */}
          {ed.execution_time && (
            <div className="card" style={{ gridColumn:'span 2' }}>
              <p className="section-tag">⏱️ Tiempo de Ejecución</p>
              <div className="detail-measurement-grid">
                <MeasurementItem label="Hora Llegada" value={ed.execution_time.arrival_time} />
                <MeasurementItem label="Hora Salida" value={ed.execution_time.departure_time} />
              </div>
              {ed.cancellation && (
                <p style={{ fontSize:13, marginTop:8 }}>Observaciones: {ed.cancellation}</p>
              )}
            </div>
          )}
        </>)}

        {/* ══════ AC EQUIPMENT DATA ══════ */}
        {hasEquipData && isAC && (<>
          {/* Contrato + Tipo Equipo */}
          <div className="card">
            <p className="section-tag">📋 Contrato</p>
            <div className="detail-measurement-grid">
              <MeasurementItem label="Contratado" value={ed.maintenance_contracted ? 'SÍ' : 'NO'} />
              <MeasurementItem label="Proveedor" value={ed.provider} />
              <MeasurementItem label="Contacto" value={ed.contact} />
              <MeasurementItem label="Auxiliar" value={ed.auxiliary_technician} />
            </div>
          </div>

          <div className="card">
            <p className="section-tag">❄️ Tipo de Equipo</p>
            {ed.equipment_subtype && (
              <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'10px 18px', background:'var(--clr-primary-light)', borderRadius:'var(--radius-md)', fontSize:15, fontWeight:700, color:'var(--clr-primary)' }}>
                {AC_SUBTYPE_LABELS[ed.equipment_subtype] || ed.equipment_subtype}
              </div>
            )}
            {!ed.equipment_subtype && <p style={{ color:'var(--clr-text-light)', fontSize:13 }}>No seleccionado</p>}
          </div>

          {/* Work Performed */}
          {ed.work_performed && (
            <div className="card" style={{ gridColumn:'span 2' }}>
              <p className="section-tag">🔧 Trabajos Realizados</p>
              <div className="detail-checklist">
                {Object.entries(AC_WORK_LABELS).map(([key, label]) => (
                  <ChecklistItem key={key} done={ed.work_performed[key]} label={label} />
                ))}
              </div>
              {ed.work_performed.other && (
                <p style={{ fontSize:13, marginTop:10 }}>Otro: <strong>{ed.work_performed.other}</strong></p>
              )}
            </div>
          )}

          {/* Operating Data */}
          {ed.operating_data && (
            <div className="card" style={{ gridColumn:'span 2' }}>
              <p className="section-tag">📊 Datos de Funcionamiento</p>
              <div className="responsive-grid-2" style={{ gap:16 }}>
                <div className="table-wrapper">
                  <table className="data-table" style={{ fontSize:13 }}>
                    <thead>
                      <tr><th>Equipo</th><th>L1</th><th>L2</th><th>L3</th></tr>
                    </thead>
                    <tbody>
                      {['compressor_1','compressor_2','condenser_fan_1','condenser_fan_2','other_left_1','other_left_2'].map(key => (
                        <tr key={key}>
                          <td style={{ fontWeight:600 }}>{AC_EQUIP_LABELS[key]}</td>
                          <td>{ed.operating_data[key]?.l1 || '—'}</td>
                          <td>{ed.operating_data[key]?.l2 || '—'}</td>
                          <td>{ed.operating_data[key]?.l3 || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="table-wrapper">
                  <table className="data-table" style={{ fontSize:13 }}>
                    <thead>
                      <tr><th>Equipo</th><th>L1</th><th>L2</th><th>L3</th></tr>
                    </thead>
                    <tbody>
                      {['condenser_fan_3','condenser_fan_4','blower_1','blower_2','other_right_1','other_right_2'].map(key => (
                        <tr key={key}>
                          <td style={{ fontWeight:600 }}>{AC_EQUIP_LABELS[key]}</td>
                          <td>{ed.operating_data[key]?.l1 || '—'}</td>
                          <td>{ed.operating_data[key]?.l2 || '—'}</td>
                          <td>{ed.operating_data[key]?.l3 || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="responsive-grid-2" style={{ gap:16, marginTop:16 }}>
                <div className="detail-measurement-grid">
                  <MeasurementItem label="P. Alta Etapa 1" value={ed.operating_data.high_pressure_1} />
                  <MeasurementItem label="P. Alta Etapa 2" value={ed.operating_data.high_pressure_2} />
                </div>
                <div className="detail-measurement-grid">
                  <MeasurementItem label="P. Baja Etapa 1" value={ed.operating_data.low_pressure_1} />
                  <MeasurementItem label="P. Baja Etapa 2" value={ed.operating_data.low_pressure_2} />
                </div>
              </div>
            </div>
          )}

          {/* Parts used */}
          {ed.parts_used !== null && (
            <div className="card" style={{ gridColumn:'span 2' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ fontSize:14, fontWeight:600 }}>Repuestos utilizados:</span>
                <span style={{ padding:'4px 12px', borderRadius:'var(--radius-full)', fontSize:13, fontWeight:700,
                  background: ed.parts_used ? 'var(--clr-success-bg)' : 'var(--clr-surface-2)',
                  color: ed.parts_used ? 'var(--clr-success)' : 'var(--clr-text-light)' }}>
                  {ed.parts_used ? 'SÍ' : 'NO'}
                </span>
              </div>
            </div>
          )}
        </>)}

        {/* ══════ GENERIC MODULE DATA (Generador, Batería, ATS, Tablero) ══════ */}
        {hasEquipData && isGeneric && !isTrabajosVarios && <GenericModuleDetail config={moduleConfig} data={ed} fileUrls={equipmentFileUrls} />}

        {/* Technicians */}
        {(report.technicians ?? []).filter(t => t.technician_name).length > 0 && (
          <div className="card" style={{ gridColumn:'span 2' }}>
            <p className="section-tag">Técnicos</p>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th><th>Nombre</th><th>H. Falla</th>
                    <th>Llegada PDV</th><th>Salida PDV</th><th>Llegada Planta</th>
                  </tr>
                </thead>
                <tbody>
                  {report.technicians.filter(t => t.technician_name).map((t,i) => (
                    <tr key={t.id}>
                      <td>{i+1}</td><td>{t.technician_name}</td>
                      <td>{t.fault_time||'—'}</td><td>{t.arrival_pdv||'—'}</td>
                      <td>{t.departure_pdv||'—'}</td><td>{t.arrival_plant||'—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Work Description */}
        <div className="card" style={{ gridColumn:'span 2' }}>
          <p className="section-tag">Descripción del Trabajo</p>
          <p style={{ fontSize:14, lineHeight:1.7, whiteSpace:'pre-wrap' }}>
            {report.work_description || <em style={{ color:'var(--clr-text-light)' }}>Sin descripción</em>}
          </p>
          {report.observations && (
            <>
              <hr className="section-divider" />
              <p className="section-tag">Observaciones</p>
              <p style={{ fontSize:14, lineHeight:1.7, whiteSpace:'pre-wrap' }}>{report.observations}</p>
            </>
          )}
        </div>

        {/* Parts */}
        {!isTrabajosVarios && (report.parts ?? []).filter(p => p.description).length > 0 && (
          <div className="card" style={{ gridColumn:'span 2' }}>
            <p className="section-tag">Repuestos Utilizados</p>
            <div className="table-wrapper">
              <table className="data-table">
                <thead><tr><th>Cantidad</th><th>Descripción</th><th>Código</th></tr></thead>
                <tbody>
                  {report.parts.filter(p => p.description).map(p => (
                    <tr key={p.id}><td>{p.quantity}</td><td>{p.description}</td><td>{p.part_code||'—'}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Photos */}
        {!isTrabajosVarios && (report.photos ?? []).length > 0 && Object.entries(PHOTO_TYPE_LABELS).map(([type, label]) => {
          const groupPhotos = report.photos.filter(p => (p.photo_type ?? 'equipo') === type)
          if (groupPhotos.length === 0) return null
          return (
            <div key={type} className="card" style={{ gridColumn:'span 2' }}>
              <p className="section-tag">{label}</p>
              <div className="photo-grid">
                {groupPhotos.map(p => (
                  photoUrls[p.id] && (
                    <img key={p.id} src={photoUrls[p.id]} alt={p.caption || 'Foto'} className="photo-thumb"
                      style={{ cursor: 'pointer' }}
                      onClick={() => setPreviewPhoto({ url: photoUrls[p.id], caption: p.caption })} />
                  )
                ))}
              </div>
            </div>
          )
        })}

        {/* Signature */}
        {report.status === 'signed' && (
          <div className="card" style={{ gridColumn:'span 2', background:'var(--clr-success-bg)', border:'1.5px solid var(--clr-success)' }}>
            <p className="section-tag" style={{ color:'var(--clr-success)' }}>✅ Firma del Cliente</p>
            <div style={{ display:'flex', gap:24, alignItems:'flex-start', flexWrap:'wrap' }}>
              <div>
                <p style={{ fontSize:13, color:'var(--clr-text-light)', fontWeight:600 }}>Nombre</p>
                <p style={{ fontSize:15, fontWeight:700 }}>{report.client_signer_name}</p>
                <p style={{ fontSize:13, color:'var(--clr-text-light)', marginTop:4 }}>Cédula: {report.client_signer_id}</p>
                <p style={{ fontSize:12, color:'var(--clr-text-light)', marginTop:4 }}>Firmado: {formatDate(report.signed_at)}</p>
              </div>
              {report.client_signature_url && (
                <div style={{ border:'1px solid var(--clr-border)', borderRadius:'var(--radius-md)', padding:8, background:'white' }}>
                  <img src={report.client_signature_url} alt="Firma" style={{ height:80 }} />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* DB validation footer */}
      <div style={{ marginTop:24, padding:'12px 16px', background:'var(--clr-surface-2)', borderRadius:'var(--radius-md)', fontSize:12, color:'var(--clr-text-light)', display:'flex', gap:8, alignItems:'center' }}>
        <CheckCircle size={14} color="var(--clr-success)" />
        Reporte guardado en Supabase · ID: <code style={{ fontSize:11 }}>{report.id}</code>
      </div>

      {showSignatureModal && (
        <SignatureModal
          reportId={report.id}
          onClose={() => setShowSignatureModal(false)}
          onSigned={() => { setShowSignatureModal(false); loadReport({ silent: true }) }}
        />
      )}

      {/* Photo preview lightbox — portaled to <body> so it's fixed to the real
          viewport, not to .fade-in's containing block (its transform-bearing
          animation otherwise traps position:fixed descendants inside it). */}
      {previewPhoto && createPortal(
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setPreviewPhoto(null) }}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            zIndex: 300, padding: 24,
          }}
        >
          <button className="icon-btn" onClick={() => setPreviewPhoto(null)}
            style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.1)', color: 'white' }}>
            <X size={20} />
          </button>
          <img src={previewPhoto.url} alt={previewPhoto.caption || 'Foto'}
            style={{ maxWidth: '100%', maxHeight: '85vh', objectFit: 'contain', borderRadius: 'var(--radius-md)' }} />
          {previewPhoto.caption && (
            <p style={{ color: 'white', marginTop: 16, fontSize: 14, textAlign: 'center', maxWidth: 640 }}>
              {previewPhoto.caption}
            </p>
          )}
        </div>,
        document.body
      )}
    </div>
  )
}
