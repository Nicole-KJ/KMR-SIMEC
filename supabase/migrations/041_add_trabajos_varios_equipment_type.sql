-- ============================================================
--  SIMEC Service Reports – add "Trabajos Varios" equipment type
--  New catch-all module (src/constants/equipmentModules/trabajosVarios.js)
--  for work that doesn't fit UPS/AC/Generador/Batería/ATS/Tablero, using
--  the same generic module form as those. Both service_reports (009)
--  and service_events (038) check equipment_type against a fixed list --
--  MODULES is shared between Nuevo Reporte's step 1 and Nuevo Evento's
--  Tipo de Equipo (Eventos), so both need the new value.
--  Run after 001-040.
-- ============================================================

alter table public.service_reports
  drop constraint if exists service_reports_equipment_type_check;

alter table public.service_reports
  add constraint service_reports_equipment_type_check
  check (equipment_type in ('ups','ac','generador','bees','microdatacenter','bateria','ats','tablero','trabajos_varios'));

alter table public.service_events drop constraint if exists service_events_equipment_type_check;

alter table public.service_events
  add constraint service_events_equipment_type_check
    check (equipment_type is null or equipment_type in ('ups', 'ac', 'generador', 'bateria', 'ats', 'tablero', 'trabajos_varios'));
