import { createGenericModule } from './genericSchema'

// Catch-all for work that doesn't fit UPS/AC/Generador/Batería/ATS/Tablero --
// same generic form/factory as those, just without a fixed set of
// equipment readings (no natural "equipment" to take measurements on).
export default createGenericModule({
  id: 'trabajos_varios',
  name: 'Trabajos Varios',
  icon: '🧰',
  desc: 'Trabajos generales y misceláneos',
  fullLabel: 'Trabajos Varios',
  equipmentInfoFields: [
    { key: 'area', label: 'Área / Ubicación', placeholder: 'Ej: Bodega, Planta 2' },
    { key: 'description', label: 'Descripción del Trabajo', placeholder: 'Detalle del trabajo a realizar' },
  ],
  readingsGroups: [],
  activities: [
    { key: 'work_completed_as_requested', label: 'Trabajo solicitado realizado satisfactoriamente' },
    { key: 'work_area_clean', label: 'Área de trabajo limpia y ordenada al finalizar' },
    { key: 'client_informed', label: 'Cliente informado sobre el trabajo realizado' },
  ],
  tests: [],
})
