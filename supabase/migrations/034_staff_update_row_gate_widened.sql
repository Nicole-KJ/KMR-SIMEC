-- ============================================================
--  SIMEC Service Reports – Widen the row-level UPDATE gate on
--  service_reports so the client-info exception (033) can actually
--  reach signed rows
--  033 taught the trigger to allow the narrow client-fields-only edit
--  on a signed report, but missed that the RLS policy itself
--  ("reports: staff update", 031) still used can_edit_report(id) --
--  which requires status <> 'signed' -- as its USING/WITH CHECK
--  clause. RLS is evaluated before the trigger even runs, so a signed
--  row was never a candidate for the UPDATE statement in the first
--  place, regardless of what the trigger would have allowed.
--
--  Widened to is_report_technician(id) (admin, owner, or listed
--  técnico can see the row, no signed-lock) -- the actual column-level
--  enforcement (full edit only if not signed and owner/listed; narrow
--  client-fields-only edit for an unlinked client at any status) stays
--  entirely in enforce_report_edit_scope(), same as it already was.
--  Run after 001-033.
-- ============================================================

drop policy if exists "reports: staff update" on public.service_reports;
create policy "reports: staff update" on public.service_reports
  for update
  using (public.is_report_technician(id))
  with check (public.is_report_technician(id));
