// Shared between Eventos.jsx, EventDetail.jsx and NewEvento.jsx -- an
// event's workflow: Pendiente (created, awaiting the visit) -> En
// Progreso -> Completado, or Cancelado at any point. Matches
// service_events.status's check constraint (040).
export const EVENT_STATUSES = [
  { id: 'pendiente', label: 'Pendiente' },
  { id: 'en_progreso', label: 'En Progreso' },
  { id: 'completado', label: 'Completado' },
  { id: 'cancelado', label: 'Cancelado' },
]

export const STATUS_LABELS = Object.fromEntries(EVENT_STATUSES.map(s => [s.id, s.label]))
