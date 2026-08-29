-- ============================================================
--  SIMEC Service Reports – Eventos: drop the "borrador" status
--  Reverses part of 039 -- there's no draft-saving flow after all.
--  Nuevo Evento's "Crear Evento" button only submits once every
--  mandatory field is filled, and always creates the event as
--  'pendiente'. Workflow is now just: pendiente -> en_progreso ->
--  completado, or cancelado at any point. No existing rows were
--  ever 'borrador' (verified before writing this migration), so no
--  backfill needed.
--  Run after 001-039.
-- ============================================================

alter table public.service_events drop constraint if exists service_events_status_check;

alter table public.service_events
  alter column status set default 'pendiente',
  add constraint service_events_status_check
    check (status in ('pendiente', 'en_progreso', 'completado', 'cancelado'));
