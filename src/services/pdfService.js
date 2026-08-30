/**
 * pdfService.js – Generates and downloads/emails service report PDFs
 * Uses html2pdf.js for client-side generation
 */
import { EQUIPMENT_MODULES } from '../constants/equipmentModules'
import { uploadReportPDF, getReportPdfUrl, getAllReports, getReport, getPublicBranding, getUserRelatedReports, clearReportCachedPdf, getPhotoUrl } from './supabaseDB'
import { logError } from '../utils/logger'
import logoUrl from '../assets/brand/logo.png'

// Dynamically import html2pdf to avoid SSR issues
async function getHtml2pdf() {
  const mod = await import('html2pdf.js')
  return mod.default
}

// ─── FORMAT HELPERS ──────────────────────────────────────────────────────────
function fmt(val) { return val || '—' }
// Handles both a pure "date" column (report_date, no time/timezone at all)
// and real timestamps (signed_at) -- see formatDate() in supabaseDB.js for
// why the date-only case needs the local-midnight parse.
function fmtDate(d) {
  if (!d) return '—'
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T00:00:00`) : new Date(d)
  return parsed.toLocaleDateString('es-CR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
function checkIcon(val) { return val ? '✅' : '❌' }
function checkBg(val) { return val ? '#D1FAE5' : '#F3F4F6' }

// Same grouping/labels as ReportDetail.jsx's own PHOTO_TYPE_LABELS (minus
// the emoji prefixes, which don't render reliably through html2canvas).
const PHOTO_TYPE_LABELS = { equipo: 'Fotos del Equipo', antes: 'Fotos Antes', despues: 'Fotos Después' }

// Trabajos Varios has no single piece of equipment to photograph -- same
// exclusion ReportDetail.jsx applies. Only photos that got a working
// dataUrl (prepareReportForPDF) render -- a report with no photos, or where
// every one of them failed to load, renders no photo sections at all.
function buildPhotoSections(report) {
  if (report.equipment_type === 'trabajos_varios') return ''
  const photos = (report.photos ?? []).filter(p => p.dataUrl)
  if (photos.length === 0) return ''

  return Object.entries(PHOTO_TYPE_LABELS).map(([type, label]) => {
    const group = photos.filter(p => (p.photo_type ?? 'equipo') === type)
    if (group.length === 0) return ''
    const imgs = group.map(p => `<img src="${p.dataUrl}" alt="${fmt(p.caption)}" crossorigin="anonymous">`).join('')
    return `
<div class="section">
  <h3>${label}</h3>
  <div class="photo-grid">${imgs}</div>
</div>`
  }).join('')
}

// ─── LABEL MAPS ──────────────────────────────────────────────────────────────
const UPS_ACTIVITIES_LABELS = EQUIPMENT_MODULES.ups.activitiesLabels
const UPS_TESTS_LABELS = EQUIPMENT_MODULES.ups.testsLabels
const AC_WORK_LABELS = EQUIPMENT_MODULES.ac.workLabels
const AC_SUBTYPE_LABELS = EQUIPMENT_MODULES.ac.subtypeLabels
const AC_EQUIP_LABELS = EQUIPMENT_MODULES.ac.equipLabels

// ─── UPS SECTION BUILDER ─────────────────────────────────────────────────────
function buildUPSSection(data) {
  const isThree = data.phase_type === 'three'

  function conditionTable(cond, title) {
    if (!cond) return ''
    const voltHeaders = isThree ? '<th>L1</th><th>L2</th><th>L3</th><th>N</th><th>T</th>' : '<th>L1</th><th>L2</th><th>N</th><th>T</th>'
    const voltValues = isThree
      ? `<td>${fmt(cond.l1)}</td><td>${fmt(cond.l2)}</td><td>${fmt(cond.l3)}</td><td>${fmt(cond.n)}</td><td>${fmt(cond.t)}</td>`
      : `<td>${fmt(cond.l1)}</td><td>${fmt(cond.l2)}</td><td>${fmt(cond.n)}</td><td>${fmt(cond.t)}</td>`
    const currHeaders = isThree ? '<th>L1</th><th>L2</th><th>L3</th><th>Neutro</th><th>Tierra</th>' : '<th>L1</th><th>L2</th><th>Neutro</th><th>Tierra</th>'
    const currValues = isThree
      ? `<td>${fmt(cond.current_l1)}</td><td>${fmt(cond.current_l2)}</td><td>${fmt(cond.current_l3)}</td><td>${fmt(cond.current_neutral)}</td><td>${fmt(cond.current_ground)}</td>`
      : `<td>${fmt(cond.current_l1)}</td><td>${fmt(cond.current_l2)}</td><td>${fmt(cond.current_neutral)}</td><td>${fmt(cond.current_ground)}</td>`

    return `
    <div class="section">
      <h3>${title}</h3>
      <p style="font-size:9px;font-weight:700;color:#6b7280;margin-bottom:4px">VOLTAJE</p>
      <table><thead><tr style="background:#f3f4f8">${voltHeaders}</tr></thead>
      <tbody><tr>${voltValues}</tr></tbody></table>
      <p style="font-size:9px;font-weight:700;color:#6b7280;margin:8px 0 4px">CORRIENTE</p>
      <table><thead><tr style="background:#f3f4f8">${currHeaders}</tr></thead>
      <tbody><tr>${currValues}</tr></tbody></table>
      ${cond.visual_state ? `<p style="margin-top:4px;font-size:10px"><strong>Estado visual:</strong> ${cond.visual_state}</p>` : ''}
      ${cond.observations ? `<p style="font-size:10px"><strong>Obs:</strong> ${cond.observations}</p>` : ''}
    </div>`
  }

  const checklistRows = Object.entries(UPS_ACTIVITIES_LABELS).map(([key, label], i) => `
    <tr>
      <td style="width:24px;text-align:center;background:${checkBg(data.activities_checklist?.[key])}">${checkIcon(data.activities_checklist?.[key])}</td>
      <td style="background:${checkBg(data.activities_checklist?.[key])}">${i+1}. ${label}</td>
    </tr>`).join('')

  const testRows = Object.entries(UPS_TESTS_LABELS).map(([key, label]) => `
    <tr>
      <td style="width:24px;text-align:center;background:${checkBg(data.tests?.[key])}">${checkIcon(data.tests?.[key])}</td>
      <td style="background:${checkBg(data.tests?.[key])}">${label}</td>
    </tr>`).join('')

  return `
  <div class="section">
    <h3>Contrato y Datos UPS</h3>
    <table>
      <tr><th>Contratado</th><td>${data.maintenance_contracted ? 'SÍ' : 'NO'}</td><th>Tipo de Red</th><td>${isThree ? 'Trifásico (3F)' : 'Monofásico (1F)'}</td></tr>
      <tr><th>Proveedor</th><td>${fmt(data.provider)}</td><th>Contacto</th><td>${fmt(data.contact)}</td></tr>
      <tr><th>Potencia</th><td>${fmt(data.ups_power)}</td><th>Capacidad</th><td>${fmt(data.capacity)}</td></tr>
    </table>
  </div>

  <div class="section">
    <h3>Revisión de Estado de la Tarjeta de Red</h3>
    <table>
      <tr><th>Cuenta con tarjeta de red</th><td>${data.network_card?.has_card ? 'SÍ' : 'NO'}</td><th>Comunica</th><td>${data.network_card?.communicates ? 'SÍ' : 'NO'}</td></tr>
      <tr><th>Descarga histórico UPS</th><td>${data.network_card?.downloads_history ? 'SÍ' : 'NO'}</td><th>Protocolo</th><td>${fmt(data.network_card?.protocol)}</td></tr>
    </table>
  </div>

  ${conditionTable(data.entry_condition, 'Condición de Entrada')}

  <div class="section">
    <h3>Condiciones Ambientales</h3>
    <table>
      <tr><th>Temperatura</th><td>${fmt(data.environmental?.temperature)} °C</td><th>Humedad</th><td>${fmt(data.environmental?.humidity)} %</td><th>Altitud</th><td>${fmt(data.environmental?.altitude)} msnm</td></tr>
    </table>
  </div>

  <div class="section">
    <h3>Baterías</h3>
    <table>
      <tr><th>Calibre</th><td>${fmt(data.batteries?.caliber)}</td><th>Cantidad</th><td>${fmt(data.batteries?.bat_quantity)}</td></tr>
      <tr><th>N° Banco</th><td>${fmt(data.batteries?.bank_number)}</td><th>Voltaje</th><td>${fmt(data.batteries?.v_batt)}</td></tr>
      ${data.batteries?.observations ? `<tr><th>Observaciones</th><td colspan="3">${data.batteries.observations}</td></tr>` : ''}
    </table>
  </div>

  ${conditionTable(data.output_condition, 'Condición de Salida')}

  <div class="section">
    <h3>Actividades Realizadas</h3>
    <table><tbody>${checklistRows}</tbody></table>
  </div>

  <div class="section">
    <h3>Pruebas</h3>
    <table><tbody>${testRows}</tbody></table>
    ${data.pending_execution !== null ? `<p style="margin-top:6px;padding:4px 8px;background:${data.pending_execution ? '#FEF3C7' : '#D1FAE5'};border-radius:4px;font-size:10px;font-weight:600">Pendiente de ejecución: ${data.pending_execution ? 'SÍ' : '✅ NO'}</p>` : ''}
  </div>

  <div class="section">
    <h3>Tiempo de Ejecución</h3>
    <table>
      <tr><th>Hora Llegada</th><td>${fmt(data.execution_time?.arrival_time)}</td><th>Hora Salida</th><td>${fmt(data.execution_time?.departure_time)}</td></tr>
      ${data.cancellation ? `<tr><th>Observaciones</th><td colspan="3">${data.cancellation}</td></tr>` : ''}
    </table>
  </div>`
}

// ─── AC SECTION BUILDER ──────────────────────────────────────────────────────
function buildACSection(data) {
  const workRows = Object.entries(AC_WORK_LABELS).map(([key, label]) => `
    <tr>
      <td style="width:24px;text-align:center;background:${checkBg(data.work_performed?.[key])}">${checkIcon(data.work_performed?.[key])}</td>
      <td style="background:${checkBg(data.work_performed?.[key])}">${label}</td>
    </tr>`).join('')

  const leftKeys = ['compressor_1','compressor_2','condenser_fan_1','condenser_fan_2','other_left_1','other_left_2']
  const rightKeys = ['condenser_fan_3','condenser_fan_4','blower_1','blower_2','other_right_1','other_right_2']

  function equipTable(keys) {
    const rows = keys.map(key => {
      const d = data.operating_data?.[key] || {}
      return `<tr><td style="font-weight:600;background:#f3f4f8">${AC_EQUIP_LABELS[key]}</td><td>${fmt(d.l1)}</td><td>${fmt(d.l2)}</td><td>${fmt(d.l3)}</td></tr>`
    }).join('')
    return `<table style="width:49%;display:inline-table;vertical-align:top">
      <thead><tr style="background:#f3f4f8"><th>Equipo</th><th>L1</th><th>L2</th><th>L3</th></tr></thead>
      <tbody>${rows}</tbody></table>`
  }

  return `
  <div class="section">
    <h3>Contrato y Tipo de Equipo</h3>
    <table>
      <tr><th>Contratado</th><td>${data.maintenance_contracted ? 'SÍ' : 'NO'}</td><th>Tipo Equipo</th><td>${AC_SUBTYPE_LABELS[data.equipment_subtype] || fmt(data.equipment_subtype)}</td></tr>
      <tr><th>Proveedor</th><td>${fmt(data.provider)}</td><th>Contacto</th><td>${fmt(data.contact)}</td></tr>
      <tr><th>Téc. Auxiliar</th><td colspan="3">${fmt(data.auxiliary_technician)}</td></tr>
    </table>
  </div>

  <div class="section">
    <h3>Trabajos Realizados</h3>
    <table><tbody>${workRows}</tbody></table>
    ${data.work_performed?.other ? `<p style="margin-top:4px;font-size:10px"><strong>Otro:</strong> ${data.work_performed.other}</p>` : ''}
  </div>

  <div class="section">
    <h3>Datos de Funcionamiento del Equipo</h3>
    <div style="display:flex;gap:8px;justify-content:space-between">
      ${equipTable(leftKeys)}
      ${equipTable(rightKeys)}
    </div>
    <table style="margin-top:8px">
      <thead><tr style="background:#f3f4f8"><th colspan="2">Presión Alta</th><th colspan="2">Presión Baja</th></tr></thead>
      <tbody><tr>
        <td><strong>Etapa 1:</strong> ${fmt(data.operating_data?.high_pressure_1)}</td>
        <td><strong>Etapa 2:</strong> ${fmt(data.operating_data?.high_pressure_2)}</td>
        <td><strong>Etapa 1:</strong> ${fmt(data.operating_data?.low_pressure_1)}</td>
        <td><strong>Etapa 2:</strong> ${fmt(data.operating_data?.low_pressure_2)}</td>
      </tr></tbody>
    </table>
  </div>

  ${data.parts_used !== null ? `
  <div class="section">
    <p style="font-size:11px;font-weight:600;padding:6px 10px;background:${data.parts_used ? '#D1FAE5' : '#F3F4F6'};border-radius:4px">
      Repuestos utilizados: <strong>${data.parts_used ? 'SÍ' : 'NO'}</strong>
    </p>
  </div>` : ''}`
}

// ─── GENERIC SECTION BUILDER (Generador, Batería, ATS, Tablero) ──────────────
function pairCells(cells) {
  const rows = []
  for (let i = 0; i < cells.length; i += 2) {
    rows.push(`<tr>${cells[i]}${cells[i + 1] ?? ''}</tr>`)
  }
  return rows.join('')
}

function buildGenericSection(module, data) {
  const equipInfoCells = module.equipmentInfoFields.map(field => {
    const raw = data.equipment_info?.[field.key]
    const value = field.type === 'select'
      ? (field.options.find(o => o.value === raw)?.label ?? raw)
      : raw
    return `<th>${field.label}</th><td>${fmt(value)}</td>`
  })

  const readingsSections = module.readingsGroups.map(group => {
    const cells = group.fields.map(f => `<th>${f.label}</th><td>${fmt(data[group.key]?.[f.key])}</td>`)
    const attachedFile = group.fileUpload ? data[group.key]?.attached_file : null
    return `
    <div class="section">
      <h3>${group.icon} ${group.title}</h3>
      <table>${pairCells(cells)}</table>
      ${attachedFile ? `<p style="margin-top:6px;font-size:10px"><strong>Archivo adjunto:</strong> ${fmt(attachedFile.name)}</p>` : ''}
    </div>`
  }).join('')

  const checklistRows = module.activities.map((act, i) => `
    <tr>
      <td style="width:24px;text-align:center;background:${checkBg(data.activities_checklist?.[act.key])}">${checkIcon(data.activities_checklist?.[act.key])}</td>
      <td style="background:${checkBg(data.activities_checklist?.[act.key])}">${i + 1}. ${act.label}</td>
    </tr>`).join('')

  const testRows = module.tests.map(test => `
    <tr>
      <td style="width:24px;text-align:center;background:${checkBg(data.tests?.[test.key])}">${checkIcon(data.tests?.[test.key])}</td>
      <td style="background:${checkBg(data.tests?.[test.key])}">${test.label}</td>
    </tr>`).join('')

  return `
  <div class="section">
    <h3>Contrato y Contacto</h3>
    <table>
      <tr><th>Contratado</th><td>${data.maintenance_contracted ? 'SÍ' : 'NO'}</td><th>Proveedor</th><td>${fmt(data.provider)}</td></tr>
      <tr><th>Contacto</th><td colspan="3">${fmt(data.contact)}</td></tr>
    </table>
  </div>

  <div class="section">
    <h3>Datos del Equipo</h3>
    <table>${pairCells(equipInfoCells)}</table>
  </div>

  <div class="section">
    <h3>Condiciones Ambientales</h3>
    <table>
      <tr><th>Temperatura</th><td>${fmt(data.environmental?.temperature)} °C</td><th>Humedad</th><td>${fmt(data.environmental?.humidity)} %</td></tr>
    </table>
  </div>

  ${readingsSections}

  <div class="section">
    <h3>Actividades Realizadas</h3>
    <table><tbody>${checklistRows}</tbody></table>
  </div>

  <div class="section">
    <h3>Pruebas</h3>
    <table><tbody>${testRows}</tbody></table>
    ${data.pending_execution !== null ? `<p style="margin-top:6px;padding:4px 8px;background:${data.pending_execution ? '#FEF3C7' : '#D1FAE5'};border-radius:4px;font-size:10px;font-weight:600">Pendiente de ejecución: ${data.pending_execution ? 'SÍ' : '✅ NO'}</p>` : ''}
  </div>

  <div class="section">
    <h3>Tiempo de Ejecución</h3>
    <table>
      <tr><th>Hora Llegada</th><td>${fmt(data.execution_time?.arrival_time)}</td><th>Hora Salida</th><td>${fmt(data.execution_time?.departure_time)}</td></tr>
      ${data.cancellation ? `<tr><th>Observaciones</th><td colspan="3">${data.cancellation}</td></tr>` : ''}
    </table>
  </div>`
}

// ─── EQUIPMENT SECTION DISPATCHER ─────────────────────────────────────────────
function buildEquipmentSection(report) {
  // Trabajos Varios only ever gets Encabezado/Cliente/Técnicos/Descripción
  // del Trabajo -- no Datos del Equipo, generic module section, or
  // Repuestos (the latter two skipped further below, in buildReportHTML).
  if (report.equipment_type === 'trabajos_varios') return ''
  const data = report.equipment_data
  if (!data || Object.keys(data).length === 0) return ''
  const module = EQUIPMENT_MODULES[report.equipment_type]
  if (!module) return ''
  if (module.id === 'ups') return buildUPSSection(data)
  if (module.id === 'ac') return buildACSection(data)
  return buildGenericSection(module, data)
}

// ─── COMPANY CONTACT BLOCK (only the fields the admin actually set) ───────────
// Sits under the logo/company name inside .header, not as its own .section --
// plain label:value lines rather than a table, matching the compact scale of
// .brand-sub right above it.
function buildCompanyContactBlock(branding) {
  const rows = [
    ['Correo(s)', branding?.company_emails],
    ['Dirección', branding?.address],
    ['Teléfono', branding?.phone],
    ['Sitio web', branding?.website],
  ].filter(([, v]) => v && v.trim())
  if (rows.length === 0) return ''

  return `
    <div class="brand-contact">
      ${rows.map(([label, value]) => `<div class="brand-contact-row">${label}: ${fmt(value)}</div>`).join('')}
    </div>`
}

// ─── BUILD HTML TEMPLATE ──────────────────────────────────────────────────────
function buildReportHTML(report, branding) {
  const brandLogo = branding?.logo_url || logoUrl
  const brandName = branding?.company_name || 'K Maintenance Report'
  const companyContactBlock = buildCompanyContactBlock(branding)
  const reportColor = branding?.report_color || '#3538CD'
  const serviceColor = {
    preventivo: '#10B981',
    correctivo: '#EF4444',
    arranque: '#F59E0B',
    varios: '#6B7280',
  }[report.service_type] ?? '#3538CD'

  const serviceLabel = {
    preventivo: 'Mantenimiento Preventivo',
    correctivo: 'Mantenimiento Correctivo',
    arranque: 'Arranque / Puesta en Marcha',
    varios: 'Varios',
  }[report.service_type] ?? report.service_type

  const STUB_LABELS = { bees: 'BEES', microdatacenter: 'Micro DataCenter' }
  const equipmentLabel = EQUIPMENT_MODULES[report.equipment_type]?.fullLabel
    ?? STUB_LABELS[report.equipment_type]
    ?? report.equipment_type

  const techs = report.technicians ?? []
  const parts = report.parts ?? []

  const techRows = techs.map(t => `
    <tr>
      <td>${fmt(t.technician_name)}</td>
      <td>${fmt(t.fault_time)}</td>
      <td>${fmt(t.arrival_pdv)}</td>
      <td>${fmt(t.departure_pdv)}</td>
      <td>${fmt(t.arrival_plant)}</td>
    </tr>`).join('') || `<tr><td colspan="5" style="color:#888;text-align:center">Sin técnicos registrados</td></tr>`

  const partRows = parts.map(p => `
    <tr>
      <td>${fmt(p.quantity)}</td>
      <td>${fmt(p.description)}</td>
      <td>${fmt(p.part_code)}</td>
    </tr>`).join('') || `<tr><td colspan="3" style="color:#888;text-align:center">Sin repuestos utilizados</td></tr>`

  const signatureSection = report.status === 'signed' ? `
    <div class="section">
      <h3>✅ Firma del Cliente</h3>
      <table>
        <tr><th>Firmado por</th><td>${fmt(report.client_signer_name)}</td><th>Cédula</th><td>${fmt(report.client_signer_id)}</td></tr>
        <tr><th>Fecha y hora</th><td colspan="3">${fmtDate(report.signed_at)}</td></tr>
      </table>
      ${report.client_signature_url ? `<img src="${report.client_signature_url}" style="max-height:80px;margin-top:8px;border:1px solid #ccc;border-radius:4px" crossorigin="anonymous">` : ''}
    </div>
  ` : `
    <div class="section" style="background:#FEF3C7;border:1px solid #F59E0B;border-radius:8px;padding:12px">
      <p style="color:#92400E;margin:0"><strong>Pendiente de firma</strong> — El cliente aún no ha firmado este reporte.</p>
    </div>
  `

  const equipmentSection = buildEquipmentSection(report)
  const photoSections = buildPhotoSections(report)

  // report.event is only embedded when this report is linked to a
  // scheduled visit (REPORT_SELECT in supabaseDB.js) -- null for most
  // reports, so this section is skipped entirely for those.
  const eventSection = report.event ? `
<div class="section">
  <h3>Evento</h3>
  <table>
    <tr><th>Código del Evento</th><td>${fmt(report.event.event_code)}</td><th>Nombre del Evento</th><td>${fmt(report.event.event_name)}</td></tr>
    <tr><th>Fecha del Evento</th><td>${fmtDate(report.event.event_date)}</td><th>Hora del Evento</th><td>${fmt(report.event.event_time?.slice(0, 5))}</td></tr>
  </table>
</div>
` : ''

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #1f2937; background: white; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid ${reportColor}; padding-bottom: 16px; margin-bottom: 20px; page-break-inside: avoid; break-inside: avoid; }
  .brand { display: flex; align-items: flex-start; gap: 12px; }
  .brand-icon { width: 96px; height: 96px; object-fit: contain; }
  .brand-name { font-size: 20px; font-weight: 800; color: ${reportColor}; }
  .brand-sub { font-size: 9px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; }
  .brand-contact { margin-top: 12px; }
  .brand-contact-row { font-size: 9px; color: #6b7280; line-height: 1.5; }
  .report-meta { text-align: right; }
  .report-number { font-size: 18px; font-weight: 800; color: #111827; }
  .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; color: white; font-size: 10px; font-weight: 700; background: ${serviceColor}; margin-top: 4px; }
  .section { margin-bottom: 16px; page-break-inside: avoid; break-inside: avoid; }
  .section h3 { font-size: 11px; font-weight: 700; color: ${reportColor}; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; page-break-inside: avoid; break-inside: avoid; }
  th, td { padding: 5px 8px; border: 1px solid #e5e7eb; text-align: left; }
  th { background: #f3f4f8; font-weight: 600; color: #374151; width: 120px; }
  tr:nth-child(even) td { background: #fafafa; }
  .work-text { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px; line-height: 1.6; white-space: pre-wrap; min-height: 60px; page-break-inside: avoid; break-inside: avoid; }
  img { page-break-inside: avoid; break-inside: avoid; }
  .photo-grid { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px; }
  .photo-grid img { width: 140px; height: 140px; object-fit: cover; border: 1px solid #e5e7eb; border-radius: 6px; }
  .footer { margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 12px; text-align: center; color: #9ca3af; font-size: 9px; page-break-inside: avoid; break-inside: avoid; }
  .footer-inner { display: flex; align-items: center; justify-content: center; gap: 8px; }
  .footer-logo { width: 42px; height: 42px; object-fit: contain; flex-shrink: 0; }
  .status-signed { color: #10B981; font-weight: 700; }
</style>
</head>
<body>

<div class="header">
  <div class="brand">
    <img class="brand-icon" src="${brandLogo}" alt="${brandName}">
    <div>
      <div class="brand-name">${brandName}</div>
      <div class="brand-sub">Informe de Servicio Técnico</div>
      ${companyContactBlock}
    </div>
  </div>
  <div class="report-meta">
    <div class="report-number">Reporte #${String(report.report_number || 0).padStart(4, '0')}</div>
    <div>${fmtDate(report.report_date)}</div>
    <div class="badge">${serviceLabel}</div>
    ${report.sc_code ? `<div style="margin-top:4px;color:#6b7280">SC: ${report.sc_code}</div>` : ''}
  </div>
</div>

${eventSection}
<div class="section">
  <h3>Información del Cliente</h3>
  <table>
    <tr><th>Cliente</th><td>${fmt(report.client_name)}</td><th>Dirección</th><td>${fmt(report.client_address)}</td></tr>
    ${report.project_name ? `<tr><th>Proyecto</th><td colspan="3">${report.project_name}</td></tr>` : ''}
  </table>
</div>

${report.equipment_type !== 'trabajos_varios' ? `
<div class="section">
  <h3>Datos del Equipo</h3>
  <table>
    <tr><th>Equipo</th><td>${equipmentLabel}</td><th>Marca</th><td>${fmt(report.brand)}</td></tr>
    <tr><th>Modelo</th><td>${fmt(report.model)}</td><th>Serie</th><td>${fmt(report.serial_number)}</td></tr>
    <tr><th>N° Activo</th><td>${fmt(report.asset_number)}</td><th>Ubicación</th><td>${fmt(report.location)}</td></tr>
  </table>
</div>` : ''}

${equipmentSection}

<div class="section">
  <h3>Técnicos Involucrados</h3>
  <table>
    <thead>
      <tr style="background:#f3f4f8">
        <th>Técnico</th><th>Hora Falla</th><th>Llegada PDV</th><th>Salida PDV</th><th>Llegada Planta</th>
      </tr>
    </thead>
    <tbody>${techRows}</tbody>
  </table>
</div>

<div class="section">
  <h3>Trabajo Realizado</h3>
  <div class="work-text">${fmt(report.work_description)}</div>
</div>

${report.observations ? `
<div class="section">
  <h3>Observaciones</h3>
  <div class="work-text">${report.observations}</div>
</div>` : ''}

${report.equipment_type !== 'trabajos_varios' ? `
<div class="section">
  <h3>Repuestos Utilizados</h3>
  <table>
    <thead>
      <tr style="background:#f3f4f8"><th style="width:60px">Cant.</th><th>Descripción</th><th style="width:120px">Código</th></tr>
    </thead>
    <tbody>${partRows}</tbody>
  </table>
</div>` : ''}

${photoSections}

${signatureSection}

<div class="footer">
  <div class="footer-inner">
    <img class="footer-logo" src="${logoUrl}" alt="K Maintenance Report">
    <span>
      K Maintenance Report · Este documento es un informe oficial de servicio técnico.<br>
      Generado el ${new Date().toLocaleString('es-CR')} · Reporte ID: ${report.id ?? '—'}
    </span>
  </div>
</div>

</body>
</html>`
}

