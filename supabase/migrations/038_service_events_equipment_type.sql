-- ============================================================
--  SIMEC Service Reports – Eventos: equipment_type
--  Nuevo Evento's new "Tipo de Equipo" card reuses the same module
--  grid/ids as NewReport.jsx's step-1 equipment selector
--  (src/constants/equipmentModules, MODULES = ups/ac/generador/
--  bateria/ats/tablero). Nullable -- optional at scheduling time,
--  same reasoning as the original 035 note on why equipment fields
--  were left out of service_events initially.
--  Run after 001-037.
-- ============================================================

alter table public.service_events
  add column if not exists equipment_type text
    check (equipment_type is null or equipment_type in ('ups', 'ac', 'generador', 'bateria', 'ats', 'tablero'));
