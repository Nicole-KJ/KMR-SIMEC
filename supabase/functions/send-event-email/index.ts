import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const FROM_EMAIL = 'K Maintenance Report <info@simec-cr.com>'

// Auto-injected into every Supabase Edge Function – no manual secret needed.
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const ALLOWED_ORIGINS = ['http://localhost:5176', 'https://reportes.simec-cr.com']

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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Escapes user-controlled text before it's interpolated into the HTML email
// body -- same reasoning as send-report-email: a real outbound email sent
// under the business's identity, so unescaped input is a stored HTML/script-
// injection vector.
function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Mirrors src/constants/serviceTypes.js / src/constants/equipmentModules --
// duplicated here rather than shared, since those are React-side JS modules
// and this is a standalone Deno function.
const SERVICE_TYPE_LABELS: Record<string, string> = {
  preventivo: 'Preventivo',
  correctivo: 'Correctivo',
  arranque: 'Arranque',
  varios: 'Varios',
}
const EQUIPMENT_TYPE_LABELS: Record<string, string> = {
  ups: 'UPS',
  ac: 'Aires de Precisión y Aires Confort',
  generador: 'Generador',
  bateria: 'Batería',
  ats: 'ATS',
  tablero: 'Tablero Eléctrico',
  trabajos_varios: 'Trabajos Varios',
}

