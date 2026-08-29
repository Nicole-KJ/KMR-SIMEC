/**
 * equipmentInventoryFields.js – Inventario de Equipos (052)'s per-type
 * identity fields, shared between NewEquipo.jsx (form) and EquipoDetail.jsx
 * (read-only display) so the two never drift apart on labels/options.
 */
import { MODULES, EQUIPMENT_MODULES } from './equipmentModules'
import { AC_SUBTYPES } from './equipmentModules/ac'

// Same 6 physical equipment types the report wizard offers, minus
// "Trabajos Varios" -- that one is a catch-all for miscellaneous work, not
// a piece of equipment that belongs in an asset registry.
export const INVENTORY_MODULES = MODULES.filter(m => m.id !== 'trabajos_varios')

// The identity fields captured for each equipment type -- same variables
// as the report form's "Datos del Equipo" step (constants/equipmentModules),
// minus anything that's really a per-visit reading/checklist item and minus
// ubicación (equipment can move between sites, so it isn't part of its
// identity here). Generador/Batería/ATS/Tablero already isolate exactly
// this set as `equipmentInfoFields`; UPS/AC mix identity into a bigger
// bespoke shape, so their inventory-relevant fields are picked out by hand
// below instead.
export const CUSTOM_INVENTORY_FIELDS = {
  ups: [
    {
      key: 'phase_type', label: 'Tipo de Fase', type: 'select',
      options: [{ value: 'single', label: 'Monofásico' }, { value: 'three', label: 'Trifásico' }],
    },
    { key: 'ups_power', label: 'Potencia UPS', placeholder: 'kVA' },
    { key: 'capacity', label: 'Capacidad', placeholder: 'kW / kVA' },
  ],
  ac: [
    {
      key: 'equipment_subtype', label: 'Subtipo', type: 'select',
      options: AC_SUBTYPES.map(s => ({ value: s.id, label: s.label })),
    },
  ],
}

// ats.equipmentInfoFields includes its own `model` -- dropped here since
// the universal "Modelo" field already covers it; entering the same thing
// twice would just invite the two copies to disagree.
export function getInventoryFields(type) {
  if (!type) return []
  if (CUSTOM_INVENTORY_FIELDS[type]) return CUSTOM_INVENTORY_FIELDS[type]
  return (EQUIPMENT_MODULES[type]?.equipmentInfoFields ?? []).filter(f => f.key !== 'model')
}

// Resolves a stored value to its display label for select-type fields
// (e.g. 'single' -> 'Monofásico'); passes anything else through as-is.
// Used by EquipoDetail.jsx's read-only "Datos específicos" -- NewEquipo.jsx's
// <select> already shows the label natively, so it has no need for this.
export function formatInventoryFieldValue(field, value) {
  if (!value) return null
  if (field.type === 'select') return field.options.find(o => o.value === value)?.label ?? value
  return value
}
