-- ============================================================
--  SIMEC Service Reports – Almacenamiento: report vs. cached-PDF counts
--  A saved report (a service_reports row) and its PDF (a file in the
--  report-pdfs bucket) are two separate things -- a report only gets a
--  cached PDF once someone actually downloads/regenerates it
--  (pdf_storage_path). Creating reports never changes Storage usage by
--  itself, which is confusing without this distinction spelled out
--  next to the Storage byte counts. Same narrow SECURITY DEFINER RPC
--  pattern as get_storage_usage (042).
--  Run after 001-043.
-- ============================================================

create or replace function public.get_report_pdf_stats()
returns table (total_reports bigint, reports_with_cached_pdf bigint)
language sql
stable security definer
set search_path to 'public'
as $$
  select count(*) as total_reports, count(pdf_storage_path) as reports_with_cached_pdf
  from public.service_reports
  where public.is_admin();
$$;

grant execute on function public.get_report_pdf_stats() to authenticated;