// ─── CONVERT IMAGE URL TO BASE64 ──────────────────────────────────────────────
async function imageUrlToBase64(url) {
  try {
    const response = await fetch(url)
    // Without this check, a failed fetch (e.g. a transient 404/5xx) still
    // "succeeds" here and .blob() wraps the error body -- producing a
    // bogus data: URL that then REPLACES the perfectly usable direct image
    // URL instead of the caller falling back to it, so the signature (or
    // any other embedded image) silently renders as nothing.
    if (!response.ok) throw new Error(`Fetch failed: ${response.status}`)
    const blob = await response.blob()
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result)
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(blob)
    })
  } catch (err) {
    logError('pdfService.imageUrlToBase64', err)
    return null
  }
}

// Pre-process report: convert signature URL and report photos to base64 for
// PDF embedding. report-photos is a private bucket -- each photo only has a
// storage_path until getPhotoUrl signs it -- and, same as the signature,
// converted to a data: URL rather than embedded as a live signed URL for
// reliability with html2canvas. A photo that fails to sign/fetch is dropped
// (dataUrl left undefined) rather than failing the whole PDF -- see
// buildPhotoSections, which skips anything without one.
async function prepareReportForPDF(report) {
  const prepared = { ...report }
  if (prepared.client_signature_url &&
      !prepared.client_signature_url.startsWith('data:') &&
      prepared.status === 'signed') {
    const base64 = await imageUrlToBase64(prepared.client_signature_url)
    if (base64) prepared.client_signature_url = base64
  }
  if (prepared.photos?.length) {
    prepared.photos = await Promise.all(prepared.photos.map(async (p) => {
      const url = await getPhotoUrl(p.storage_path)
      const dataUrl = url ? await imageUrlToBase64(url) : null
      return { ...p, dataUrl }
    }))
  }
  return prepared
}

