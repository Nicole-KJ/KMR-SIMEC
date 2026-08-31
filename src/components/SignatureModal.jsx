import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, CheckCircle, RotateCcw, Loader } from 'lucide-react'
import { useSignatureFlow } from '../hooks/useSignatureFlow'

// In-app signing/viewing, used from ReportDetail for both "Firmar Reporte"
// and "Ver Firma" -- same capture/validation/save as the public /firma/:id
// link (shared via useSignatureFlow) — this is just that flow as a modal
// instead of opening a new tab, for when there's no need to email a link
// and wait for the client to open it separately.
export default function SignatureModal({ reportId, onClose, onSigned }) {
  const {
    canvasRef, report, loading, error, saved, justSigned,
    signerName, setSignerName, signerId, setSignerId,
    saving,
    loadReport,
    startDraw, draw, stopDraw, clearCanvas,
    handleSave,
  } = useSignatureFlow(reportId)

  // Only auto-close when *this session* just signed it -- opening the modal
  // to view a report that was already signed earlier should stay open until
  // the user closes it themselves.
  useEffect(() => {
    if (!justSigned) return
    const t = setTimeout(() => onSigned?.(), 1400)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [justSigned])

  const viewingSigned = saved && !justSigned

  return createPortal(
    <div
      onClick={(e) => { if (e.target === e.currentTarget && !saving) onClose() }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 300, padding: 16,
      }}
    >
      <div className="card fade-in" style={{ maxWidth: 560, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <p className="section-tag" style={{ marginBottom: 0 }}>{viewingSigned ? 'Firma del Cliente' : 'Firmar Reporte'}</p>
          <button className="icon-btn" onClick={onClose} disabled={saving}><X size={16} /></button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Loader size={32} className="spin" color="var(--clr-primary)" />
            <p style={{ marginTop: 12, color: 'var(--clr-text-light)' }}>Cargando reporte...</p>
          </div>
        ) : !report ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <p style={{ fontSize: 32, marginBottom: 12 }}>⚠️</p>
            <p style={{ fontWeight: 700, marginBottom: 6 }}>No se pudo cargar el reporte</p>
            <p style={{ fontSize: 13, color: 'var(--clr-text-light)', marginBottom: 16 }}>Hubo un problema de conexión.</p>
            <button className="btn btn-secondary btn-sm" onClick={loadReport}>Reintentar</button>
          </div>
        ) : report.status !== 'completed' && !saved ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <p style={{ fontSize: 32, marginBottom: 12 }}>⏳</p>
            <p style={{ fontWeight: 700, marginBottom: 6 }}>El reporte aún no está completado</p>
            <p style={{ fontSize: 13, color: 'var(--clr-text-light)' }}>Márcalo como completado antes de firmarlo.</p>
          </div>
        ) : justSigned ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <CheckCircle size={48} color="var(--clr-success)" style={{ margin: '0 auto 12px' }} />
            <p style={{ fontWeight: 700, fontSize: 16 }}>¡Firma registrada!</p>
            <p style={{ fontSize: 13, color: 'var(--clr-text-light)', marginTop: 4 }}>Guardando en el reporte...</p>
          </div>
        ) : viewingSigned ? (
          <div>
            <p style={{ fontSize: 13, color: 'var(--clr-text-light)', marginBottom: 16 }}>
              Reporte #{String(report.report_number ?? 0).padStart(4, '0')} · {report.client_name}
            </p>
            <div style={{ background: 'var(--clr-surface-2)', borderRadius: 10, padding: 16 }}>
              <p style={{ fontSize: 13, color: 'var(--clr-text-light)' }}>Firmado por</p>
              <p style={{ fontWeight: 700 }}>{report.client_signer_name}</p>
              {report.client_signer_id && (
                <p style={{ fontSize: 13, color: 'var(--clr-text-light)', marginTop: 2 }}>Cédula: {report.client_signer_id}</p>
              )}
              {report.client_signature_url && (
                <div style={{ marginTop: 12, background: 'white', border: '1px solid var(--clr-border)', borderRadius: 8, padding: 8, display: 'inline-block' }}>
                  <img src={report.client_signature_url} alt="Firma del cliente" style={{ height: 90, display: 'block' }} />
                </div>
              )}
              {report.signed_at && (
                <p style={{ fontSize: 12, color: 'var(--clr-success)', marginTop: 12, fontWeight: 600 }}>
                  ✅ Firmado el {new Date(report.signed_at).toLocaleString('es-CR')}
                </p>
              )}
            </div>
          </div>
        ) : (
          <>
            <p style={{ fontSize: 13, color: 'var(--clr-text-light)', marginBottom: 16 }}>
              Reporte #{String(report.report_number ?? 0).padStart(4, '0')} · {report.client_name}
            </p>

            <div className="form-row form-row-2" style={{ marginBottom: 16 }}>
              <div className="form-group">
                <label className="form-label">Nombre del cliente <span>*</span></label>
                <input className="form-control" value={signerName}
                  onChange={e => setSignerName(e.target.value)} placeholder="Nombre completo" />
              </div>
              <div className="form-group">
                <label className="form-label">Cédula <span>*</span></label>
                <input className="form-control" value={signerId}
                  onChange={e => setSignerId(e.target.value)} placeholder="1-2345-6789" />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Firma del cliente <span>*</span></label>
              <p style={{ fontSize: 12, color: 'var(--clr-text-light)', marginBottom: 8 }}>
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
              <div style={{ background: 'var(--clr-danger-bg)', color: 'var(--clr-danger)', padding: '10px 14px', borderRadius: 8, fontSize: 14, marginBottom: 16 }}>
                {error}
              </div>
            )}

            <button className="btn btn-primary btn-block btn-lg" onClick={handleSave} disabled={saving}>
              {saving ? <><Loader size={16} className="spin" /> Guardando...</> : <><CheckCircle size={18} /> Confirmar y Firmar</>}
            </button>
          </>
        )}
      </div>
    </div>,
    document.body
  )
}
