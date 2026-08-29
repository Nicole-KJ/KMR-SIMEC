import { createGenericModule } from './genericSchema'

export default createGenericModule({
  id: 'generador',
  name: 'Generador',
  icon: '⚡',
  desc: 'Plantas eléctricas de emergencia',
  fullLabel: 'Generador – Planta Eléctrica',
  equipmentInfoFields: [
    { key: 'power_rating', label: 'Potencia', placeholder: 'kW / kVA' },
    { key: 'voltage', label: 'Voltaje', placeholder: 'V', numeric: true },
    {
      key: 'phase_type', label: 'Tipo de Fase', type: 'select',
      options: [
        { value: 'monofasico', label: 'Monofásico' },
        { value: 'trifasico', label: 'Trifásico' },
      ],
    },
    { key: 'fuel_type', label: 'Tipo de Combustible', placeholder: 'Diésel, Gas, etc.' },
    { key: 'engine_model', label: 'Modelo del Motor', placeholder: 'Modelo' },
    { key: 'alternator_model', label: 'Modelo del Alternador', placeholder: 'Modelo' },
  ],
  readingsGroups: [
    {
      key: 'engine_readings', title: 'Lecturas del Motor', icon: '🛠️',
      fields: [
        { key: 'oil_pressure', label: 'Presión de Aceite', placeholder: 'PSI' },
        { key: 'coolant_temperature', label: 'Temp. Refrigerante', placeholder: '°C' },
        { key: 'rpm', label: 'RPM', placeholder: 'RPM' },
        { key: 'starting_battery_voltage', label: 'Voltaje Batería de Arranque', placeholder: 'V' },
      ],
    },
    {
      key: 'electrical_output', title: 'Salida Eléctrica', icon: '⚡',
      fields: [
        { key: 'voltage_l1', label: 'Voltaje L1', placeholder: 'V' },
        { key: 'voltage_l2', label: 'Voltaje L2', placeholder: 'V' },
        { key: 'voltage_l3', label: 'Voltaje L3', placeholder: 'V' },
        { key: 'current_l1', label: 'Corriente L1', placeholder: 'A' },
        { key: 'current_l2', label: 'Corriente L2', placeholder: 'A' },
        { key: 'current_l3', label: 'Corriente L3', placeholder: 'A' },
        { key: 'frequency', label: 'Frecuencia', placeholder: 'Hz' },
      ],
    },
  ],
  activities: [
    { key: 'engine_oil_check', label: 'Revisión y cambio de aceite de motor' },
    { key: 'oil_filter_check', label: 'Revisión y cambio de filtro de aceite' },
    { key: 'fuel_filter_check', label: 'Revisión y cambio de filtro de combustible' },
    { key: 'air_filter_check', label: 'Revisión y cambio de filtro de aire' },
    { key: 'cooling_system_check', label: 'Revisión del sistema de refrigeración' },
    { key: 'starting_battery_check', label: 'Revisión de la batería de arranque' },
    { key: 'exhaust_system_check', label: 'Revisión del sistema de escape' },
    { key: 'belts_check', label: 'Revisión de correas y tensores' },
    { key: 'general_cleaning', label: 'Limpieza general interna y externa del equipo' },
    { key: 'electrical_connections_check', label: 'Revisión de conexiones eléctricas y torque de terminales' },
    { key: 'control_panel_check', label: 'Revisión del panel de control y alarmas' },
    { key: 'fuel_quality_check', label: 'Revisión de niveles y calidad de combustible' },
  ],
  tests: [
    { key: 'manual_start', label: 'Arranque Manual' },
    { key: 'automatic_start', label: 'Arranque Automático' },
    { key: 'ats_transfer', label: 'Transferencia de Carga (ATS)' },
    { key: 'load_test', label: 'Prueba con Carga (mín. 30 min)' },
  ],
})
