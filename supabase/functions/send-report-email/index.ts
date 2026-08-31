import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const FROM_EMAIL = 'K Maintenance Report <info@simec-cr.com>'

// Auto-injected into every Supabase Edge Function – no manual secret needed.
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const ALLOWED_ORIGINS = [
  'http://localhost:5176',
  'https://reportes.simec-cr.com',
  'https://www.simec-cr.com',
  'https://simec-cr.com',
]

function corsHeaders(req: Request) {
  const origin = req.headers.get('origin') ?? ''
  const allowOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    Vary: 'Origin',
  }
}

function json(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  })
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Escapes user-controlled text before it's interpolated into the HTML email
// body -- this is a real outbound email sent under the business's identity,
// so unescaped input here is a stored HTML/script-injection vector.
function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

serve(async (req) => {
  const cors = corsHeaders(req)

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: cors })
  }

  try {
    // Require a logged-in SIMEC session -- without this, this endpoint was an
    // open relay: anyone who found the URL could send arbitrary email through
    // this project's Resend account under the SIMEC identity.
    const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    })
    const { data: { user }, error: userErr } = await callerClient.auth.getUser()
    if (userErr || !user) {
      return json({ error: 'No autenticado' }, 401, cors)
    }

    const body = await req.json()
    const { to, reportNumber, clientName, serviceType, technicianName, reportDate, pdfBase64, filename } = body

    // `to` is normally the primary client email plus their optional
    // "Correo adicional", sent as one array from emailService.js -- still
    // accepts a lone string too, so older callers don't break.
    const recipients = [...new Set((Array.isArray(to) ? to : [to]).filter((addr): addr is string => typeof addr === 'string' && addr.length > 0))]
    if (recipients.length === 0 || recipients.some((addr) => !EMAIL_RE.test(addr))) {
      return json({ error: 'Correo de destino inválido' }, 400, cors)
    }
    if (pdfBase64 !== undefined && pdfBase64 !== null && typeof pdfBase64 !== 'string') {
      return json({ error: 'Adjunto inválido' }, 400, cors)
    }

    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY secret not found.')
      return json({ error: 'Servicio de correo no disponible' }, 500, cors)
    }

    const safeClientName = escapeHtml(clientName ?? 'Cliente')
    const safeServiceType = escapeHtml(serviceType ?? '—')
    const safeTechnicianName = escapeHtml(technicianName ?? '—')
    const safeReportDate = escapeHtml(reportDate ?? '—')
    const safeReportNumber = escapeHtml(reportNumber ?? '')

    // Company branding (Personalización) is optional -- fall back to the
    // app's own identity if nothing's set, and never let this block sending
    // the email over a query error.
    let brandName = 'K Maintenance Report'
    let logoImgTag = ''
    try {
      const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
      const { data: settings } = await adminClient
        .from('company_settings')
        .select('company_name, logo_storage_path')
        .eq('id', true)
        .maybeSingle()
      if (settings?.company_name) brandName = escapeHtml(settings.company_name)
      if (settings?.logo_storage_path) {
        const logoUrl = `${SUPABASE_URL}/storage/v1/object/public/company-logo/${settings.logo_storage_path}`
        logoImgTag = `<img src="${logoUrl}" alt="${brandName}" style="height:48px;object-fit:contain;margin-bottom:8px">`
      }
    } catch (err) {
      console.error('send-report-email branding lookup failed:', err instanceof Error ? err.message : String(err))
    }

    const emailPayload: Record<string, unknown> = {
      from: FROM_EMAIL,
      to: recipients,
      subject: `Informe de Servicio #${safeReportNumber} · ${safeClientName}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
          <div style="background:linear-gradient(135deg,#1e1b8e,#3538CD);padding:28px 24px;border-radius:12px 12px 0 0;text-align:center;color:white">
            ${logoImgTag}
            <h1 style="margin:0 0 4px;font-size:22px">${brandName}</h1>
            <p style="margin:0;opacity:.85;font-size:13px">Informe de Servicio Técnico</p>
          </div>
          <div style="background:white;padding:24px;border:1px solid #e5e7eb;border-top:none">
            <p>Estimado/a <strong>${safeClientName}</strong>,</p>
            <p>Adjunto encontrará el informe oficial del servicio técnico realizado por nuestro equipo.</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0">
              <tr><td style="padding:8px;background:#f3f4f8;border-radius:6px;font-size:12px;color:#6b7280;font-weight:700">N° REPORTE</td>
                  <td style="padding:8px;font-weight:600">#${safeReportNumber}</td></tr>
              <tr><td style="padding:8px;background:#f3f4f8;border-radius:6px;font-size:12px;color:#6b7280;font-weight:700">TIPO</td>
                  <td style="padding:8px;font-weight:600">${safeServiceType}</td></tr>
              <tr><td style="padding:8px;background:#f3f4f8;border-radius:6px;font-size:12px;color:#6b7280;font-weight:700">TÉCNICO</td>
                  <td style="padding:8px;font-weight:600">${safeTechnicianName}</td></tr>
              <tr><td style="padding:8px;background:#f3f4f8;border-radius:6px;font-size:12px;color:#6b7280;font-weight:700">FECHA</td>
                  <td style="padding:8px;font-weight:600">${safeReportDate}</td></tr>
            </table>
            <p style="color:#6b7280;font-size:13px">El reporte PDF se encuentra adjunto. Para consultas comuníquese con nuestro equipo.</p>
          </div>
          <div style="background:#f3f4f8;padding:14px 24px;text-align:center;color:#9ca3af;font-size:12px;border-radius:0 0 12px 12px">
            SIMEC · Sistemas de Ingeniería Eléctricos y Mecánicos ·
            <a href="https://simec-cr.com" style="color:#3538CD">simec-cr.com</a>
          </div>
        </div>`,
    }

    // Only attach PDF if provided and not too large (Resend limit ~40MB, but keep under 5MB base64)
    if (pdfBase64 && pdfBase64.length < 5_000_000) {
      emailPayload.attachments = [{ filename: escapeHtml(filename) || `KMR-Reporte-${safeReportNumber}.pdf`, content: pdfBase64 }]
    }

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailPayload),
    })

    const data = await resendResponse.json()

    if (!resendResponse.ok) {
      console.error('Resend error:', resendResponse.status, JSON.stringify(data))
      throw new Error('No se pudo enviar el correo')
    }

    return json({ success: true, id: data.id, message: `Email enviado a ${recipients.join(', ')}` }, 200, cors)

  } catch (err) {
    console.error('send-report-email error:', err instanceof Error ? err.message : String(err))
    return json({ error: 'No se pudo enviar el correo' }, 500, cors)
  }
})
