import { toLabelMap } from './utils'

// Shared shape for the "uniform" equipment modules (Generador, Batería, ATS, Tablero):
// contrato/contacto -> datos del equipo -> ambiental -> N grupos de lecturas -> checklist -> pruebas -> tiempo de ejecución.
// UPS/AC have bespoke layouts and don't use this factory.
export function createGenericModule({
  id, name, icon, desc, fullLabel,
  equipmentInfoFields,
  readingsGroups,
  activities,
  tests,
}) {
  function getDefaultData() {
    const equipment_info = Object.fromEntries(equipmentInfoFields.map(f => [f.key, '']))
    const readingsData = Object.fromEntries(
      readingsGroups.map(g => [g.key, {
        ...Object.fromEntries(g.fields.map(f => [f.key, ''])),
        ...(g.fileUpload ? { attached_file: null } : {}),
      }])
    )
    return {
      maintenance_contracted: null, provider: '', contact: '',
      equipment_info,
      environmental: { temperature: '', humidity: '' },
      ...readingsData,
      activities_checklist: Object.fromEntries(activities.map(a => [a.key, false])),
      tests: Object.fromEntries(tests.map(t => [t.key, false])),
      pending_execution: null,
      execution_time: { arrival_time: '', departure_time: '' },
      cancellation: '',
    }
  }

  return {
    id, name, icon, desc,
    fullLabel: fullLabel ?? name,
    kind: 'generic',
    equipmentInfoFields, readingsGroups, activities, tests,
    activitiesLabels: toLabelMap(activities),
    testsLabels: toLabelMap(tests),
    getDefaultData,
  }
}

// equipmentInfoFields are numeric only when explicitly tagged `numeric: true`;
// readingsGroups fields are numeric by default (opt out with `numeric: false`,
// e.g. free-text notes fields), since that's what most of them are.
export function getGenericNumericFields(config, data) {
  if (!config || !data) return []
  const equipInfo = config.equipmentInfoFields
    .filter(f => f.numeric)
    .map(f => ({ label: f.label, value: data.equipment_info?.[f.key] }))

  const readings = config.readingsGroups.flatMap(group =>
    group.fields
      .filter(f => f.numeric !== false)
      .map(f => ({ label: `${f.label} (${group.title})`, value: data[group.key]?.[f.key] }))
  )

  return [
    ...equipInfo,
    { label: 'Temperatura', value: data.environmental?.temperature, allowNegative: true },
    { label: 'Humedad', value: data.environmental?.humidity },
    ...readings,
  ]
}

// Pulls a not-yet-uploaded File out of whichever readingsGroup opted into
// fileUpload (see bateria.js's "measurements" group), returning the group's
// key, the File, and a copy of data with that group's attached_file cleared.
// Used right before the first Storage write, since the report id needed for
// the file's `${reportId}/...` path doesn't exist until the report itself
// has been created (or, in edit mode, is already known but this keeps a
// single code path for both).
export function extractPendingFile(config, data) {
  // UPS/AC (kind: 'custom') have no readingsGroups at all -- only the
  // "generic" modules (Generador, Batería, ATS, Tablero) do. Called
  // unconditionally on every save regardless of module, so this has to be
  // a no-op for them rather than assuming the property exists.
  if (!config?.readingsGroups || !data) return null
  for (const g of config.readingsGroups.filter(g => g.fileUpload)) {
    const pending = data[g.key]?.attached_file
    if (pending?.file) {
      return {
        groupKey: g.key,
        file: pending.file,
        dataWithoutFile: { ...data, [g.key]: { ...data[g.key], attached_file: null } },
      }
    }
  }
  return null
}
