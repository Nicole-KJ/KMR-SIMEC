// Shared between NewReport.jsx and NewEvento.jsx -- both let the user tag
// the work as Preventivo/Correctivo/Arranque via the same 3-button grid
// (.service-type-grid/.service-type-btn in index.css).
export const SERVICE_TYPES = [
  { id: 'preventivo', label: 'Preventivo', icon: '🔧', color: 'var(--clr-success)' },
  { id: 'correctivo', label: 'Correctivo', icon: '⚠️', color: 'var(--clr-danger)' },
  { id: 'arranque',   label: 'Arranque',   icon: '▶️', color: 'var(--clr-warning)' },
]

// A 4th Tipo de Servicio option, only offered (and defaulted to) on a
// Trabajos Varios report -- kept separate from SERVICE_TYPES rather than
// folded into it, since NewEvento.jsx's Tipo de Evento picker (which also
// imports SERVICE_TYPES) has no Trabajos Varios-equivalent case (050).
export const VARIOS_SERVICE_TYPE = { id: 'varios', label: 'Varios', icon: '🧰', color: 'var(--clr-text-light)' }