// ─── DOWNLOAD PDF ─────────────────────────────────────────────────────────────
function reportPdfFilename(report) {
  return `KMR-Reporte-${String(report.report_number ?? 0).padStart(4, '0')}-${report.client_name?.replace(/\s+/g, '_') ?? 'cliente'}.pdf`
}

function triggerBrowserDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export async function downloadReportPDF(report) {
  const filename = reportPdfFilename(report)
  const { blob, pdfStoragePath } = await getOrGenerateReportPDF(report)
  triggerBrowserDownload(blob, filename)
  return { filename, pdfStoragePath }
}

// ─── REGENERATE ONE REPORT'S CACHED PDF ───────────────────────────────────────
// Re-renders from the current report data/branding and overwrites the cached
// copy at its existing storage path. Storage/RPC policies restrict the write
// to the report's own technician or an admin (016_report_pdf_cache_for_admin.sql).
export async function regenerateReportPDF(reportId) {
  const full = await getReport(reportId)
  const blob = await getReportPDFBlob(full)
  const pdfStoragePath = await uploadReportPDF(full.id, blob)
  return { blob, pdfStoragePath }
}

// ─── REGENERATE EVERY CACHED PDF (e.g. after a branding/template change) ─────
// Only touches reports that actually have a cached copy (pdf_storage_path set)
// -- others regenerate fresh on next download anyway, via getOrGenerateReportPDF.
// Admin-only in practice: getAllReports() and the report-pdfs write policies
// both require it (see 016_report_pdf_cache_for_admin.sql).
export async function regenerateAllReportPDFs(onProgress) {
  const all = await getAllReports()
  const cached = all.filter(r => r.pdf_storage_path)
  const failed = []

  for (let i = 0; i < cached.length; i++) {
    const summary = cached[i]
    try {
      await regenerateReportPDF(summary.id)
    } catch (err) {
      failed.push({ reportNumber: summary.report_number, error: err.message ?? String(err) })
    }
    onProgress?.({ done: i + 1, total: cached.length, failed: [...failed] })
  }

  return { total: cached.length, succeeded: cached.length - failed.length, failed }
}

