-- ============================================================
--  SIMEC Service Reports – Add bateria/ats/tablero equipment types
--  (generador was already permitted by 001_initial_schema.sql)
-- ============================================================

-- If the DROP below errors because the constraint has a different name,
-- find the real name first with:
--   select conname from pg_constraint
--   where conrelid = 'public.service_reports'::regclass and contype = 'c';

alter table public.service_reports
  drop constraint if exists service_reports_equipment_type_check;

alter table public.service_reports
  add constraint service_reports_equipment_type_check
  check (equipment_type in ('ups','ac','generador','bees','microdatacenter','bateria','ats','tablero'));
