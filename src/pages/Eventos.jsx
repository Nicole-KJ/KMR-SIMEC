import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, ChevronLeft, ChevronRight, Loader, Plus, X } from 'lucide-react'
import { getEvents } from '../services/supabaseDB'
import { todayISODate } from '../utils/validation'
import { logError } from '../utils/logger'
import { useEventFilters } from '../hooks/useEventFilters'
import { usePagination } from '../hooks/usePagination'
import EventFilters from '../components/EventFilters'
import EventsTable, { EventsTableSkeleton } from '../components/EventsTable'
import Pagination from '../components/Pagination'

const MONTH_LABELS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]
const MONTH_LABELS_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const WEEKDAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

const VIEW_MODES = [
  { id: 'week', label: 'Semana' },
  { id: 'month', label: 'Mes' },
  { id: 'year', label: 'Año' },
]

const HOURS = Array.from({ length: 24 }, (_, h) => h)
const PLANNER_ROW_HEIGHT = 48 // px, matches .planner-cell min-height in index.css
const PLANNER_DEFAULT_SCROLL_HOUR = 7 // scroll week view to ~7am on open, not midnight

// 24h format, same as everywhere else event times are shown (e.g. the
// month view's chips) -- no AM/PM to stay consistent.
function formatHourLabel(h) {
  return `${String(h).padStart(2, '0')}:00`
}

// Postgres `time` comes back as "HH:MM:SS" -- which hour row an event
// belongs to. Events with no time at all go in the "Todo el día" row
// instead (handled separately, not by this).
function eventHour(ev) {
  return ev.event_time ? parseInt(ev.event_time.slice(0, 2), 10) : null
}

// Same local-calendar-day approach as todayISODate() (utils/validation.js) --
// never round-trips through toISOString()/new Date(str), which assumes UTC
// and rolls a date-only value back a day for anyone west of UTC.
function toLocalISODate(d) {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function monthGrid(monthDate) {
  const year = monthDate.getFullYear()
  const month = monthDate.getMonth()
  const startWeekday = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells = []
  for (let i = startWeekday - 1; i >= 0; i--) cells.push({ date: new Date(year, month, -i), otherMonth: true })
  for (let d = 1; d <= daysInMonth; d++) cells.push({ date: new Date(year, month, d), otherMonth: false })
  while (cells.length % 7 !== 0) {
    const next = new Date(cells[cells.length - 1].date)
    next.setDate(next.getDate() + 1)
    cells.push({ date: next, otherMonth: true })
  }
  return cells
}

// The 7 days (Sun-Sat) of the week containing anchorDate -- no "other
// month" concept here, every day in a week view is equally current.
function weekGrid(anchorDate) {
  const start = new Date(anchorDate)
  start.setDate(start.getDate() - start.getDay())
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return { date: d, otherMonth: false }
  })
}

