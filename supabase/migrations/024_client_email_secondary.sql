-- ============================================================
--  SIMEC Service Reports – Additional client email
--  Backs the second "Correo del cliente" field in Nuevo Reporte >
--  Datos del Cliente, sent as an extra recipient alongside the
--  primary client_email whenever the report is emailed.
--  Run after 001-023.
-- ============================================================

alter table public.service_reports
  add column if not exists client_email_secondary text;
