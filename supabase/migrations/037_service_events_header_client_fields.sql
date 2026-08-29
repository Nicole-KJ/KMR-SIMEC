-- ============================================================
--  SIMEC Service Reports – Eventos: Encabezado + Datos del Cliente fields
--  Nuevo Evento's Encabezado card gets event_code/event_name (mirrors
--  service_reports.sc_code/project_name, 001), and Datos del Cliente
--  gains client_phone/client_email (mirrors service_reports' own
--  client_phone/client_email, 025/014). All plain nullable text,
--  same convention as those columns -- required-ness is enforced
--  app-side (validation in NewEvento.jsx), not by a DB constraint.
--  Run after 001-036.
-- ============================================================

alter table public.service_events
  add column if not exists event_code   text,
  add column if not exists event_name   text,
  add column if not exists client_phone text,
  add column if not exists client_email text;
