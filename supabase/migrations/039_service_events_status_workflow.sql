-- ============================================================
--  SIMEC Service Reports – Eventos: 5-state status workflow
--  Replaces the original 3-state status (programado/completado/
--  cancelado, 035) with the Event Detail view's workflow: borrador ->
--  pendiente -> en_progreso -> completado, or cancelado at any point.
--  'programado' events (already fully filled out, just awaiting the
--  visit) map onto 'pendiente' -- 'borrador' is reserved for events
--  newly created going forward. New default is 'borrador' to match
--  (see NewEvento.jsx).
--  Run after 001-038.
-- ============================================================

alter table public.service_events drop constraint if exists service_events_status_check;

update public.service_events set status = 'pendiente' where status = 'programado';

alter table public.service_events
  alter column status set default 'borrador',
  add constraint service_events_status_check
    check (status in ('borrador', 'pendiente', 'en_progreso', 'completado', 'cancelado'));
