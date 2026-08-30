import { toLabelMap } from './utils'
import ventanaIcon from '../../assets/equipmentIcons/ventana.png'
import minisplitIcon from '../../assets/equipmentIcons/minisplit.png'
import pisoTechoIcon from '../../assets/equipmentIcons/pisotecho.png'
import centralIcon from '../../assets/equipmentIcons/central.png'
import cassetteIcon from '../../assets/equipmentIcons/cassette.png'
import ctrlDesnudoIcon from '../../assets/equipmentIcons/ctrldesnudo.png'
import inrowIcon from '../../assets/equipmentIcons/inrow.png'
import mochilaIcon from '../../assets/equipmentIcons/mochila.png'
import cracIcon from '../../assets/equipmentIcons/crac.png'
import fancoilIcon from '../../assets/equipmentIcons/fancoil.png'

export const AC_SUBTYPES = [
  { id: 'ventana', label: 'Manejadora de ductos', icon: '🪟', image: ventanaIcon },
  { id: 'minisplit', label: 'MiniSplit', icon: '❄️', image: minisplitIcon },
  { id: 'piso_techo', label: 'Piso Cielo', icon: '⬆️', image: pisoTechoIcon },
  { id: 'central', label: 'Central', icon: '🏢', image: centralIcon },
  { id: 'cassette', label: 'Cassette', icon: '📦', image: cassetteIcon },
  { id: 'ctrl_desnudo', label: 'Sistema de Control', icon: '🔧', image: ctrlDesnudoIcon },
  { id: 'inrow', label: 'InRow', icon: '🗄️', image: inrowIcon },
  { id: 'mochila', label: 'Mochila (autocontenido)', icon: '🎒', image: mochilaIcon },
  { id: 'crac', label: 'CRAC', icon: '🏭', image: cracIcon },
  { id: 'fancoil', label: 'Fancoil', icon: '🌬️', image: fancoilIcon },
  { id: 'controladores', label: 'Controladores', icon: '' },
]

export const AC_WORK_ITEMS = [
  { key: 'panel_condensador_wash', label: 'Lavado de Panel Condensador' },
  { key: 'electric_control_cleaning', label: 'Limpieza de Control Eléctrico' },
  { key: 'transmission_inspection', label: 'Inspección de Transmisión' },
  { key: 'drain_tray_cleaning', label: 'Limpieza de Bandeja Drenaje' },
  { key: 'bearing_lubrication', label: 'Lubricación de Rodamientos' },
  { key: 'pump_inspection', label: 'Inspección de Bomba' },
  { key: 'grille_cleaning', label: 'Limpieza de Rejillas' },
  { key: 'air_filter_wash', label: 'Lavado de Filtros de Aire' },
  { key: 'refrigerant_charge_inspection', label: 'Inspección de Carga Refrigerante' },
  { key: 'evaporation_panel_wash', label: 'Lavado de Panel de Evaporación' },
]

export const AC_LEFT_EQUIPMENT = [
  { key: 'compressor_1', label: 'Compresor 1' },
  { key: 'compressor_2', label: 'Compresor 2' },
  { key: 'condenser_fan_1', label: 'Vent. Condensadora 1' },
  { key: 'condenser_fan_2', label: 'Vent. Condensadora 2' },
  { key: 'other_left_1', label: 'Otro' },
  { key: 'other_left_2', label: 'Otro' },
]

export const AC_RIGHT_EQUIPMENT = [
  { key: 'condenser_fan_3', label: 'Vent. Condensadora 3' },
  { key: 'condenser_fan_4', label: 'Vent. Condensadora 4' },
  { key: 'blower_1', label: 'Blower 1' },
  { key: 'blower_2', label: 'Blower 2' },
  { key: 'other_right_1', label: 'Otro' },
  { key: 'other_right_2', label: 'Otro' },
]

export function getDefaultACData() {
  return {
    maintenance_contracted: null, provider: '', contact: '',
    auxiliary_technician: '', equipment_subtype: '',
    work_performed: {
      panel_condensador_wash: false, electric_control_cleaning: false,
      transmission_inspection: false, drain_tray_cleaning: false,
      bearing_lubrication: false, pump_inspection: false,
      grille_cleaning: false, air_filter_wash: false,
      refrigerant_charge_inspection: false, evaporation_panel_wash: false,
      other: ''
    },
    operating_data: {
      compressor_1: { l1: '', l2: '', l3: '' },
      compressor_2: { l1: '', l2: '', l3: '' },
      condenser_fan_1: { l1: '', l2: '', l3: '' },
      condenser_fan_2: { l1: '', l2: '', l3: '' },
      other_left_1: { l1: '', l2: '', l3: '' },
      other_left_2: { l1: '', l2: '', l3: '' },
      condenser_fan_3: { l1: '', l2: '', l3: '' },
      condenser_fan_4: { l1: '', l2: '', l3: '' },
      blower_1: { l1: '', l2: '', l3: '' },
      blower_2: { l1: '', l2: '', l3: '' },
      other_right_1: { l1: '', l2: '', l3: '' },
      other_right_2: { l1: '', l2: '', l3: '' },
      high_pressure_1: '', high_pressure_2: '',
      low_pressure_1: '', low_pressure_2: ''
    },
    parts_used: null
  }
}

const subtypeLabels = Object.fromEntries(AC_SUBTYPES.map(s => [s.id, s.label]))
const equipLabels = Object.fromEntries([...AC_LEFT_EQUIPMENT, ...AC_RIGHT_EQUIPMENT].map(e => [e.key, e.label]))

export function getNumericFields(data) {
  if (!data) return []
  const equipFields = [...AC_LEFT_EQUIPMENT, ...AC_RIGHT_EQUIPMENT].flatMap(({ key, label }) => {
    const d = data.operating_data?.[key] || {}
    return [
      { label: `${label} L1`, value: d.l1 },
      { label: `${label} L2`, value: d.l2 },
      { label: `${label} L3`, value: d.l3 },
    ]
  })
  return [
    ...equipFields,
    { label: 'Presión Alta Etapa 1', value: data.operating_data?.high_pressure_1 },
    { label: 'Presión Alta Etapa 2', value: data.operating_data?.high_pressure_2 },
    { label: 'Presión Baja Etapa 1', value: data.operating_data?.low_pressure_1 },
    { label: 'Presión Baja Etapa 2', value: data.operating_data?.low_pressure_2 },
  ]
}

export default {
  id: 'ac', name: 'Aires de Precisión y Aires Confort', icon: '❄️', desc: 'Aires acondicionados',
  fullLabel: 'Aires de Precisión y Aires Confort',
  kind: 'custom',
  subtypes: AC_SUBTYPES,
  workItems: AC_WORK_ITEMS,
  leftEquipment: AC_LEFT_EQUIPMENT,
  rightEquipment: AC_RIGHT_EQUIPMENT,
  subtypeLabels,
  workLabels: toLabelMap(AC_WORK_ITEMS),
  equipLabels,
  getDefaultData: getDefaultACData,
}