// ─── REGENERATE ONE USER'S REPORT PDFS (DeleteUserModal step 1) ──────────────
// Unlike regenerateAllReportPDFs, this doesn't skip reports without a cached
// copy yet -- the point here is to guarantee every one of this user's
// reports has an archived PDF before their reports get deleted, not just to
// refresh existing ones.
export async function regenerateReportsPDFsForUser(userId, onProgress) {
  const reports = await getUserRelatedReports(userId)
  const failed = []

  for (let i = 0; i < reports.length; i++) {
    const summary = reports[i]
    try {
      await regenerateReportPDF(summary.id)
    } catch (err) {
      failed.push({ reportNumber: summary.report_number, error: err.message ?? String(err) })
    }
    onProgress?.({ done: i + 1, total: reports.length, failed: [...failed] })
  }

  return { total: reports.length, succeeded: reports.length - failed.length, failed }
}

// ─── DOWNLOAD A SET OF REPORTS' PDFS (DeleteUserModal step 2, LiberarEspacio) ─
// A single report downloads as its own PDF, same as downloadReportPDF. More
// than one bundles into a single .zip instead of firing off N separate
// downloads (most browsers throttle/prompt on multiple auto-downloads, and
// it's just nicer to hand the admin one file). `summaries` just needs
// `id`/`report_number` per entry -- report rows as returned by getReports()/
// getAllReports() already fit.
export async function downloadReportsPDFs(summaries, zipLabel, onProgress) {
  const failed = []
  const built = []

  for (let i = 0; i < summaries.length; i++) {
    const summary = summaries[i]
    try {
      const full = await getReport(summary.id)
      const { blob } = await getOrGenerateReportPDF(full)
      built.push({ filename: reportPdfFilename(full), blob })
    } catch (err) {
      failed.push({ reportNumber: summary.report_number, error: err.message ?? String(err) })
    }
    onProgress?.({ done: i + 1, total: summaries.length, failed: [...failed] })
  }

  if (built.length === 1) {
    triggerBrowserDownload(built[0].blob, built[0].filename)
  } else if (built.length > 1) {
    const { default: JSZip } = await import('jszip')
    const zip = new JSZip()
    for (const { filename, blob } of built) zip.file(filename, blob)
    const zipBlob = await zip.generateAsync({ type: 'blob' })
    const safeLabel = (zipLabel || 'reportes').replace(/\s+/g, '_')
    triggerBrowserDownload(zipBlob, `KMR-Reportes-${safeLabel}.zip`)
  }

  return { total: summaries.length, succeeded: summaries.length - failed.length, failed }
}