export default function Eventos() {
  const navigate = useNavigate()

  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [viewMode, setViewMode] = useState('month')
  const [anchorDate, setAnchorDate] = useState(() => new Date())
  const plannerRef = useRef(null)

  function loadEvents() {
    setLoading(true)
    setError(null)
    getEvents()
      .then(setEvents)
      .catch(err => { logError('Eventos.loadEvents', err); setError(err) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadEvents() }, [])

  // All-events table below the calendar -- independent of the calendar's
  // viewMode/anchorDate, always the full list, same search/filter/pagination
  // pattern as ReportsList.
  const eventFilters = useEventFilters(events)
  const { filteredEvents, clearFilters,
    searchQuery, technicianFilter, statusFilter, serviceTypeFilter, equipmentFilter, dateFrom, dateTo } = eventFilters
  const { page, setPage, totalPages, pageItems: paginatedEvents } = usePagination(filteredEvents)

  useEffect(() => {
    setPage(1)
  }, [searchQuery, technicianFilter, statusFilter, serviceTypeFilter, equipmentFilter, dateFrom, dateTo, setPage])

  // Jump to ~7am rather than opening at midnight every time the planner
  // shows up -- only on switching *into* week view, not on every prev/next
  // (anchorDate isn't a dependency here), so paging through weeks keeps
  // whatever scroll position the user left it at.
  useEffect(() => {
    if (viewMode === 'week' && plannerRef.current) {
      plannerRef.current.scrollTop = PLANNER_DEFAULT_SCROLL_HOUR * PLANNER_ROW_HEIGHT
    }
  }, [viewMode])

  const monthCells = useMemo(() => monthGrid(anchorDate), [anchorDate])
  const weekCells = useMemo(() => weekGrid(anchorDate), [anchorDate])
  const eventsByDate = useMemo(() => {
    const map = new Map()
    for (const e of events) {
      if (!map.has(e.event_date)) map.set(e.event_date, [])
      map.get(e.event_date).push(e)
    }
    return map
  }, [events])

  function changeAnchor(delta) {
    setAnchorDate(prev => {
      if (viewMode === 'week') { const d = new Date(prev); d.setDate(d.getDate() + delta * 7); return d }
      if (viewMode === 'year') return new Date(prev.getFullYear() + delta, prev.getMonth(), 1)
      return new Date(prev.getFullYear(), prev.getMonth() + delta, 1)
    })
  }

  function goToMonth(date) {
    setAnchorDate(date)
    setViewMode('month')
  }

  const today = todayISODate()

  const headerTitle = useMemo(() => {
    if (viewMode === 'year') return String(anchorDate.getFullYear())
    if (viewMode === 'week') {
      const start = weekCells[0].date
      const end = weekCells[6].date
      const startLabel = start.getMonth() === end.getMonth() ? `${start.getDate()}` : `${start.getDate()} ${MONTH_LABELS_SHORT[start.getMonth()]}`
      return `${startLabel} - ${end.getDate()} ${MONTH_LABELS[end.getMonth()]}, ${end.getFullYear()}`
    }
    return `${MONTH_LABELS[anchorDate.getMonth()]} ${anchorDate.getFullYear()}`
  }, [viewMode, anchorDate, weekCells])

  function renderDayCell({ date, otherMonth }) {
    const dateStr = toLocalISODate(date)
    const dayEvents = eventsByDate.get(dateStr) ?? []
    return (
      <div
        key={dateStr}
        className={`calendar-day ${otherMonth ? 'other-month' : ''} ${dateStr === today ? 'today' : ''} ${dayEvents.length ? 'calendar-day-has-events' : ''}`}
        onClick={() => navigate(`/eventos/nuevo?fecha=${dateStr}`)}
      >
        <span className="calendar-day-number">{date.getDate()}</span>
        {dayEvents.map(ev => (
          <div
            key={ev.id}
            className={`calendar-event-chip badge-${ev.status}`}
            title={`${ev.event_time ? ev.event_time.slice(0, 5) + ' · ' : ''}${ev.client_name || 'Sin cliente'}`}
            onClick={(e) => { e.stopPropagation(); navigate(`/eventos/${ev.id}`) }}
          >
            {ev.event_time ? `${ev.event_time.slice(0, 5)} ` : ''}{ev.client_name || 'Sin cliente'}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="content-wrapper fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800 }}><CalendarDays size={22} style={{ verticalAlign: 'middle', marginRight: 8 }} />Eventos</h1>
          <p style={{ color: 'var(--clr-text-light)', fontSize: 13, marginTop: 4 }}>Visitas de servicio programadas</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/eventos/nuevo')}>
          <Plus size={16} /> Nuevo Evento
        </button>
      </div>

      <div className="card">
        <div className="calendar-header">
          <h2>{headerTitle}</h2>
          <div className="calendar-nav">
            <div className="view-mode-switch">
              {VIEW_MODES.map(v => (
                <button key={v.id} className={`btn btn-sm ${viewMode === v.id ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setViewMode(v.id)}>
                  {v.label}
                </button>
              ))}
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => setAnchorDate(new Date())}>Hoy</button>
            <button className="icon-btn" onClick={() => changeAnchor(-1)}><ChevronLeft size={16} /></button>
            <button className="icon-btn" onClick={() => changeAnchor(1)}><ChevronRight size={16} /></button>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <Loader size={32} className="spin" color="var(--clr-primary)" />
          </div>
        ) : error ? (
          <div className="empty-state">
            <div className="empty-icon">⚠️</div>
            <p>No se pudieron cargar los eventos</p>
            <br />
            <button className="btn btn-primary" onClick={loadEvents}>Reintentar</button>
          </div>
        ) : viewMode === 'year' ? (
          <div className="year-grid">
            {Array.from({ length: 12 }, (_, m) => new Date(anchorDate.getFullYear(), m, 1)).map(monthDate => (
              <div className="year-month-card" key={monthDate.getMonth()}>
                <p className="year-month-title" onClick={() => goToMonth(monthDate)}>{MONTH_LABELS[monthDate.getMonth()]}</p>
                <div className="year-mini-grid">
                  {WEEKDAY_LABELS.map(w => <span className="year-mini-weekday" key={w}>{w[0]}</span>)}
                  {monthGrid(monthDate).map(({ date, otherMonth }) => {
                    const dateStr = toLocalISODate(date)
                    const hasEvents = (eventsByDate.get(dateStr) ?? []).length > 0
                    return (
                      <span
                        key={dateStr}
                        className={`year-mini-day ${otherMonth ? 'other-month' : ''} ${dateStr === today ? 'today' : ''} ${hasEvents ? 'has-events' : ''}`}
                        onClick={() => goToMonth(date)}
                      >
                        {date.getDate()}
                      </span>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : viewMode === 'week' ? (
          <div className="planner" ref={plannerRef}>
            <div className="planner-corner" />
            {weekCells.map(({ date }) => {
              const dateStr = toLocalISODate(date)
              return (
                <div key={dateStr} className={`planner-day-header ${dateStr === today ? 'today' : ''}`}>
                  <span className="planner-day-name">{WEEKDAY_LABELS[date.getDay()]}</span>
                  <span className="planner-day-number">{date.getDate()}</span>
                </div>
              )
            })}

            <div className="planner-allday-label">Todo<br />el día</div>
            {weekCells.map(({ date }) => {
              const dateStr = toLocalISODate(date)
              const allDayEvents = (eventsByDate.get(dateStr) ?? []).filter(ev => !ev.event_time)
              return (
                <div key={dateStr} className="planner-allday-cell" onClick={() => navigate(`/eventos/nuevo?fecha=${dateStr}`)}>
                  {allDayEvents.map(ev => (
                    <div key={ev.id} className={`planner-event-chip badge-${ev.status}`}
                      title={ev.client_name || 'Sin cliente'}
                      onClick={(e) => { e.stopPropagation(); navigate(`/eventos/${ev.id}`) }}>
                      {ev.client_name || 'Sin cliente'}
                    </div>
                  ))}
                </div>
              )
            })}

            {HOURS.flatMap(h => [
              <div className="planner-hour-label" key={`label-${h}`}>{formatHourLabel(h)}</div>,
              ...weekCells.map(({ date }) => {
                const dateStr = toLocalISODate(date)
                const hourEvents = (eventsByDate.get(dateStr) ?? []).filter(ev => eventHour(ev) === h)
                return (
                  <div key={`${dateStr}-${h}`} className="planner-cell"
                    onClick={() => navigate(`/eventos/nuevo?fecha=${dateStr}&hora=${formatHourLabel(h)}`)}>
                    {hourEvents.map(ev => (
                      <div key={ev.id} className={`planner-event-chip badge-${ev.status}`}
                        title={`${ev.event_time.slice(0, 5)} · ${ev.client_name || 'Sin cliente'}`}
                        onClick={(e) => { e.stopPropagation(); navigate(`/eventos/${ev.id}`) }}>
                        {ev.event_time.slice(0, 5)} {ev.client_name || 'Sin cliente'}
                      </div>
                    ))}
                  </div>
                )
              }),
            ])}
          </div>
        ) : (
          <div className="calendar-grid">
            {WEEKDAY_LABELS.map(w => <div className="calendar-weekday" key={w}>{w}</div>)}
            {monthCells.map(renderDayCell)}
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontSize: 17, fontWeight: 700 }}>Todos los Eventos</h3>
          {!loading && events.length > 0 && (
            <span style={{ fontSize: 13, color: 'var(--clr-text-light)' }}>
              Mostrando {paginatedEvents.length ? (page - 1) * 10 + 1 : 0}-{(page - 1) * 10 + paginatedEvents.length} de {filteredEvents.length}
            </span>
          )}
        </div>

        {!loading && events.length > 0 && <EventFilters {...eventFilters} />}

        {loading ? (
          <EventsTableSkeleton />
        ) : error ? (
          <div className="empty-state">
            <div className="empty-icon">⚠️</div>
            <p>No se pudieron cargar los eventos</p>
            <br />
            <button className="btn btn-primary" onClick={loadEvents}>Reintentar</button>
          </div>
        ) : events.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📅</div>
            <p>No hay eventos aún</p>
            <span>Crea tu primer evento</span>
            <br /><br />
            <button className="btn btn-primary" onClick={() => navigate('/eventos/nuevo')}>
              <Plus size={16} /> Nuevo Evento
            </button>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🔍</div>
            <p>Ningún evento coincide con los filtros</p>
            <span>Ajusta o limpia los filtros para ver más resultados</span>
            <br /><br />
            <button className="btn btn-secondary" onClick={clearFilters}>
              <X size={16} /> Limpiar Filtros
            </button>
          </div>
        ) : (
          <>
            <EventsTable events={paginatedEvents} />
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        )}
      </div>
    </div>
  )
}
