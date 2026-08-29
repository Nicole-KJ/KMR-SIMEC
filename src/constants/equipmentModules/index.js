import ups from './ups'
import ac from './ac'
import generador from './generador'
import bateria from './bateria'
import ats from './ats'
import tablero from './tablero'
import trabajosVarios from './trabajosVarios'

export const EQUIPMENT_MODULES = { ups, ac, generador, bateria, ats, tablero, trabajos_varios: trabajosVarios }

export const MODULES = Object.values(EQUIPMENT_MODULES).map(({ id, name, icon, desc }) => ({ id, name, icon, desc }))

export function getDefaultEquipmentData(moduleId) {
  return EQUIPMENT_MODULES[moduleId]?.getDefaultData() ?? {}
}

export { extractPendingFile } from './genericSchema'