export async function downloadReportsPDFsForUser(userId, userLabel, onProgress) {
  const reports = await getUserRelatedReports(userId)
  return downloadReportsPDFs(reports, userLabel, onProgress)
}

// ─── CLEAR CACHED PDFS FOR A SET OF REPORTS (LiberarEspacio) ─────────────────
// Frees the Storage space a report's cached PDF was using without deleting
// the report itself -- it's a derived artifact, regenerated fresh from the
// report's current data the next time someone downloads it. Reports with no
// cached PDF are skipped (nothing to clear), not counted as failed.
export async function clearCachedPdfs(summaries, onProgress) {
  const failed = []
  let cleared = 0

  for (let i = 0; i < summaries.length; i++) {
    const summary = summaries[i]
    try {
      if (summary.pdf_storage_path) {
        await clearReportCachedPdf(summary.id, summary.pdf_storage_path)
        cleared++
      }
    } catch (err) {
      failed.push({ reportNumber: summary.report_number, error: err.message ?? String(err) })
    }
    onProgress?.({ done: i + 1, total: summaries.length, failed: [...failed] })
  }

  return { total: summaries.length, cleared, failed }
}

// ─── GET OR GENERATE (permanent archive: reuse a cached PDF when one exists) ──
export async function getOrGenerateReportPDF(report) {
  if (report.pdf_storage_path) {
    try {
      const url = await getReportPdfUrl(report.pdf_storage_path)
      if (url) {
        const res = await fetch(url)
        if (res.ok) return { blob: await res.blob(), pdfStoragePath: report.pdf_storage_path, fromCache: true }
      }
    } catch {
      // fall through and regenerate
    }
  }

  const blob = await getReportPDFBlob(report)
  let pdfStoragePath = null
  try {
    pdfStoragePath = await uploadReportPDF(report.id, blob)
  } catch {
    // Best-effort cache write -- never block the download on a caching failure.
  }
  return { blob, pdfStoragePath, fromCache: false }
}

