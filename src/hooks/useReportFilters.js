import { useMemo, useState } from 'react'
import { STATUS_LABEL } from '../constants/reportStatus'
import { formatDate } from '../services/supabaseDB'

export const STATUS_OPTIONS = [
  { value: 'draft', label: 'Borrador' },
  { value: 'completed', label: 'Completado' },
  { value: 'signed', label: 'Firmado' },
]

// Accent-insensitive so "medico" matches "Médico" -- a search box shouldn't
// require typing accents. Plain toLowerCase() alone won't fold é -> e.
const COMBINING_MARKS = new RegExp('[\\u0300-\\u036f]', 'g')
const foldAccents = s => (s || '').normalize('NFD').replace(COMBINING_MARKS, '').toLowerCase()

// Mirrors exactly what ReportsTable renders per row (N° Reporte, Cliente,
// Proyecto, Técnico when shown, Equipo, Tipo, Estado, Fecha) so a search
// term matches only what the user can actually see in that row.
function reportSearchText(r, isAdmin) {
  return [
    `#${String(r.report_number).padStart(4, '0')}`,
    r.client_name,
    r.project_name,
    isAdmin ? r.technician_name : null,
    r.equipment_type,
    r.service_type,
    STATUS_LABEL[r.status] || r.status,
    formatDate(r.created_at),
  ].filter(Boolean).map(foldAccents).join(' ')
}

// Shared by ReportsList and LiberarEspacio -- same search/técnico/estado/
// equipo/rango-de-fechas filter set over a `reports` array, so both pages
// behave identically instead of drifting apart.
export function useReportFilters(reports, isAdmin) {
  const [searchQuery, setSearchQuery] = useState('')
  const [technicianFilter, setTechnicianFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [equipmentFilter, setEquipmentFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Grouped by technician_id (a stable identity) rather than technician_name,
  // since the same person's reports can carry different name snapshots if
  // their profile name was set/changed after some reports were already
  // created — filtering by name text alone would otherwise miss reports.
  const technicianOptions = useMemo(() => {
    const seen = new Map()
    for (const r of reports) {
      if (r.technician_id && !seen.has(r.technician_id)) seen.set(r.technician_id, r.technician_name)
    }
    return [...seen.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  }, [reports])

  const hasActiveFilters = !!(searchQuery || technicianFilter || statusFilter || equipmentFilter || dateFrom || dateTo)

  function clearFilters() {
    setSearchQuery(''); setTechnicianFilter(''); setStatusFilter(''); setEquipmentFilter('')
    setDateFrom(''); setDateTo('')
  }

  const filteredReports = reports.filter(r => {
    if (searchQuery && !reportSearchText(r, isAdmin).includes(foldAccents(searchQuery))) return false
    if (technicianFilter && r.technician_id !== technicianFilter) return false
    if (statusFilter && r.status !== statusFilter) return false
    if (equipmentFilter && r.equipment_type !== equipmentFilter) return false
    if (dateFrom && (!r.report_date || r.report_date < dateFrom)) return false
    if (dateTo && (!r.report_date || r.report_date > dateTo)) return false
    return true
  })

  return {
    searchQuery, setSearchQuery,
    technicianFilter, setTechnicianFilter,
    statusFilter, setStatusFilter,
    equipmentFilter, setEquipmentFilter,
    dateFrom, setDateFrom,
    dateTo, setDateTo,
    technicianOptions, hasActiveFilters, clearFilters, filteredReports,
  }
}
