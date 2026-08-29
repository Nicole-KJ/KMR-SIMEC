import { createGenericModule } from './genericSchema'

export default createGenericModule({
  id: 'tablero',
  name: 'Tablero Eléctrico',
  icon: '🎛️',
  desc: 'Tableros de distribución',
  fullLabel: 'Tablero Eléctrico',
  equipmentInfoFields: [
    {
      key: 'panel_type', label: 'Tipo de Tablero', type: 'select',
      options: [
        { value: 'principal', label: 'Principal' },
        { value: 'distribucion', label: 'Distribución' },
      ],
    },
    { key: 'voltage', label: 'Voltaje', placeholder: 'V', numeric: true },
    { key: 'amperage_rating', label: 'Capacidad Nominal', placeholder: 'A', numeric: true },
    { key: 'circuit_count', label: 'N° de Circuitos', placeholder: 'Cantidad', numeric: true },
  ],
  readingsGroups: [
    {
      key: 'voltage_readings', title: 'Lecturas de Voltaje', icon: '⚡',
      fields: [
        { key: 'l1', label: 'L1', placeholder: 'V' },
        { key: 'l2', label: 'L2', placeholder: 'V' },
        { key: 'l3', label: 'L3', placeholder: 'V' },
        { key: 'n', label: 'N', placeholder: 'V' },
      ],
    },
    {
      key: 'current_readings', title: 'Lecturas de Corriente', icon: '🔌',
      fields: [
        { key: 'l1', label: 'L1', placeholder: 'A' },
        { key: 'l2', label: 'L2', placeholder: 'A' },
        { key: 'l3', label: 'L3', placeholder: 'A' },
      ],
    },
    {
      key: 'thermography', title: 'Termografía', icon: '🌡️',
      fields: [
        { key: 'thermography_notes', label: 'Notas de Termografía', placeholder: 'Puntos calientes detectados...', numeric: false },
      ],
    },
  ],
  activities: [
    { key: 'general_visual_inspection', label: 'Inspección visual general (corrosión, sobrecalentamiento)' },
    { key: 'internal_external_cleaning', label: 'Limpieza interna y externa' },
    { key: 'connections_torque_review', label: 'Revisión y ajuste de torque en conexiones y terminales' },
    { key: 'breakers_verification', label: 'Verificación de breakers (operación y estado)' },
    { key: 'thermography_inspection', label: 'Termografía de conexiones y componentes' },
    { key: 'labeling_verification', label: 'Verificación de etiquetado y señalización de circuitos' },
    { key: 'bus_bars_review', label: 'Revisión de barras y buses (busbars)' },
    { key: 'grounding_system_check', label: 'Verificación de sistema de puesta a tierra' },
    { key: 'phase_load_balance_review', label: 'Revisión de balanceo de cargas entre fases' },
    { key: 'protections_inspection', label: 'Inspección de protecciones (fusibles, relés)' },
    { key: 'cabinet_seal_verification', label: 'Verificación de cierre hermético del gabinete' },
    { key: 'clearance_accessibility_review', label: 'Revisión de espacio libre y accesibilidad' },
  ],
  tests: [
    { key: 'breaker_trip_test', label: 'Prueba de Disparo de Breakers (Trip Test)' },
    { key: 'phase_sequence_verification', label: 'Verificación de Secuencia de Fases' },
    { key: 'grounding_resistance_measurement', label: 'Medición de Resistencia de Puesta a Tierra' },
  ],
})