// ─── GET PDF AS BLOB (always generates fresh) ─────────────────────────────────
export async function getReportPDFBlob(report) {
  const html2pdf = await getHtml2pdf()
  const prepared = await prepareReportForPDF(report)
  // Best-effort: an anonymous/expired session or a transient error here
  // should never block generating the PDF, just fall back to default branding.
  const branding = await getPublicBranding().catch(err => {
    logError('pdfService.getReportPDFBlob.getPublicBranding', err)
    return null
  })
  const container = document.createElement('div')
  container.innerHTML = buildReportHTML(prepared, branding)
  // Deliberately never attached to document.body. html2pdf's own
  // .from(container) deep-clones this element into ITS OWN internal
  // container/overlay (an already-hidden, full-viewport, opacity:0 div it
  // creates, appends, captures with html2canvas, and removes itself) --
  // our container only ever needs to exist as an in-memory DOM tree for
  // that clone to read.
  //
  // A previous version of this code did append container to document.body
  // (originally unstyled, later given position:fixed + an off-screen/
  // behind-content position to stop it flashing on screen). Both were
  // redundant with html2pdf's own hiding, and the positioned version
  // actively broke it: those inline styles carry over onto html2pdf's
  // clone via cloneNode, and a position:fixed clone nested inside
  // html2pdf's own container escapes that container's own layout sizing
  // (position:fixed is relative to the viewport, not the DOM parent) --
  // verified against the real html2pdf.js/html2canvas bundle, that
  // produced a 0-height canvas every time. Every downloaded/emailed PDF
  // opened with blank pages.
  return await html2pdf()
    .set({
      // A per-page margin here (rather than relying on the body's CSS
      // padding) is what makes it apply to every page, not just the top
      // of the first one -- html2canvas renders the whole document as one
      // tall image before jsPDF slices it into pages, so in-document
      // padding only ever shows once, at the very start of that image.
      margin: [10, 10, 10, 10],
      image: { type: 'jpeg', quality: 0.95 },
      // scale: 2 (every pixel rendered at 2x for print sharpness) made
      // html2canvas rasterize a genuinely huge canvas for a full multi-
      // section A4 report -- on some GPUs that's enough to cause a brief
      // full-screen white flash while the browser paints/composites it,
      // independent of the (already-hidden, see .html2pdf__overlay in
      // index.css) source DOM's own visibility. Not reproducible in
      // headless Chrome (software rendering), only on real hardware --
      // 1.5 cuts the rasterized pixel count by ~44% ((1.5/2)^2) as a
      // trade-off against that, still noticeably sharper than 1x.
      html2canvas: { scale: 1.5, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      // 'avoid-all' checks every element's own bounding box against the
      // page boundary and forces a break before it rather than splitting
      // it -- this is what actually stops mid-word/mid-row cuts. 'css'
      // (honors page-break-inside/break-inside, e.g. .section/table/img
      // below) and 'legacy' are kept as fallbacks for anything 'avoid-all'
      // doesn't catch on its own.
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
    })
    .from(container)
    .outputPdf('blob')
}