serve(async (req) => {
  const cors = corsHeaders(req)

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: cors })
  }

  try {
    // Require a logged-in SIMEC session -- same boundary as send-report-email:
    // without this, this endpoint would let anyone who found the URL email
    // an arbitrary técnico through this project's Resend account.
    const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    })
    const { data: { user }, error: userErr } = await callerClient.auth.getUser()
    if (userErr || !user) {
      return json({ error: 'No autenticado' }, 401, cors)
    }

    const { eventId, technicianIds } = await req.json()
    if (!eventId || typeof eventId !== 'string' || !UUID_RE.test(eventId)) {
      return json({ error: 'eventId inválido' }, 400, cors)
    }
    if (!Array.isArray(technicianIds) || technicianIds.length === 0 || !technicianIds.every((id: unknown) => typeof id === 'string' && UUID_RE.test(id))) {
      return json({ error: 'technicianIds inválido' }, 400, cors)
    }

    // service_role from here on -- the caller just created/updated this
    // event themselves (NewEvento.jsx calls this right after a successful
    // save), so re-deriving it fresh server-side is about correctness
    // (never trust client-supplied event details in the email), not an
    // extra authorization check on top of what the save itself already did.
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: event, error: eventErr } = await adminClient
      .from('service_events')
      .select('*')
      .eq('id', eventId)
      .single()
    if (eventErr || !event) {
      return json({ error: 'Evento no encontrado' }, 404, cors)
    }

    // One email per técnico given -- events have no single "primary"
    // técnico (059, event_technicians is a plain add/remove list), so this
    // resolves whichever ids the caller says are newly assigned. A técnico
    // whose email can't be resolved is silently skipped rather than
    // failing the whole notification for the others.
    const technicianEmails: string[] = []
    for (const technicianId of technicianIds as string[]) {
      const { data: techData } = await adminClient.auth.admin.getUserById(technicianId)
      if (techData?.user?.email) technicianEmails.push(techData.user.email)
    }
    if (technicianEmails.length === 0) {
      return json({ error: 'No se pudo obtener el correo de ningún técnico' }, 500, cors)
    }

    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY secret not found.')
      return json({ error: 'Servicio de correo no disponible' }, 500, cors)
    }

    const safeEventCode = escapeHtml(event.event_code ?? '—')
    const safeEventName = escapeHtml(event.event_name ?? 'Evento')
    const safeDate = escapeHtml(event.event_date ?? '—')
    const safeTime = escapeHtml(event.event_time ? String(event.event_time).slice(0, 5) : '—')
    const safeServiceType = escapeHtml(SERVICE_TYPE_LABELS[event.service_type as string] ?? event.service_type ?? '—')
    const safeEquipmentType = escapeHtml(EQUIPMENT_TYPE_LABELS[event.equipment_type as string] ?? event.equipment_type ?? '—')
    const safeClientName = escapeHtml(event.client_name ?? '—')
    const safeClientAddress = escapeHtml(event.client_address ?? '—')
    const safeNotes = escapeHtml(event.notes ?? '')

    // Company branding (Personalización) is optional -- same fallback/error
    // handling as send-report-email, never let this block sending the email.
    let brandName = 'K Maintenance Report'
    let logoImgTag = ''
    try {
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
      console.error('send-event-email branding lookup failed:', err instanceof Error ? err.message : String(err))
    }

    const emailPayload = {
      from: FROM_EMAIL,
      to: technicianEmails,
      subject: `Nuevo evento asignado: ${safeEventCode} · ${safeEventName}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
          <div style="background:linear-gradient(135deg,#1e1b8e,#3538CD);padding:28px 24px;border-radius:12px 12px 0 0;text-align:center;color:white">
            ${logoImgTag}
            <h1 style="margin:0 0 4px;font-size:22px">${brandName}</h1>
            <p style="margin:0;opacity:.85;font-size:13px">Nuevo evento asignado</p>
          </div>
          <div style="background:white;padding:24px;border:1px solid #e5e7eb;border-top:none">
            <p>Hola,</p>
            <p>Se te ha asignado una visita de servicio. Estos son los detalles:</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0">
              <tr><td style="padding:8px;background:#f3f4f8;border-radius:6px;font-size:12px;color:#6b7280;font-weight:700">CÓDIGO</td>
                  <td style="padding:8px;font-weight:600">${safeEventCode}</td></tr>
              <tr><td style="padding:8px;background:#f3f4f8;border-radius:6px;font-size:12px;color:#6b7280;font-weight:700">EVENTO</td>
                  <td style="padding:8px;font-weight:600">${safeEventName}</td></tr>
              <tr><td style="padding:8px;background:#f3f4f8;border-radius:6px;font-size:12px;color:#6b7280;font-weight:700">FECHA</td>
                  <td style="padding:8px;font-weight:600">${safeDate} · ${safeTime}</td></tr>
              <tr><td style="padding:8px;background:#f3f4f8;border-radius:6px;font-size:12px;color:#6b7280;font-weight:700">TIPO DE SERVICIO</td>
                  <td style="padding:8px;font-weight:600">${safeServiceType}</td></tr>
              <tr><td style="padding:8px;background:#f3f4f8;border-radius:6px;font-size:12px;color:#6b7280;font-weight:700">TIPO DE EQUIPO</td>
                  <td style="padding:8px;font-weight:600">${safeEquipmentType}</td></tr>
              <tr><td style="padding:8px;background:#f3f4f8;border-radius:6px;font-size:12px;color:#6b7280;font-weight:700">CLIENTE</td>
                  <td style="padding:8px;font-weight:600">${safeClientName}</td></tr>
              <tr><td style="padding:8px;background:#f3f4f8;border-radius:6px;font-size:12px;color:#6b7280;font-weight:700">DIRECCIÓN</td>
                  <td style="padding:8px;font-weight:600">${safeClientAddress}</td></tr>
            </table>
            ${safeNotes ? `<p style="color:#6b7280;font-size:13px"><strong>Notas:</strong> ${safeNotes}</p>` : ''}
            <p style="color:#6b7280;font-size:13px">Puedes ver el evento completo dentro de la aplicación, en la sección Eventos.</p>
          </div>
          <div style="background:#f3f4f8;padding:14px 24px;text-align:center;color:#9ca3af;font-size:12px;border-radius:0 0 12px 12px">
            SIMEC · Sistemas de Ingeniería Eléctricos y Mecánicos ·
            <a href="https://simec-cr.com" style="color:#3538CD">simec-cr.com</a>
          </div>
        </div>`,
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

    return json({ success: true, id: data.id, message: `Correo enviado a ${technicianEmails.join(', ')}` }, 200, cors)

  } catch (err) {
    console.error('send-event-email error:', err instanceof Error ? err.message : String(err))
    return json({ error: 'No se pudo enviar el correo' }, 500, cors)
  }
})
