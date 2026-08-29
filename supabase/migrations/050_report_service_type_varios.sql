-- ============================================================
--  SIMEC Service Reports – add "Varios" service type for Trabajos Varios
--  Tipo de Servicio stays visible even for Trabajos Varios reports
--  (it's NOT NULL and a meaningful classification for any job), but
--  gets a 4th option -- "Varios" -- that's only offered/defaulted to
--  when equipment_type = 'trabajos_varios' (enforced in NewReport.jsx;
--  the DB just needs to accept the value).
--  Run after 001-049.
-- ============================================================

alter table public.service_reports
  drop constraint if exists service_reports_service_type_check;

alter table public.service_reports
  add constraint service_reports_service_type_check
  check (service_type in ('preventivo', 'correctivo', 'arranque', 'varios'));
