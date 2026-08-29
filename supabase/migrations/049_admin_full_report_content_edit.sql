-- ============================================================
--  SIMEC Service Reports – admin can edit any report's content
--  Reverses 031's own restriction: an admin who isn't listed as a
--  técnico on a report used to be limited to the Técnicos section
--  only (032). Admin now gets full content edit on any non-signed
--  report, same as its own técnico -- can_edit_report_content is the
--  single function every content-edit path already goes through
--  (the enforce_report_edit_scope trigger, report_technicians/
--  report_parts RLS, and the report-photos storage policy), so
--  adding is_admin() here is the one change that reaches all of them.
--  Still blocked once a report is signed, for admin and técnico alike
--  -- that restriction is untouched.
--  Run after 001-048.
-- ============================================================

create or replace function public.can_edit_report_content(p_report_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.service_reports r
    where r.id = p_report_id
      and r.status <> 'signed'
      and (
        r.technician_id = auth.uid()
        or public.is_admin()
        or exists (
          select 1 from public.report_technicians rt
          where rt.report_id = r.id and rt.technician_id = auth.uid()
        )
      )
  );
$$;
