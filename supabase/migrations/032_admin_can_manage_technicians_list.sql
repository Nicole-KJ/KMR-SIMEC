-- ============================================================
--  SIMEC Service Reports – Clarifies 031: admin CAN manage the Técnicos
--  list on any report, técnico or not -- 031 narrowed report_technicians
--  to técnico-only along with report_parts/report_photos, but the actual
--  requirement is narrower still: "Técnicos" is the one section of a
--  report an uninvolved admin is allowed to edit (e.g. correcting who's
--  credited on a job). Every other section -- equipment data, parts,
--  photos, work description, client info snapshot aside -- stays
--  técnico-only, per 031.
--
--  Reverts report_technicians' write policies back to can_edit_report
--  (admin-inclusive, 027) while report_parts/report_photos keep
--  can_edit_report_content (técnico-only, 031).
--  Run after 001-031.
-- ============================================================

drop policy if exists "technicians: insert via report" on public.report_technicians;
drop policy if exists "technicians: update via report" on public.report_technicians;
drop policy if exists "technicians: delete via report" on public.report_technicians;

create policy "technicians: insert via report" on public.report_technicians
  for insert with check (public.can_edit_report(report_id));
create policy "technicians: update via report" on public.report_technicians
  for update using (public.can_edit_report(report_id));
create policy "technicians: delete via report" on public.report_technicians
  for delete using (public.can_edit_report(report_id));
