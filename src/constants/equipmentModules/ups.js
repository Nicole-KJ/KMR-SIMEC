import { toLabelMap } from './utils'

export const UPS_ACTIVITIES = [
  { key: 'verification_status', label: 'Verificación del estado, condiciones de operación y pruebas al UPS' },
  { key: 'functional_review_monitors', label: 'Revisión funcional de monitores y/o panel e indicadores' },
  { key: 'battery_frequency_register', label: 'Registro de banco en su frecuencia individual' },
  { key: 'alarm_circuits_review', label: 'Revisión de estado de todos los circuitos de alarma' },
  { key: 'mechanical_connections_review', label: 'Revisión de todas las conexiones mecánicas en busca de desajustes' },
  { key: 'internal_external_cleaning', label: 'Limpieza de partes internas y externas del componente referente al UPS' },
  { key: 'installation_verification', label: 'Verificación en instalaciones' },
  { key: 'battery_performance_test', label: 'Verificación de performance de los bancos y/o prueba de descarga de baterías' },
  { key: 'battery_circuit_review', label: 'Revisión de baterías conectadas a los diferentes cables de operación' },
  { key: 'voltage_frequency_current_measurement', label: 'Medición de voltaje, frecuencia y corriente del UPS, en micro y macro' },
  { key: 'ups_power_supply_register', label: 'Registro de alimentación al UPS y tablero de carga' },
  { key: 'equipment_calibration_info', label: 'Calibración de información de los equipos conectados a las UPS' },
]

export const UPS_TESTS = [
  { key: 'normalization', label: 'Modo Normal' },
  { key: 'battery_release', label: 'HE o ECO de Carga' },
  { key: 'bypass', label: 'Bypass' },
  { key: 'ups_with_load', label: 'UPS Trabajando con Carga' },
]

export function getDefaultUPSData() {
  return {
    maintenance_contracted: null, provider: '', contact: '',
    phase_type: 'single',
    ups_power: '', capacity: '', guarantee: '', installation: '',
    network_card: { has_card: null, communicates: null, downloads_history: null, protocol: '' },
    entry_condition: {
      l1: '', l2: '', l3: '', n: '', t: '',
      current_l1: '', current_l2: '', current_l3: '',
      current_neutral: '', current_ground: '',
      visual_state: '', observations: ''
    },
    environmental: { temperature: '', humidity: '', altitude: '' },
    batteries: { caliber: '', bat_quantity: '', bank_number: '', v_batt: '', observations: '' },
    output_condition: {
      l1: '', l2: '', l3: '', n: '', t: '',
      current_l1: '', current_l2: '', current_l3: '',
      current_neutral: '', current_ground: '',
      visual_state: '', observations: ''
    },
    activities_checklist: {
      verification_status: false, functional_review_monitors: false,
      battery_frequency_register: false, alarm_circuits_review: false,
      mechanical_connections_review: false, internal_external_cleaning: false,
      installation_verification: false, battery_performance_test: false,
      battery_circuit_review: false, voltage_frequency_current_measurement: false,
      ups_power_supply_register: false, equipment_calibration_info: false
    },
    tests: { normalization: false, battery_release: false, bypass: false, ups_with_load: false },
    pending_execution: null,
    execution_time: { arrival_time: '', departure_time: '' },
    cancellation: ''
  }
}

function conditionNumericFields(cond, sectionLabel) {
  if (!cond) return []
  return [
    { label: `Voltaje L1 (${sectionLabel})`, value: cond.l1 },
    { label: `Voltaje L2 (${sectionLabel})`, value: cond.l2 },
    { label: `Voltaje L3 (${sectionLabel})`, value: cond.l3 },
    { label: `Voltaje N (${sectionLabel})`, value: cond.n },
    { label: `Voltaje T (${sectionLabel})`, value: cond.t },
    { label: `Corriente L1 (${sectionLabel})`, value: cond.current_l1 },
    { label: `Corriente L2 (${sectionLabel})`, value: cond.current_l2 },
    { label: `Corriente L3 (${sectionLabel})`, value: cond.current_l3 },
    { label: `Corriente Neutro (${sectionLabel})`, value: cond.current_neutral },
    { label: `Corriente Tierra (${sectionLabel})`, value: cond.current_ground },
  ]
}

export function getNumericFields(data) {
  if (!data) return []
  return [
    ...conditionNumericFields(data.entry_condition, 'Entrada'),
    ...conditionNumericFields(data.output_condition, 'Salida'),
    { label: 'Temperatura', value: data.environmental?.temperature, allowNegative: true },
    { label: 'Humedad', value: data.environmental?.humidity },
    { label: 'Altitud', value: data.environmental?.altitude },
    { label: 'Voltaje de Batería', value: data.batteries?.v_batt },
    { label: 'Cantidad de Baterías', value: data.batteries?.bat_quantity },
  ]
}

export default {
  id: 'ups', name: 'UPS', icon: '🔋', desc: 'Alimentación ininterrumpida',
  fullLabel: 'UPS – Alimentación Ininterrumpida',
  kind: 'custom',
  activities: UPS_ACTIVITIES,
  tests: UPS_TESTS,
  activitiesLabels: toLabelMap(UPS_ACTIVITIES),
  testsLabels: toLabelMap(UPS_TESTS),
  getDefaultData: getDefaultUPSData,
}
