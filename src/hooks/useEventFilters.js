import { useMemo, useState } from 'react'
import { STATUS_LABELS } from '../constants/eventStatus'
import { formatDate } from '../services/supabaseDB'

export const SERVICE_TYPE_OPTIONS = [
  { value: 'preventivo', label: 'Preventivo' },
  { value: 'correctivo', label: 'Correctivo' },
  { value: 'arranque', label: 'Arranque' },
]

// Accent-insensitive so "jose" matches "José" -- a search box shouldn't
// require typing accents. Plain toLowerCase() alone won't fold é -> e.
// Same convention as useReportFilters/useUserFilters' foldAccents.
const COMBINING_MARKS = new RegExp('[\\u0300-\\u036f]', 'g')
const foldAccents = s => (s || '').normalize('NFD').replace(COMBINING_MARKS, '').toLowerCase()

// Mirrors what EventsTable renders per row (Fecha, Cliente, Evento,
// Técnico(s), Equipo, Tipo, Estado) so a search term matches only what's
// actually visible in that row.
function eventSearchText(ev) {
  return [
    formatDate(ev.event_date),
    ev.client_name,
    ev.event_name,
    ev.event_code,
    (ev.technicians ?? []).map(t => t.technician_name).join(' '),
    ev.equipment_type,
    ev.service_type,
    STATUS_LABELS[ev.status] || ev.status,
  ].filter(Boolean).map(foldAccents).join(' ')
}

// Search/técnico/estado/tipo/equipo/rango-de-fechas filter set over the
// full events list (Eventos.jsx's table below the calendar) -- same
// shape as useReportFilters so both list views behave consistently.
export function useEventFilters(events) {
  const [searchQuery, setSearchQuery] = useState('')
  const [technicianFilter, setTechnicianFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [serviceTypeFilter, setServiceTypeFilter] = useState('')
  const [equipmentFilter, setEquipmentFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Grouped by technician_id (a stable identity) rather than name, same
  // reasoning as useReportFilters' technicianOptions -- a técnico's name
  // snapshot on old events can differ from their current profile name.
  const technicianOptions = useMemo(() => {
    const seen = new Map()
    for (const ev of events) {
      for (const t of ev.technicians ?? []) {
        if (t.technician_id && !seen.has(t.technician_id)) seen.set(t.technician_id, t.technician_name)
      }
    }
    return [...seen.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  }, [events])

  const hasActiveFilters = !!(searchQuery || technicianFilter || statusFilter || serviceTypeFilter || equipmentFilter || dateFrom || dateTo)

  function clearFilters() {
    setSearchQuery(''); setTechnicianFilter(''); setStatusFilter('')
    setServiceTypeFilter(''); setEquipmentFilter(''); setDateFrom(''); setDateTo('')
  }

  const filteredEvents = events.filter(ev => {
    if (searchQuery && !eventSearchText(ev).includes(foldAccents(searchQuery))) return false
    if (technicianFilter && !(ev.technicians ?? []).some(t => t.technician_id === technicianFilter)) return false
    if (statusFilter && ev.status !== statusFilter) return false
    if (serviceTypeFilter && ev.service_type !== serviceTypeFilter) return false
    if (equipmentFilter && ev.equipment_type !== equipmentFilter) return false
    if (dateFrom && (!ev.event_date || ev.event_date < dateFrom)) return false
    if (dateTo && (!ev.event_date || ev.event_date > dateTo)) return false
    return true
  })

  return {
    searchQuery, setSearchQuery,
    technicianFilter, setTechnicianFilter,
    statusFilter, setStatusFilter,
    serviceTypeFilter, setServiceTypeFilter,
    equipmentFilter, setEquipmentFilter,
    dateFrom, setDateFrom,
    dateTo, setDateTo,
    technicianOptions, hasActiveFilters, clearFilters, filteredEvents,
  }
}
