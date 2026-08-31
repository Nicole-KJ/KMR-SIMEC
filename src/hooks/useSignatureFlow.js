import { useState, useRef, useEffect } from 'react'
import { getReportForSignature, signReport, uploadSignatureImage } from '../services/supabaseDB'
import { isValidCedula } from '../utils/validation'
import { logError } from '../utils/logger'

// Shared signing logic behind SignaturePage (the public /firma/:id link
// clients use) and SignatureModal (in-app, técnico-witnessed signing from
// ReportDetail) -- same canvas capture + validation + save, just different
// chrome wrapped around it.
export function useSignatureFlow(reportId) {
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
        logError('useSignatureFlow.loadReport', err)
        setReport(null)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadReport()
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      const updated = await getReportForSignature(reportId)
      setReport(updated)
      return updated
    } catch (err) {
      setError('Error al guardar la firma: ' + (err.message ?? err))
      return null
    } finally {
      setSaving(false)
    }
  }

  return {
    canvasRef, report, loading, error, saved,
    signerName, setSignerName, signerId, setSignerId,
    hasSig, saving,
    loadReport,
    startDraw, draw, stopDraw, clearCanvas,
    handleSave,
  }
}
