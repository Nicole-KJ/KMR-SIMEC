-- ============================================================
--  SIMEC Service Reports – Fix "reports: listed technician read" (027)
--  Caught by testing 027 against a real demo report: the policy's
--  correlated subquery wrote `rt.report_id = id`, but inside
--  `FROM report_technicians rt`, the unqualified `id` resolves to
--  rt.id (report_technicians' own primary key), not
--  service_reports.id -- so it was really checking "does this report
--  have any técnico row whose own id happens to equal its report_id",
--  which is never true. Net effect: the policy silently granted
--  nobody access (harmless -- fails closed -- but also didn't do its
--  job). Fixed by qualifying the outer column explicitly.
--  Run after 001-027.
-- ============================================================

drop policy if exists "reports: listed technician read" on public.service_reports;

create policy "reports: listed technician read" on public.service_reports
  for select using (
    exists (
      select 1 from public.report_technicians rt
      where rt.report_id = service_reports.id and rt.technician_id = auth.uid()
    )
  );
