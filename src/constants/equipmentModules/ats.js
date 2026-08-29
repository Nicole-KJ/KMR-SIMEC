import { createGenericModule } from './genericSchema'

export default createGenericModule({
  id: 'ats',
  name: 'ATS',
  icon: '🔁',
  desc: 'Transferencia automática',
  fullLabel: 'ATS – Transferencia Automática',
  equipmentInfoFields: [
    { key: 'model', label: 'Modelo', placeholder: 'Modelo del equipo' },
    { key: 'rated_current', label: 'Corriente Nominal', placeholder: 'A', numeric: true },
    { key: 'rated_voltage', label: 'Voltaje Nominal', placeholder: 'V', numeric: true },
    { key: 'poles', label: 'N° de Polos', placeholder: 'Ej: 4', numeric: true },
    {
      key: 'transition_type', label: 'Tipo de Transición', type: 'select',
      options: [
        { value: 'abierta', label: 'Abierta' },
        { value: 'cerrada', label: 'Cerrada' },
      ],
    },
  ],
  readingsGroups: [
    {
      key: 'normal_source', title: 'Fuente Normal', icon: '🔌',
      fields: [
        { key: 'voltage_l1', label: 'Voltaje L1', placeholder: 'V' },
        { key: 'voltage_l2', label: 'Voltaje L2', placeholder: 'V' },
        { key: 'voltage_l3', label: 'Voltaje L3', placeholder: 'V' },
      ],
    },
    {
      key: 'emergency_source', title: 'Fuente de Emergencia', icon: '⚡',
      fields: [
        { key: 'voltage_l1', label: 'Voltaje L1', placeholder: 'V' },
        { key: 'voltage_l2', label: 'Voltaje L2', placeholder: 'V' },
        { key: 'voltage_l3', label: 'Voltaje L3', placeholder: 'V' },
      ],
    },
    {
      key: 'transfer_timing', title: 'Tiempos de Transferencia', icon: '⏱️',
      fields: [
        { key: 'transfer_time', label: 'Tiempo de Transferencia', placeholder: 'ms / s' },
      ],
    },
  ],
  activities: [
    { key: 'general_visual_inspection', label: 'Inspección visual general' },
    { key: 'internal_external_cleaning', label: 'Limpieza interna y externa' },
    { key: 'connections_torque_review', label: 'Revisión y ajuste de conexiones (torque)' },
    { key: 'pilot_lights_verification', label: 'Verificación de indicadores y luces piloto' },
    { key: 'control_panel_logic_review', label: 'Revisión del panel de control y lógica de transferencia' },
    { key: 'phase_sequence_voltage_check', label: 'Verificación de tensión y secuencia de fases en ambas fuentes' },
    { key: 'contacts_mechanism_review', label: 'Revisión de contactos y mecanismos de conmutación' },
    { key: 'alarms_remote_signaling_check', label: 'Verificación de alarmas y señalización remota' },
    { key: 'mechanical_lubrication', label: 'Lubricación de partes mecánicas' },
    { key: 'fuses_protections_review', label: 'Revisión de fusibles y protecciones' },
    { key: 'time_delays_verification', label: 'Verificación de tiempos de retardo (time delays)' },
    { key: 'power_terminals_inspection', label: 'Inspección de terminales de potencia' },
  ],
  tests: [
    { key: 'automatic_transfer', label: 'Transferencia Automática (Normal → Emergencia)' },
    { key: 'automatic_retransfer', label: 'Retransferencia (Emergencia → Normal)' },
    { key: 'manual_operation', label: 'Operación Manual' },
    { key: 'load_test', label: 'Prueba con Carga' },
  ],
})
