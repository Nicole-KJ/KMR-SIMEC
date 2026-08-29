import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Palette, Settings, Loader, RefreshCw, Camera, AlertCircle, X, Trash2, HardDrive, Database, FolderOutput } from 'lucide-react'
import { regenerateAllReportPDFs } from '../services/pdfService'
import {
  getCompanySettings, updateCompanySettings, uploadCompanyLogo, removeCompanyLogo,
  getStorageUsage, getReportPdfStats, getDatabaseSize, getDatabaseTableSizes,
} from '../services/supabaseDB'
import { useToast } from '../contexts/ToastContext'
import { logError } from '../utils/logger'

// Must match the PDF template's own default (pdfService.js buildReportHTML).
const DEFAULT_REPORT_COLOR = '#3538CD'

// Supabase's free-plan caps, purely as a visual reference point for the
// progress bars -- verify the current numbers on the project's own Billing
// page if it matters, plans/limits can change.
const FREE_PLAN_STORAGE_BYTES = 1024 * 1024 * 1024
const FREE_PLAN_DATABASE_BYTES = 500 * 1024 * 1024

const BUCKET_LABELS = {
  'report-photos': 'Fotos de reportes',
  'report-pdfs': 'PDFs de reportes',
  signatures: 'Firmas',
  'equipment-files': 'Archivos de equipos',
  'company-logo': 'Logo de la empresa',
  avatars: 'Fotos de perfil',
}

const TABLE_LABELS = {
  service_reports: 'Reportes',
  report_photos: 'Fotos de reportes (registros)',
  report_parts: 'Repuestos de reportes',
  report_technicians: 'Técnicos de reportes',
  service_events: 'Eventos',
  profiles: 'Usuarios',
  company_settings: 'Configuración de la empresa',
  clients: 'Clientes',
}

function formatBytes(bytes) {
  if (!bytes) return '0 KB'
  const units = ['bytes', 'KB', 'MB', 'GB']
  let i = 0
  let n = bytes
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++ }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

