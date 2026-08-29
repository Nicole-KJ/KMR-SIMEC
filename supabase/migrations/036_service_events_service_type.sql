-- ============================================================
--  SIMEC Service Reports – Eventos: add service_type
--  "Nuevo Evento" now opens as its own view whose first step is
--  picking the service type (Preventivo/Correctivo/Arranque), same
--  concept/UI as NewReport.jsx's Tipo de Servicio card (reused via
--  src/constants/serviceTypes.js). Required, matching
--  service_reports.service_type's own "not null check(...)" (001) --
--  backfill first so the NOT NULL can be added without failing on
--  any event scheduled before this column existed.
--  Run after 001-035.
-- ============================================================

alter table public.service_events add column if not exists service_type text;

update public.service_events set service_type = 'preventivo' where service_type is null;

alter table public.service_events
  alter column service_type set not null,
  add constraint service_events_service_type_check
    check (service_type in ('preventivo', 'correctivo', 'arranque'));
