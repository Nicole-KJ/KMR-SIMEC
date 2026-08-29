/**
 * emailService.js – Sends the report (with the PDF attached) through the
 * `send-report-email` Edge Function, which relays it via Resend under
 * reportes@simec-cr.com. Requires RESEND_API_KEY to be configured as an
 * Edge Function secret and the simec-cr.com domain verified in Resend.
 */
import { supabase } from '../lib/supabase'
import { getOrGenerateReportPDF } from './pdfService'
import { logError } from '../utils/logger'

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(String(reader.result).split(',')[1])
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

export async function sendReportByEmail(report, recipientEmail) {
  try {
    const { blob: pdfBlob } = await getOrGenerateReportPDF(report)
    const reportNum = String(report.report_number ?? 0).padStart(4, '0')
    const filename = `KMR-Reporte-${reportNum}.pdf`
    const pdfBase64 = await blobToBase64(pdfBlob)

    // The report's own "Correo adicional" (set on Nuevo Reporte) always
    // rides along as an extra recipient, not just the one typed into this
    // send form -- deduped in case they happen to match.
    const to = [...new Set([recipientEmail, report.client_email_secondary].filter(Boolean))]

    const { data, error } = await supabase.functions.invoke('send-report-email', {
      body: {
        to,
        reportNumber: reportNum,
        clientName: report.client_name,
        serviceType: report.service_type,
        technicianName: report.technician_name,
        reportDate: report.report_date,
        pdfBase64,
        filename,
      },
    })

    if (error) {
      const body = await error.context?.json?.().catch(() => null)
      throw new Error(body?.error ?? error.message ?? 'No se pudo enviar el correo')
    }
    if (data?.error) throw new Error(data.error)

    return { success: true, message: data?.message ?? `Correo enviado a ${to.join(', ')}` }
  } catch (err) {
    logError('emailService.sendReportByEmail', err)
    return { success: false, message: err.message ?? 'No se pudo enviar el correo' }
  }
}