// Shared by the Storage and Base de Datos usage blocks below.
function UsageBar({ totalBytes, limitBytes, limitLabel }) {
  const pct = Math.min(100, (totalBytes / limitBytes) * 100)
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 18, fontWeight: 800 }}>{formatBytes(totalBytes)}</span>
        <span style={{ fontSize: 12, color: 'var(--clr-text-light)', alignSelf: 'flex-end' }}>
          de {formatBytes(limitBytes)} ({limitLabel})
        </span>
      </div>
      <div style={{ height: 8, borderRadius: 'var(--radius-full)', background: 'var(--clr-border)', overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`, borderRadius: 'var(--radius-full)',
          background: pct >= 90 ? 'var(--clr-danger)' : pct >= 70 ? 'var(--clr-warning)' : 'var(--clr-primary)',
          transition: 'width 0.3s ease',
        }} />
      </div>
    </div>
  )
}

// items: [{ key, label, count?, bytes }]
function UsageBreakdownList({ items, emptyMessage }) {
  if (items.length === 0) return <p style={{ fontSize: 13, color: 'var(--clr-text-light)' }}>{emptyMessage}</p>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map(({ key, label, count, bytes }) => (
        <div key={key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
          <span>{label} {count != null && <span style={{ color: 'var(--clr-text-light)' }}>({count})</span>}</span>
          <span style={{ fontWeight: 600 }}>{formatBytes(bytes)}</span>
        </div>
      ))}
    </div>
  )
}

// A plain text input with a small "×" to clear it in one click, shown only
// once there's something to clear.
function ClearableInput({ value, onChange, placeholder }) {
  return (
    <div style={{ position: 'relative' }}>
      <input className="form-control" value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} style={{ paddingRight: value ? 34 : undefined }} />
      {value && (
        <button type="button" onClick={() => onChange('')} title="Quitar"
          style={{
            position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer', color: 'var(--clr-text-light)',
            display: 'flex', padding: 2,
          }}>
          <X size={15} />
        </button>
      )}
    </div>
  )
}

export default function AppCustomization() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [regenerating, setRegenerating] = useState(false)
  const [regenProgress, setRegenProgress] = useState(null)

  const [loadingSettings, setLoadingSettings] = useState(true)
  const [companyName, setCompanyName] = useState('')
  const [companyEmails, setCompanyEmails] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [website, setWebsite] = useState('')
  const [logoFile, setLogoFile] = useState(null)
  const [logoPreview, setLogoPreview] = useState(null)
  const [savedLogoPath, setSavedLogoPath] = useState(null)
  const [logoRemoved, setLogoRemoved] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsError, setSettingsError] = useState('')

  const [reportColor, setReportColor] = useState('')
  const [savingColor, setSavingColor] = useState(false)

  const [storageUsage, setStorageUsage] = useState(null)
  const [reportPdfStats, setReportPdfStats] = useState(null)
  const [dbSize, setDbSize] = useState(null)
  const [dbTableSizes, setDbTableSizes] = useState(null)
  const [loadingStorage, setLoadingStorage] = useState(true)
  const [storageError, setStorageError] = useState('')

  useEffect(() => {
    let cancelled = false
    getCompanySettings()
      .then(data => {
        if (cancelled || !data) return
        setCompanyName(data.company_name ?? '')
        setCompanyEmails(data.company_emails ?? '')
        setAddress(data.address ?? '')
        setPhone(data.phone ?? '')
        setWebsite(data.website ?? '')
        setLogoPreview(data.logo_url ?? null)
        setSavedLogoPath(data.logo_storage_path ?? null)
        setReportColor(data.report_color ?? '')
      })
      .catch(err => {
        logError('AppCustomization.getCompanySettings', err)
        setSettingsError('No se pudo cargar la configuración actual.')
      })
      .finally(() => { if (!cancelled) setLoadingSettings(false) })
    return () => { cancelled = true }
  }, [])

  function loadStorageUsage() {
    setLoadingStorage(true)
    setStorageError('')
    Promise.all([getStorageUsage(), getReportPdfStats(), getDatabaseSize(), getDatabaseTableSizes()])
      .then(([usage, pdfStats, size, tableSizes]) => {
        setStorageUsage(usage); setReportPdfStats(pdfStats); setDbSize(size); setDbTableSizes(tableSizes)
      })
      .catch(err => {
        logError('AppCustomization.getStorageUsage', err)
        setStorageError('No se pudo cargar el uso de almacenamiento.')
      })
      .finally(() => setLoadingStorage(false))
  }

  useEffect(() => { loadStorageUsage() }, [])

  function handleLogoPick(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
    setLogoRemoved(false)
  }

  function handleRemoveLogo() {
    setLogoFile(null)
    setLogoPreview(null)
    setLogoRemoved(true)
    // The report color only exists to complement a custom logo -- without
    // one, reset back to the app's own branding.
    setReportColor('')
  }

  async function handleSaveSettings() {
    setSettingsError('')
    setSavingSettings(true)
    try {
      const fields = {
        company_name: companyName.trim(),
        company_emails: companyEmails.trim(),
        address: address.trim(),
        phone: phone.trim(),
        website: website.trim(),
      }

      if (logoFile) {
        const { path, url } = await uploadCompanyLogo(logoFile)
        fields.logo_storage_path = path
        setLogoPreview(url)
        setLogoFile(null)
        setSavedLogoPath(path)
      } else if (logoRemoved) {
        await removeCompanyLogo(savedLogoPath)
        fields.logo_storage_path = null
        fields.report_color = null
        setSavedLogoPath(null)
        setReportColor('')
      }

      await updateCompanySettings(fields)
      setLogoRemoved(false)
      showToast('Configuración guardada.', 'success')
    } catch (err) {
      logError('AppCustomization.handleSaveSettings', err)
      setSettingsError(err.message ?? 'Error al guardar la configuración')
    } finally {
      setSavingSettings(false)
    }
  }

  async function handleSaveReportColor() {
    setSavingColor(true)
    try {
      await updateCompanySettings({ report_color: reportColor || null })
      showToast('Color de reporte guardado.', 'success')
    } catch (err) {
      logError('AppCustomization.handleSaveReportColor', err)
      showToast('Error al guardar el color: ' + (err.message ?? err))
    } finally {
      setSavingColor(false)
    }
  }

  async function handleRegeneratePdfs() {
    if (!window.confirm('Esto vuelve a generar el PDF de cada reporte que ya tiene uno en caché (por ejemplo, para aplicar un cambio de marca). Puede tardar varios minutos según la cantidad de reportes. ¿Continuar?')) return
    setRegenerating(true)
    setRegenProgress(null)
    try {
      const result = await regenerateAllReportPDFs(setRegenProgress)
      if (result.total === 0) {
        showToast('No hay PDFs en caché para regenerar.', 'success')
      } else if (result.failed.length === 0) {
        showToast(`Se regeneraron ${result.succeeded} de ${result.total} PDFs.`, 'success')
      } else {
        showToast(`Se regeneraron ${result.succeeded} de ${result.total} PDFs. ${result.failed.length} fallaron — revisa la consola.`, 'warning')
        logError('AppCustomization.handleRegeneratePdfs', new Error('Some PDFs failed to regenerate'), { failed: result.failed })
      }
    } catch (err) {
      logError('AppCustomization.handleRegeneratePdfs', err)
      showToast('Error al regenerar los PDFs: ' + (err.message ?? err))
    } finally {
      setRegenerating(false)
    }
  }

  return (
    <div className="content-wrapper fade-in">
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}><Settings size={22} style={{ verticalAlign: 'middle', marginRight: 8 }} />Configuración de la App</h1>
        <p style={{ color: 'var(--clr-text-light)', fontSize: 13, marginTop: 4 }}>Marca, reporte y otros ajustes de apariencia de K Maintenance Report</p>
      </div>

      {/* Company profile + logo */}
      <div className="card" style={{ marginBottom: 24, maxWidth: 640 }}>
        <p className="section-tag">Personalización</p>
        <p style={{ color: 'var(--clr-text-light)', fontSize: 13, marginBottom: 16 }}>
          La información de empresa será visible en los reportes generados y la aplicación del lado de los usuarios con rol "Cliente".
        </p>

        {settingsError && (
          <div style={{
            background: 'var(--clr-danger-bg)', color: 'var(--clr-danger)',
            padding: '10px 14px', borderRadius: 'var(--radius-md)',
            marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center',
            fontSize: 13, fontWeight: 500,
          }}>
            <AlertCircle size={15} /> {settingsError}
          </div>
        )}

        {loadingSettings ? (
          <div style={{ textAlign: 'center', padding: 32 }}>
            <Loader size={28} className="spin" color="var(--clr-primary)" />
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo de la empresa"
                    style={{ width: 88, height: 88, borderRadius: 'var(--radius-md)', objectFit: 'contain', background: '#fff', boxShadow: 'var(--shadow-md)' }} />
                ) : (
                  <div style={{
                    width: 88, height: 88, borderRadius: 'var(--radius-md)', background: 'var(--clr-surface-2)',
                    border: '1.5px dashed var(--clr-border)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Palette size={26} color="var(--clr-text-light)" />
                  </div>
                )}
                <label htmlFor="company-logo-input" style={{
                  position: 'absolute', bottom: -4, right: -4, width: 28, height: 28, borderRadius: '50%',
                  background: 'var(--clr-primary)', color: 'white', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', cursor: 'pointer', border: '2px solid var(--clr-surface)',
                }}>
                  <Camera size={13} />
                  <input id="company-logo-input" type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoPick} />
                </label>
              </div>
              <div style={{ fontSize: 12, color: 'var(--clr-text-light)', display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
                <div>Logo de la empresa.<br />Se usará en reportes y en la app.</div>
                {logoPreview && (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={handleRemoveLogo}>
                    <Trash2 size={13} /> Quitar logo
                  </button>
                )}
              </div>
            </div>

            <div className="form-row form-row-2">
              <div className="form-group">
                <label className="form-label">Nombre de la empresa</label>
                <ClearableInput value={companyName} onChange={setCompanyName} placeholder="K Maintenance Report" />
              </div>
              <div className="form-group">
                <label className="form-label">Correo(s) de la empresa</label>
                <ClearableInput value={companyEmails} onChange={setCompanyEmails} placeholder="contacto@empresa.com, soporte@empresa.com" />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Dirección</label>
              <ClearableInput value={address} onChange={setAddress} placeholder="Dirección de la empresa" />
            </div>

            <div className="form-row form-row-2">
              <div className="form-group">
                <label className="form-label">Teléfono</label>
                <ClearableInput value={phone} onChange={setPhone} placeholder="+506 0000-0000" />
              </div>
              <div className="form-group">
                <label className="form-label">Sitio web</label>
                <ClearableInput value={website} onChange={setWebsite} placeholder="https://empresa.com" />
              </div>
            </div>

            <button type="button" className="btn btn-primary" onClick={handleSaveSettings} disabled={savingSettings}>
              {savingSettings ? <><Loader size={14} className="spin" /> Guardando...</> : 'Guardar'}
            </button>
          </>
        )}
      </div>

      {/* Report accent color -- only meaningful alongside a custom logo */}
      <div className="card" style={{ marginBottom: 24, maxWidth: 640 }}>
        <p className="section-tag">Color de Reporte</p>
        <p style={{ color: 'var(--clr-text-light)', fontSize: 13, marginBottom: 16 }}>
          {logoPreview
            ? 'Reemplaza el color morado en los reportes PDF — el nombre de la empresa, los títulos de sección y la línea bajo el encabezado. Si no eliges uno, se mantiene el color actual.'
            : 'Sube un logo de la empresa arriba para poder elegir un color — sin un logo propio, los reportes usan la marca de la app tal cual.'}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <input type="color" value={reportColor || DEFAULT_REPORT_COLOR} onChange={e => setReportColor(e.target.value)}
            disabled={!logoPreview}
            style={{
              width: 48, height: 36, border: '1.5px solid var(--clr-border)', borderRadius: 'var(--radius-md)',
              padding: 2, background: 'var(--clr-surface)',
              cursor: logoPreview ? 'pointer' : 'not-allowed', opacity: logoPreview ? 1 : 0.5,
            }} />
          <span style={{ fontSize: 13, fontFamily: 'monospace', color: 'var(--clr-text-light)' }}>
            {(reportColor || DEFAULT_REPORT_COLOR).toUpperCase()}
          </span>
          {reportColor && logoPreview && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setReportColor('')}>
              <X size={13} /> Quitar
            </button>
          )}
        </div>
        <button type="button" className="btn btn-primary" onClick={handleSaveReportColor} disabled={savingColor || !logoPreview}>
          {savingColor ? <><Loader size={14} className="spin" /> Guardando...</> : 'Guardar'}
        </button>
      </div>

      {/* PDF cache maintenance */}
      <div className="card" style={{ marginBottom: 24, maxWidth: 640 }}>
        <p className="section-tag">Regenerar PDFs</p>
        <p style={{ color: 'var(--clr-text-light)', fontSize: 13, marginBottom: 14 }}>
          Vuelve a generar el PDF de cada reporte que ya tiene una copia en caché — útil después de un cambio de marca o de plantilla.
        </p>
        <button type="button" className="btn btn-secondary" onClick={handleRegeneratePdfs} disabled={regenerating}>
          {regenerating
            ? <><Loader size={14} className="spin" /> Regenerando {regenProgress ? `${regenProgress.done}/${regenProgress.total}` : '...'}</>
            : <><RefreshCw size={14} /> Regenerar PDFs en caché</>}
        </button>
        {regenerating && regenProgress?.failed?.length > 0 && (
          <p style={{ color: 'var(--clr-danger)', fontSize: 12, marginTop: 8 }}>
            {regenProgress.failed.length} reporte(s) fallaron hasta ahora.
          </p>
        )}
      </div>

      {/* Storage usage */}
      <div className="card" style={{ marginBottom: 24, maxWidth: 640 }}>
        <div className="section-header">
          <p className="section-tag" style={{ margin: 0 }}><HardDrive size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />Almacenamiento</p>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={loadStorageUsage} disabled={loadingStorage}>
              {loadingStorage ? <Loader size={13} className="spin" /> : <RefreshCw size={13} />} Actualizar
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate('/admin/liberar-espacio')}>
              <FolderOutput size={13} /> Liberar espacio de almacenamiento
            </button>
          </div>
        </div>
        <p style={{ color: 'var(--clr-text-light)', fontSize: 13, marginBottom: 16 }}>
          Espacio usado en Supabase -- Storage (archivos) y Base de Datos son cosas distintas y cada una tiene su
          propio límite en el plan gratuito. Un reporte guardado y su PDF también son cosas distintas: crear un
          reporte sí usa Base de Datos, pero solo cuenta en Storage una vez que se genera/descarga su PDF.
        </p>

        {loadingStorage ? (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <Loader size={24} className="spin" color="var(--clr-primary)" />
          </div>
        ) : storageError ? (
          <p style={{ color: 'var(--clr-danger)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertCircle size={14} /> {storageError}
          </p>
        ) : (
          <>
            {/* Storage (files) */}
            <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
              <HardDrive size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />Storage (archivos)
            </p>
            <UsageBar
              totalBytes={storageUsage.reduce((sum, b) => sum + Number(b.total_bytes), 0)}
              limitBytes={FREE_PLAN_STORAGE_BYTES}
              limitLabel="plan gratuito"
            />
            {reportPdfStats && (
              <p style={{ fontSize: 12, color: 'var(--clr-text-light)', marginBottom: 14 }}>
                <strong>{reportPdfStats.reports_with_cached_pdf}</strong> de <strong>{reportPdfStats.total_reports}</strong> reporte(s) tienen un PDF en caché.
              </p>
            )}
            <UsageBreakdownList
              emptyMessage="No hay archivos en Storage todavía."
              items={storageUsage.map(b => ({
                key: b.bucket_id, label: BUCKET_LABELS[b.bucket_id] ?? b.bucket_id,
                count: b.file_count, bytes: Number(b.total_bytes),
              }))}
            />

            <hr className="section-divider" style={{ margin: '20px 0' }} />

            {/* Database */}
            <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
              <Database size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />Base de Datos
            </p>
            <UsageBar
              totalBytes={Number(dbSize?.total_bytes ?? 0)}
              limitBytes={FREE_PLAN_DATABASE_BYTES}
              limitLabel="plan gratuito"
            />
            <UsageBreakdownList
              emptyMessage="No hay datos todavía."
              items={(dbTableSizes ?? []).map(t => ({
                key: t.table_name, label: TABLE_LABELS[t.table_name] ?? t.table_name,
                count: Number(t.row_count), bytes: Number(t.table_bytes),
              }))}
            />
          </>
        )}
      </div>
    </div>
  )
}
