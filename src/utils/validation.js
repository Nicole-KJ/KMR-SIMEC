import { getNumericFields as getUPSNumericFields } from '../constants/equipmentModules/ups'
import { getNumericFields as getACNumericFields } from '../constants/equipmentModules/ac'
import { getGenericNumericFields } from '../constants/equipmentModules/genericSchema'

export function isBlank(v) {
  return v === null || v === undefined || String(v).trim() === ''
}

export function isValidNumber(v) {
  if (isBlank(v)) return true
  return Number.isFinite(Number(v))
}

export function isNonNegativeNumber(v) {
  if (isBlank(v)) return true
  const n = Number(v)
  return Number.isFinite(n) && n >= 0
}

// Local calendar date, not UTC — toISOString() rolls over to the next day
// for any user west of UTC once it's past their local midnight-plus-offset
// (e.g. evenings in Costa Rica, UTC-6), showing tomorrow's date as today's.
export function todayISODate() {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}


// Costa Rican cédula nacional (9 digits) or DIMEX (11-12 digits), dashes optional
export function isValidCedula(v) {
  if (isBlank(v)) return false
  const trimmed = v.trim()
  if (!/^[0-9-]+$/.test(trimmed)) return false
  const digitsOnly = trimmed.replace(/-/g, '')
  return digitsOnly.length >= 9 && digitsOnly.length <= 12
}

function collectNumericFields(moduleConfig, equipmentData) {
  if (!moduleConfig || !equipmentData) return []
  if (moduleConfig.id === 'ups') return getUPSNumericFields(equipmentData)
  if (moduleConfig.id === 'ac') return getACNumericFields(equipmentData)
  return getGenericNumericFields(moduleConfig, equipmentData)
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidEmail(v) {
  if (isBlank(v)) return true
  return EMAIL_RE.test(v.trim())
}

export function validateReport({
  clientName, clientAddress, clientEmail, clientEmailSecondary, serviceType, reportDate, technicians, brand, model, serial,
  workDescription, moduleConfig, equipmentData, equipmentType,
}) {
  const errors = []

  if (isBlank(clientName)) errors.push('El nombre del cliente es requerido.')
  if (isBlank(clientAddress)) errors.push('La dirección del cliente es requerida.')
  if (isBlank(clientEmail)) errors.push('El correo del cliente es requerido.')
  else if (!isValidEmail(clientEmail)) errors.push('El correo del cliente no es válido.')
  if (!isBlank(clientEmailSecondary) && !isValidEmail(clientEmailSecondary)) errors.push('El correo adicional no es válido.')
  if (isBlank(workDescription)) errors.push('La descripción del trabajo realizado es requerida.')
  if (isBlank(serviceType)) errors.push('Selecciona el tipo de servicio.')
  if (isBlank(reportDate)) errors.push('La fecha del reporte es requerida.')

  const hasTechnician = (technicians ?? []).some(t => !isBlank(t.technician_name))
  if (!hasTechnician) errors.push('Agrega al menos un técnico.')

  // Trabajos Varios has no single piece of equipment to describe -- its
  // form doesn't even show the Datos del Equipo card these belong to.
  if (equipmentType !== 'trabajos_varios') {
    if (isBlank(brand)) errors.push('La marca del equipo es requerida.')
    if (isBlank(model)) errors.push('El modelo del equipo es requerido.')
    if (isBlank(serial)) errors.push('El número de serie del equipo es requerido.')
  }

  for (const { label, value, allowNegative } of collectNumericFields(moduleConfig, equipmentData)) {
    const valid = allowNegative ? isValidNumber(value) : isNonNegativeNumber(value)
    if (!valid) {
      errors.push(`"${label}" debe ser un número válido${allowNegative ? '' : ' (no negativo)'}.`)
    }
  }

  return errors
}
