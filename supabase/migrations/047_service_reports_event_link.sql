-- ============================================================
--  SIMEC Service Reports – link a report to the Evento it came from
--  One event (a scheduled visit) can have 1+ reports linked to it --
--  e.g. a técnico services two different pieces of equipment in the
--  same visit and files a separate report for each. A report links to
--  at most one event; nullable/optional, since most reports today
--  aren't tied to a scheduled visit at all.
--  ON DELETE SET NULL, not CASCADE/NO ACTION -- a report is the actual
--  record of work performed and stays valid on its own; deleting the
--  scheduling entry (Eventos) shouldn't destroy or block deleting it,
--  just drop the link.
--  Run after 001-046.
-- ============================================================

alter table public.service_reports
  add column if not exists event_id uuid references public.service_events(id) on delete set null;

create index if not exists service_reports_event_id_idx on public.service_reports (event_id);
