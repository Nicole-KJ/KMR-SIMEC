import { useState, useRef, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle, RotateCcw, Loader } from 'lucide-react'
import { getReportForSignature, signReport, uploadSignatureImage, formatDate } from '../services/supabaseDB'
import { isValidCedula } from '../utils/validation'
import { logError } from '../utils/logger'
import logo from '../assets/brand/logo.png'

export default function SignaturePage() {
  const { reportId } = useParams()
  const canvasRef = useRef(null)
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [signerName, setSignerName] = useState('')
  const [signerId, setSignerId] = useState('')
  const [drawing, setDrawing] = useState(false)
  const [hasSig, setHasSig] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  function loadReport() {
    setLoading(true)
    getReportForSignature(reportId)
      .then(r => {
        setReport(r)
        if (r?.status === 'signed') setSaved(true)
      })
      .catch(err => {
        logError('SignaturePage.loadReport', err)
        setReport(null)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadReport()
  }, [reportId])

  // Canvas drawing
  function getPos(e, canvas) {
    const rect = canvas.getBoundingClientRect()
    const src = e.touches ? e.touches[0] : e
    return {
      x: (src.clientX - rect.left) * (canvas.width / rect.width),
      y: (src.clientY - rect.top) * (canvas.height / rect.height),
    }
  }

  function startDraw(e) {
    e.preventDefault()
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const pos = getPos(e, canvas)
    ctx.beginPath(); ctx.moveTo(pos.x, pos.y)
    setDrawing(true); setHasSig(true)
  }

  function draw(e) {
    if (!drawing) return
    e.preventDefault()
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.strokeStyle = '#1A2332'
    const pos = getPos(e, canvas)
    ctx.lineTo(pos.x, pos.y); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(pos.x, pos.y)
  }

  function stopDraw() { setDrawing(false) }

  function clearCanvas() {
    const canvas = canvasRef.current
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
    setHasSig(false)
  }

  async function handleSave() {
    if (!signerName.trim()) { setError('Ingresa el nombre del cliente'); return }
    if (!isValidCedula(signerId)) { setError('Ingresa una cédula válida (solo números y guiones, entre 9 y 12 dígitos).'); return }
    if (!hasSig) { setError('Por favor firma en el recuadro'); return }
    setError('')
    setSaving(true)

    try {
      const canvas = canvasRef.current
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
      const signatureUrl = await uploadSignatureImage(reportId, blob)

      await signReport(reportId, {
        client_signer_name: signerName,
        client_signer_id: signerId,
        client_signature_url: signatureUrl,
      })
      setSaved(true)
      // Refresh report data
      const updated = await getReportForSignature(reportId)
      setReport(updated)
    } catch (err) {
      setError('Error al guardar la firma: ' + (err.message ?? err))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="signature-page">
      <div style={{ textAlign: 'center' }}>
        <Loader size={36} className="spin" color="#3538CD" />
        <p style={{ marginTop: 12, color: '#6b7280' }}>Cargando reporte...</p>
      </div>
    </div>
  )

  if (!report) return (
    <div className="signature-page">
      <div className="signature-card" style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 40, marginBottom: 16 }}>⚠️</p>
        <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Reporte no encontrado</h2>
        <p style={{ color: '#6b7280', marginBottom: 20 }}>El enlace puede ser inválido, el reporte fue eliminado, o hubo un problema de conexión.</p>
        <button className="btn btn-primary" onClick={loadReport}>Reintentar</button>
      </div>
    </div>
  )

  if (saved) return (
    <div className="signature-page">
      <div className="signature-card" style={{ textAlign: 'center' }}>
        <CheckCircle size={64} color="#10B981" style={{ margin: '0 auto 16px' }} />
        <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>¡Firma registrada!</h2>
        <p style={{ color: '#6b7280', marginBottom: 24 }}>
          El informe de servicio ha sido firmado y guardado en la base de datos.
        </p>
        <div style={{ background: '#F3F4F8', borderRadius: 10, padding: 16, marginBottom: 24, textAlign: 'left' }}>
          <p style={{ fontSize: 13, color: '#6b7280', fontWeight: 600 }}>Reporte</p>
          <p style={{ fontWeight: 700, color: '#111827' }}>#{String(report.report_number ?? 0).padStart(4, '0')} – {report.equipment_type?.toUpperCase()}</p>
          <p style={{ fontSize: 13, marginTop: 4, color: '#111827' }}>Cliente: {report.client_name}</p>
          <p style={{ fontSize: 13, color: '#111827' }}>Firmado por: {report.client_signer_name}</p>
          {report.client_signature_url && (
            <div style={{ marginTop: 10, background: 'white', border: '1px solid #E5E7EB', borderRadius: 8, padding: 8, display: 'inline-block' }}>
              <img src={report.client_signature_url} alt="Firma del cliente" style={{ height: 70, display: 'block' }} />
            </div>
          )}
          <p style={{ fontSize: 12, color: '#10B981', marginTop: 8, fontWeight: 600 }}>
            ✅ Guardado en la base de datos · {new Date(report.signed_at).toLocaleString('es-CR')}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', color: '#6b7280', fontSize: 13 }}>
          <img src={logo} alt="" style={{ width: 18, height: 18, objectFit: 'contain' }} />
          K Maintenance Report
        </div>
      </div>
    </div>
  )

  return (
    <div className="signature-page">
      <div className="signature-card fade-in">
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <img src={logo} alt="K Maintenance Report" style={{ width: 64, height: 64, objectFit: 'contain', margin: '0 auto 8px' }} />
          <h2 style={{ fontSize: 22, fontWeight: 800 }}>Informe de Servicio</h2>
          <p style={{ color: '#6b7280', fontSize: 14, marginTop: 4 }}>
            Reporte #{String(report.report_number ?? 0).padStart(4, '0')} · {formatDate(report.report_date)}
          </p>
        </div>

        {/* Report summary */}
        <div style={{ background: '#F3F4F8', borderRadius: 10, padding: 16, marginBottom: 24 }}>
          <div className="responsive-grid-2" style={{ gap: 8 }}>
            {[
              ['Cliente', report.client_name],
              ['Equipo', report.equipment_type?.toUpperCase()],
              ['Tipo de servicio', report.service_type],
              ['Marca / Modelo', [report.brand, report.model].filter(Boolean).join(' ')],
              ['Ubicación', report.location],
              ['Técnico', report.technician_name],
            ].map(([k, v]) => v ? (
              <div key={k}>
                <p style={{ fontSize: 11, color: '#6b7280', fontWeight: 700, textTransform: 'uppercase' }}>{k}</p>
                <p style={{ fontSize: 14, fontWeight: 600, textTransform: 'capitalize', color: '#111827' }}>{v}</p>
              </div>
            ) : null)}
          </div>
          {report.work_description && (
            <div style={{ marginTop: 12, borderTop: '1px solid #E5E7EB', paddingTop: 12 }}>
              <p style={{ fontSize: 11, color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Trabajo realizado</p>
              <p style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', color: '#111827' }}>{report.work_description}</p>
            </div>
          )}
        </div>

        {/* Client info */}
        <div className="form-row form-row-2" style={{ marginBottom: 16 }}>
          <div className="form-group">
            <label className="form-label">Nombre del cliente <span>*</span></label>
            <input id="sig-name" className="form-control" value={signerName}
              onChange={e => setSignerName(e.target.value)} placeholder="Nombre completo" />
          </div>
          <div className="form-group">
            <label className="form-label">Cédula <span>*</span></label>
            <input id="sig-id" className="form-control" value={signerId}
              onChange={e => setSignerId(e.target.value)} placeholder="1-2345-6789" />
          </div>
        </div>

        {/* Signature canvas */}
        <div className="form-group">
          <label className="form-label">Firma del cliente <span>*</span></label>
          <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
            Firme con su dedo o lápiz óptico en el recuadro
          </p>
          <div className="signature-canvas-wrapper">
            <canvas
              ref={canvasRef}
              width={540} height={180}
              style={{ width: '100%', height: 180, display: 'block', cursor: 'crosshair', touchAction: 'none' }}
              onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
              onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw}
            />
          </div>
          <button className="btn btn-secondary btn-sm" onClick={clearCanvas} style={{ marginTop: 8 }}>
            <RotateCcw size={13} /> Borrar firma
          </button>
        </div>

        {error && (
          <div style={{ background: '#FEE2E2', color: '#991B1B', padding: '10px 14px', borderRadius: 8, fontSize: 14, marginBottom: 16 }}>
            {error}
          </div>
        )}

        <button id="btn-confirmar-firma" className="btn btn-primary btn-block btn-lg"
          onClick={handleSave} disabled={saving} style={{ marginTop: 8 }}>
          {saving
            ? <><Loader size={16} className="spin" /> Guardando...
            </>
            : <><CheckCircle size={18} /> Confirmar y Firmar</>
          }
        </button>

        <p style={{ textAlign: 'center', marginTop: 16, fontSize: 11, color: '#9CA3AF' }}>
          K Maintenance Report
        </p>
      </div>
    </div>
  )
}
