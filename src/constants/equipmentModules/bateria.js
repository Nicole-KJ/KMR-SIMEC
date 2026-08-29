import { createGenericModule } from './genericSchema'

export default createGenericModule({
  id: 'bateria',
  name: 'Batería',
  icon: '🪫',
  desc: 'Bancos de baterías',
  fullLabel: 'Batería – Banco de Baterías',
  equipmentInfoFields: [
    {
      key: 'battery_type', label: 'Tipo de Batería', type: 'select',
      options: [
        { value: 'vrla', label: 'VRLA' },
        { value: 'plomo_acido', label: 'Plomo-Ácido' },
        { value: 'litio', label: 'Litio' },
      ],
    },
    { key: 'quantity', label: 'Cantidad', placeholder: 'N° de baterías', numeric: true },
    { key: 'bank_configuration', label: 'Configuración del Banco', placeholder: 'Ej: 2 bancos x 20 celdas' },
    { key: 'nominal_capacity', label: 'Capacidad Nominal', placeholder: 'Ah', numeric: true },
    { key: 'nominal_voltage', label: 'Voltaje Nominal', placeholder: 'V', numeric: true },
  ],
  readingsGroups: [
    {
      key: 'measurements', title: 'Mediciones', icon: '📏', fileUpload: true,
      fields: [
        { key: 'total_bank_voltage', label: 'Voltaje Total del Banco', placeholder: 'V' },
        { key: 'internal_resistance', label: 'Resistencia Interna', placeholder: 'mΩ' },
        { key: 'individual_voltages_notes', label: 'Voltajes Individuales (notas)', placeholder: 'Ej: Batería 3: 12.1V, Batería 7: 11.8V...', numeric: false, wide: true },
      ],
    },
  ],
  activities: [
    { key: 'visual_inspection', label: 'Inspección visual (fugas, hinchazón, corrosión)' },
    { key: 'terminal_cleaning', label: 'Limpieza de terminales y conexiones' },
    { key: 'torque_verification', label: 'Verificación de torque de conexiones' },
    { key: 'individual_voltage_measurement', label: 'Medición de voltaje individual por batería' },
    { key: 'impedance_measurement', label: 'Medición de impedancia/resistencia interna' },
    { key: 'total_bank_voltage_check', label: 'Verificación de voltaje total del banco' },
    { key: 'manufacture_date_review', label: 'Revisión de fecha de fabricación / vida útil restante' },
    { key: 'room_ventilation_check', label: 'Verificación de ventilación del cuarto de baterías' },
    { key: 'charger_rectifier_review', label: 'Revisión del sistema de carga / rectificador' },
    { key: 'ambient_temperature_check', label: 'Verificación de temperatura ambiente' },
    { key: 'serial_numbers_record', label: 'Registro de números de serie / etiquetado' },
    { key: 'intercell_connections_check', label: 'Verificación de conexiones intercelda' },
  ],
  tests: [
    { key: 'discharge_load_test', label: 'Prueba de Descarga (Load Test)' },
    { key: 'autonomy_backup_test', label: 'Prueba de Autonomía / Respaldo' },
    { key: 'float_charge_verification', label: 'Verificación de Carga Flotante' },
  ],
})
