import { X } from 'lucide-react'

export default function GenericModuleForm({ config, data, onUpdate, onUpdateNested, onToggleChecklist }) {
  return (
    <>
      {/* Contrato y Contacto */}
      <div className="card" style={{ marginBottom:20 }}>
        <p className="section-tag">📋 Contrato y Contacto</p>
        <div className="contract-toggle-row">
          <span className="toggle-text">¿Mantenimiento contratado?</span>
          <label className="toggle-switch">
            <input type="checkbox" checked={data.maintenance_contracted === true}
              onChange={e => onUpdate('maintenance_contracted', e.target.checked)} />
            <span className="toggle-slider"></span>
          </label>
          <span className="toggle-label">{data.maintenance_contracted ? 'SÍ' : 'NO'}</span>
        </div>
        <div className="form-row form-row-2">
          <div className="form-group">
            <label className="form-label">Proveedor</label>
            <input className="form-control" value={data.provider}
              onChange={e => onUpdate('provider', e.target.value)} placeholder="Nombre del proveedor" />
          </div>
          <div className="form-group">
            <label className="form-label">Contacto</label>
            <input className="form-control" value={data.contact}
              onChange={e => onUpdate('contact', e.target.value)} placeholder="Teléfono o correo" />
          </div>
        </div>
      </div>

      {/* Datos del Equipo */}
      <div className="card" style={{ marginBottom:20 }}>
        <p className="section-tag">🔧 Datos del Equipo</p>
        <div className="form-row form-row-3">
          {config.equipmentInfoFields.map(field => (
            <div className="form-group" key={field.key}>
              <label className="form-label">{field.label}</label>
              {field.type === 'select' ? (
                <select className="form-control form-control-select"
                  value={data.equipment_info?.[field.key] ?? ''}
                  onChange={e => onUpdateNested('equipment_info', field.key, e.target.value)}>
                  <option value="">Seleccionar...</option>
                  {field.options.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              ) : (
                <input className="form-control" value={data.equipment_info?.[field.key] ?? ''}
                  onChange={e => onUpdateNested('equipment_info', field.key, e.target.value)}
                  placeholder={field.placeholder}
                  type={field.numeric ? 'number' : 'text'}
                  inputMode={field.numeric ? 'decimal' : undefined}
                  min={field.numeric ? 0 : undefined}
                  step={field.numeric ? 'any' : undefined} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Condiciones Ambientales */}
      <div className="card" style={{ marginBottom:20 }}>
        <p className="section-tag">🌡️ Condiciones Ambientales</p>
        <div className="form-row form-row-3">
          <div className="form-group">
            <label className="form-label">Temperatura (°C)</label>
            <input className="form-control" value={data.environmental?.temperature ?? ''}
              onChange={e => onUpdateNested('environmental', 'temperature', e.target.value)}
              placeholder="°C" type="number" inputMode="decimal" step="any" />
          </div>
          <div className="form-group">
            <label className="form-label">Humedad (%)</label>
            <input className="form-control" value={data.environmental?.humidity ?? ''}
              onChange={e => onUpdateNested('environmental', 'humidity', e.target.value)}
              placeholder="%" type="number" inputMode="decimal" min="0" step="any" />
          </div>
        </div>
      </div>

      {/* Grupos de Lecturas */}
      {config.readingsGroups.map(group => {
        const attachedFile = group.fileUpload ? data[group.key]?.attached_file : null
        // Free-text fields (e.g. Batería's notes) get their own full-width
        // row below the aligned grid instead of squeezing into a column —
        // both because they need more room and to keep the grid itself to
        // short, similarly-sized fields that are safe to column-align.
        const gridFields = group.fields.filter(f => !f.wide)
        const wideFields = group.fields.filter(f => f.wide)
        return (
          <div className="card" style={{ marginBottom:20 }} key={group.key}>
            <p className="section-tag">{group.icon} {group.title}</p>
            <div className="measurement-grid">
              {gridFields.map(field => (
                <div className="measurement-field" key={field.key}>
                  <label>{field.label}</label>
                  <input value={data[group.key]?.[field.key] ?? ''}
                    onChange={e => onUpdateNested(group.key, field.key, e.target.value)}
                    placeholder={field.placeholder}
                    type={field.numeric === false ? 'text' : 'number'}
                    inputMode={field.numeric === false ? undefined : 'decimal'}
                    min={field.numeric === false ? undefined : 0}
                    step={field.numeric === false ? undefined : 'any'} />
                </div>
              ))}
            </div>
            {wideFields.map(field => (
              <div className="form-group" style={{ marginTop:12 }} key={field.key}>
                <label className="form-label">{field.label}</label>
                <input className="form-control" value={data[group.key]?.[field.key] ?? ''}
                  onChange={e => onUpdateNested(group.key, field.key, e.target.value)}
                  placeholder={field.placeholder} type="text" />
              </div>
            ))}
            {group.fileUpload && (
              <div className="form-group" style={{ marginTop:12 }}>
                <label className="form-label">Archivo adjunto</label>
                <div className="form-control" style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
                  <label className="btn btn-secondary btn-sm" style={{ cursor:'pointer', margin:0 }}>
                    Elegir archivo
                    <input type="file" style={{ display:'none' }} key={attachedFile ? 'has-file' : 'no-file'}
                      onChange={e => {
                        const file = e.target.files[0]
                        if (file) onUpdateNested(group.key, 'attached_file', { file, name: file.name, type: file.type })
                      }} />
                  </label>
                  {attachedFile ? (
                    <>
                      <span style={{ fontSize:13 }}>📎 {attachedFile.name}</span>
                      <span className="badge badge-draft">{attachedFile.type || 'archivo'}</span>
                      <button type="button" className="btn btn-secondary btn-sm"
                        onClick={() => onUpdateNested(group.key, 'attached_file', null)}>
                        <X size={13} /> Quitar
                      </button>
                    </>
                  ) : (
                    <span style={{ fontSize:13, color:'var(--clr-text-light)' }}>Ningún archivo seleccionado</span>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* Actividades a Realizar */}
      <div className="card" style={{ marginBottom:20 }}>
        <p className="section-tag">📋 Actividades a Realizar</p>
        <div className="checklist-grid">
          {config.activities.map((act, i) => (
            <div key={act.key} className="checklist-item">
              <span className="checklist-number">{i+1}</span>
              <span className="checklist-label">{act.label}</span>
              <label className="toggle-switch">
                <input type="checkbox" checked={data.activities_checklist?.[act.key] ?? false}
                  onChange={() => onToggleChecklist('activities_checklist', act.key)} />
                <span className="toggle-slider"></span>
              </label>
              <span className="toggle-label">
                {data.activities_checklist?.[act.key] ? 'SÍ' : 'NO'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Pruebas */}
      <div className="card" style={{ marginBottom:20 }}>
        <p className="section-tag">🧪 Pruebas</p>
        <div className="tests-grid">
          {config.tests.map(test => (
            <div key={test.key} className={`test-item ${data.tests?.[test.key] ? 'checked' : ''}`}
              onClick={() => onToggleChecklist('tests', test.key)}>
              <input type="checkbox" checked={data.tests?.[test.key] ?? false} readOnly />
              <label>{test.label}</label>
            </div>
          ))}
        </div>
        <hr className="section-divider" />
        <div className="contract-toggle-row">
          <span className="toggle-text">¿Pendiente de ejecución?</span>
          <label className="toggle-switch">
            <input type="checkbox" checked={data.pending_execution === true}
              onChange={e => onUpdate('pending_execution', e.target.checked)} />
            <span className="toggle-slider"></span>
          </label>
          <span className="toggle-label">{data.pending_execution ? 'SÍ' : 'NO'}</span>
        </div>
      </div>

      {/* Tiempo de Ejecución */}
      <div className="card" style={{ marginBottom:20 }}>
        <p className="section-tag">⏱️ Tiempo de Ejecución</p>
        <div className="form-row form-row-2">
          <div className="form-group">
            <label className="form-label">Hora de Llegada</label>
            <input className="form-control" type="time" value={data.execution_time?.arrival_time ?? ''}
              onChange={e => onUpdateNested('execution_time', 'arrival_time', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Hora de Salida</label>
            <input className="form-control" type="time" value={data.execution_time?.departure_time ?? ''}
              onChange={e => onUpdateNested('execution_time', 'departure_time', e.target.value)} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Observaciones / Cancelación</label>
          <textarea className="form-control" rows={2} value={data.cancellation ?? ''}
            onChange={e => onUpdate('cancellation', e.target.value)}
            placeholder="Observaciones sobre la ejecución o cancelación..." />
        </div>
      </div>
    </>
  )
}
