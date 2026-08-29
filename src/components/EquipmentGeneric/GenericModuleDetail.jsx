import { MeasurementItem, ChecklistItem } from './shared'

export default function GenericModuleDetail({ config, data, fileUrls }) {
  const ed = data
  return (
    <>
      <div className="card" style={{ gridColumn:'span 2' }}>
        <p className="section-tag">📋 Contrato y Contacto</p>
        <div className="detail-measurement-grid">
          <MeasurementItem label="Contratado" value={ed.maintenance_contracted ? 'SÍ' : 'NO'} />
          <MeasurementItem label="Proveedor" value={ed.provider} />
          <MeasurementItem label="Contacto" value={ed.contact} />
        </div>
      </div>

      <div className="card" style={{ gridColumn:'span 2' }}>
        <p className="section-tag">🔧 Datos del Equipo</p>
        <div className="detail-measurement-grid">
          {config.equipmentInfoFields.map(field => {
            const rawValue = ed.equipment_info?.[field.key]
            const value = field.type === 'select'
              ? (field.options.find(o => o.value === rawValue)?.label ?? rawValue)
              : rawValue
            return <MeasurementItem key={field.key} label={field.label} value={value} />
          })}
        </div>
      </div>

      <div className="card">
        <p className="section-tag">🌡️ Condiciones Ambientales</p>
        <div className="detail-measurement-grid">
          <MeasurementItem label="Temperatura" value={ed.environmental?.temperature ? `${ed.environmental.temperature} °C` : ''} />
          <MeasurementItem label="Humedad" value={ed.environmental?.humidity ? `${ed.environmental.humidity} %` : ''} />
        </div>
      </div>

      {config.readingsGroups.map(group => {
        const attachedFile = group.fileUpload ? ed[group.key]?.attached_file : null
        return (
          <div className="card" key={group.key}>
            <p className="section-tag">{group.icon} {group.title}</p>
            <div className="detail-measurement-grid">
              {group.fields.map(field => (
                <MeasurementItem key={field.key} label={field.label} value={ed[group.key]?.[field.key]} />
              ))}
            </div>
            {attachedFile && (
              <div style={{ marginTop:12, paddingTop:12, borderTop:'1px solid var(--clr-border)' }}>
                <p style={{ fontSize:13, fontWeight:600, marginBottom:6 }}>Archivo adjunto</p>
                {fileUrls?.[group.key] ? (
                  <a href={fileUrls[group.key]} target="_blank" rel="noreferrer" style={{ fontSize:13 }}>
                    📎 {attachedFile.name} <span style={{ color:'var(--clr-text-light)' }}>({attachedFile.type || 'archivo'})</span>
                  </a>
                ) : (
                  <span style={{ fontSize:13 }}>
                    📎 {attachedFile.name} <span style={{ color:'var(--clr-text-light)' }}>({attachedFile.type || 'archivo'})</span>
                  </span>
                )}
              </div>
            )}
          </div>
        )
      })}

      {ed.activities_checklist && (
        <div className="card" style={{ gridColumn:'span 2' }}>
          <p className="section-tag">📋 Actividades Realizadas</p>
          <div className="detail-checklist">
            {config.activities.map(({ key, label }) => (
              <ChecklistItem key={key} done={ed.activities_checklist[key]} label={label} />
            ))}
          </div>
        </div>
      )}

      {ed.tests && (
        <div className="card" style={{ gridColumn:'span 2' }}>
          <p className="section-tag">🧪 Pruebas</p>
          <div className="detail-checklist">
            {config.tests.map(({ key, label }) => (
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
    </>
  )
}
