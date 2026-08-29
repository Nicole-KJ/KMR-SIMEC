import { Search, X } from 'lucide-react'
import { MODULES } from '../constants/equipmentModules'
import { STATUS_OPTIONS } from '../hooks/useReportFilters'

// Renders the filter bar driven by useReportFilters' return value --
// spread it straight in: <ReportFilters {...filters} isAdmin={isAdmin} />
export default function ReportFilters({
  isAdmin,
  searchQuery, setSearchQuery,
  technicianFilter, setTechnicianFilter,
  statusFilter, setStatusFilter,
  equipmentFilter, setEquipmentFilter,
  dateFrom, setDateFrom,
  dateTo, setDateTo,
  technicianOptions, hasActiveFilters, clearFilters,
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 20 }}>
      <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 180 }}>
        <Search size={14} color="var(--clr-text-light)" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
        <input className="form-control" style={{ paddingLeft: 32 }} placeholder="Buscar en reportes..."
          value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
      </div>
      {isAdmin && (
        <select className="form-control form-control-select" style={{ maxWidth: 180 }}
          value={technicianFilter} onChange={e => setTechnicianFilter(e.target.value)}>
          <option value="">Todos los técnicos</option>
          {technicianOptions.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      )}
      <select className="form-control form-control-select" style={{ maxWidth: 160 }}
        value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
        <option value="">Todos los estados</option>
        {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
      <select className="form-control form-control-select" style={{ maxWidth: 180 }}
        value={equipmentFilter} onChange={e => setEquipmentFilter(e.target.value)}>
        <option value="">Todos los equipos</option>
        {MODULES.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
      </select>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input className="form-control" type="date" style={{ maxWidth: 150 }} title="Desde"
          value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        <span style={{ color: 'var(--clr-text-light)', fontSize: 13 }}>a</span>
        <input className="form-control" type="date" style={{ maxWidth: 150 }} title="Hasta"
          value={dateTo} onChange={e => setDateTo(e.target.value)} />
      </div>
      {hasActiveFilters && (
        <button className="btn btn-secondary btn-sm" onClick={clearFilters}>
          <X size={14} /> Limpiar
        </button>
      )}
    </div>
  )
}
