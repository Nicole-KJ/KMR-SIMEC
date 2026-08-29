-- ============================================================
--  SIMEC Service Reports – Allow PDF caching on signed reports
--
--  "reports: own update" (004) blocks ANY update to a signed report,
--  including the harmless pdf_storage_path cache write added in 011 --
--  so a signed report's PDF was silently regenerated on every single
--  download instead of being cached once. This RPC is a narrow,
--  SECURITY DEFINER side-channel that touches only pdf_storage_path,
--  the same pattern sign_report (003) already uses to write through
--  RLS for a specific, safe purpose -- it never lets the technician
--  change any real report content on a locked/signed report.
-- ============================================================

create or replace function public.set_report_pdf_path(p_report_id uuid, p_path text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.service_reports
  set pdf_storage_path = p_path
  where id = p_report_id
    and technician_id = auth.uid();
end;
$$;

grant execute on function public.set_report_pdf_path(uuid, text) to authenticated;
