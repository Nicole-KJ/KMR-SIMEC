-- ============================================================
--  SIMEC Service Reports – Invalidate all cached report PDFs
--  The cache (011/012) has no awareness of PDF-generation code
--  changes -- a report cached before today's margin fix (or before
--  the imageUrlToBase64 fix in pdfService.js) would keep serving
--  that stale file forever. One-time reset so every report
--  regenerates fresh on its next download.
-- ============================================================

update public.service_reports
set pdf_storage_path = null
where pdf_storage_path is not null;
