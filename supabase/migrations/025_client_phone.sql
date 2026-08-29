-- ============================================================
--  SIMEC Service Reports – Client phone
--  Backs "Teléfono del cliente" in Nuevo Reporte > Datos del Cliente.
--  Run after 001-024.
-- ============================================================

alter table public.service_reports
  add column if not exists client_phone text;
