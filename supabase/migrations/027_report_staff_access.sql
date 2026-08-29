-- ============================================================
--  SIMEC Service Reports – Report access for admins and listed técnicos
--  Two RLS gaps this closes, both driven by the same request:
--   1. Admin had no UPDATE policy on service_reports at all -- "reports:
--      own update" (004) only ever matched the report's own creator, so
--      an admin opening someone else's report in the edit screen would
--      silently no-op (RLS-blocked updates return 0 rows, not an error).
--   2. report_technicians.technician_name was always free text -- a técnico
--      *listed* on a report (but not its creator) had no way to be
--      recognized by RLS at all, so they couldn't even view it, let alone
--      edit it.
--  Fixes both with two small SECURITY DEFINER helpers (same pattern as
--  is_admin(), 004) so the "who can touch this report" rule lives in one
--  place instead of being copy-pasted across service_reports,
--  report_technicians, report_parts, report_photos and two storage buckets.
--  Run after 001-026 (026 is superseded by this file's redefinition of
--  get_unlinked_report_clients, but still needs to run first since it's
--  the migration that first split that function's admin-only gate).
-- ============================================================

-- ─── report_technicians CAN NOW LINK TO A REAL ACCOUNT ─────────────────
-- Mirrors service_reports.client_user_id (015): NewReport.jsx's "Nombre
-- del técnico" field is already a dropdown of registered técnicos (never
-- free-typed), so capturing the id alongside the name is just persisting
-- what the UI already resolves. Nullable -- legacy rows, and any name kept
-- only because that técnico account was later renamed/removed, have none.
alter table public.report_technicians
  add column if not exists technician_id uuid references public.profiles(id);

-- ─── CAN THIS USER *SEE* THIS REPORT? (no signed-lock) ─────────────────
-- True for the report's creator, an admin, or anyone listed as one of its
-- técnicos. Does not cover clients (service_reports.client_user_id) --
-- that access is narrower on purpose and stays a separate OR'd policy.
create or replace function public.is_report_technician(p_report_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.service_reports r
    where r.id = p_report_id
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

revoke execute on function public.is_report_technician(uuid) from public;
grant execute on function public.is_report_technician(uuid) to authenticated;

-- ─── CAN THIS USER *EDIT* THIS REPORT? (same, plus not yet signed) ─────
create or replace function public.can_edit_report(p_report_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_report_technician(p_report_id) and exists (
    select 1 from public.service_reports r where r.id = p_report_id and r.status <> 'signed'
  );
$$;

revoke execute on function public.can_edit_report(uuid) from public;
grant execute on function public.can_edit_report(uuid) to authenticated;

-- ─── service_reports ────────────────────────────────────────────────────
-- Additive: a listed técnico can now also SELECT the report (existing
-- "own read"/"admin read all"/"client read own" policies are untouched
-- and still OR in as before).
create policy "reports: listed technician read" on public.service_reports
  for select using (
    exists (select 1 from public.report_technicians rt where rt.report_id = id and rt.technician_id = auth.uid())
  );

-- Replaces "own update" (004) -- can_edit_report is a strict superset of
-- its condition (owner + not signed), now also covering admin and listed
-- técnicos.
drop policy if exists "reports: own update" on public.service_reports;
create policy "reports: staff update" on public.service_reports
  for update
  using (public.can_edit_report(id))
  with check (public.can_edit_report(id));

-- ─── report_technicians / report_parts / report_photos ─────────────────
drop policy if exists "technicians: read via report" on public.report_technicians;
drop policy if exists "technicians: insert via report" on public.report_technicians;
drop policy if exists "technicians: update via report" on public.report_technicians;
drop policy if exists "technicians: delete via report" on public.report_technicians;

create policy "technicians: read via report" on public.report_technicians
  for select using (public.is_report_technician(report_id));
create policy "technicians: insert via report" on public.report_technicians
  for insert with check (public.can_edit_report(report_id));
create policy "technicians: update via report" on public.report_technicians
  for update using (public.can_edit_report(report_id));
create policy "technicians: delete via report" on public.report_technicians
  for delete using (public.can_edit_report(report_id));

drop policy if exists "parts: read via report" on public.report_parts;
drop policy if exists "parts: insert via report" on public.report_parts;
drop policy if exists "parts: update via report" on public.report_parts;
drop policy if exists "parts: delete via report" on public.report_parts;

create policy "parts: read via report" on public.report_parts
  for select using (public.is_report_technician(report_id));
create policy "parts: insert via report" on public.report_parts
  for insert with check (public.can_edit_report(report_id));
create policy "parts: update via report" on public.report_parts
  for update using (public.can_edit_report(report_id));
create policy "parts: delete via report" on public.report_parts
  for delete using (public.can_edit_report(report_id));

drop policy if exists "photos: read via report" on public.report_photos;
drop policy if exists "photos: insert via report" on public.report_photos;
drop policy if exists "photos: delete via report" on public.report_photos;

create policy "photos: read via report" on public.report_photos
  for select using (public.is_report_technician(report_id));
create policy "photos: insert via report" on public.report_photos
  for insert with check (public.can_edit_report(report_id));
create policy "photos: delete via report" on public.report_photos
  for delete using (public.can_edit_report(report_id));

-- ─── storage: report-photos (actual uploaded files, signed-lock applies) ─
drop policy if exists "report-photos: read via report" on storage.objects;
drop policy if exists "report-photos: insert via report" on storage.objects;
drop policy if exists "report-photos: delete via report" on storage.objects;

create policy "report-photos: read via report" on storage.objects
  for select using (
    bucket_id = 'report-photos' and public.is_report_technician(((storage.foldername(name))[1])::uuid)
  );
create policy "report-photos: insert via report" on storage.objects
  for insert with check (
    bucket_id = 'report-photos' and public.can_edit_report(((storage.foldername(name))[1])::uuid)
  );
create policy "report-photos: delete via report" on storage.objects
  for delete using (
    bucket_id = 'report-photos' and public.can_edit_report(((storage.foldername(name))[1])::uuid)
  );

-- ─── storage: report-pdfs (cached render -- no signed-lock, same as 016) ─
drop policy if exists "report-pdfs: read via report" on storage.objects;
drop policy if exists "report-pdfs: insert via report" on storage.objects;
drop policy if exists "report-pdfs: update via report" on storage.objects;
drop policy if exists "report-pdfs: delete via report" on storage.objects;

create policy "report-pdfs: read via report" on storage.objects
  for select using (
    bucket_id = 'report-pdfs' and (
      public.is_report_technician(((storage.foldername(name))[1])::uuid)
      or exists (
        select 1 from public.service_reports r
        where r.id::text = (storage.foldername(name))[1] and r.client_user_id = auth.uid()
      )
    )
  );
create policy "report-pdfs: insert via report" on storage.objects
  for insert with check (
    bucket_id = 'report-pdfs' and public.is_report_technician(((storage.foldername(name))[1])::uuid)
  );
create policy "report-pdfs: update via report" on storage.objects
  for update using (
    bucket_id = 'report-pdfs' and public.is_report_technician(((storage.foldername(name))[1])::uuid)
  );
create policy "report-pdfs: delete via report" on storage.objects
  for delete using (
    bucket_id = 'report-pdfs' and public.is_report_technician(((storage.foldername(name))[1])::uuid)
  );

-- set_report_pdf_path (016) had the same owner-or-admin gate -- same extension.
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
    and public.is_report_technician(p_report_id);
end;
$$;

revoke execute on function public.set_report_pdf_path(uuid, text) from anon;
grant execute on function public.set_report_pdf_path(uuid, text) to authenticated;

-- ─── get_unlinked_report_clients (023, then 026) ────────────────────────
-- Same broadening: a técnico listed on a report (not just its creator)
-- can now see that report's client in their "Todos los clientes" too.
create or replace function public.get_unlinked_report_clients()
returns table (client_name text, client_email text, client_address text)
language sql
security definer
set search_path = public
as $$
  select distinct on (lower(trim(sr.client_name)))
    sr.client_name, sr.client_email, sr.client_address
  from public.service_reports sr
  where public.is_report_technician(sr.id)
    and sr.client_user_id is null
    and sr.client_name is not null
    and trim(sr.client_name) <> ''
    and lower(trim(sr.client_name)) not in (
      select lower(trim(p.full_name))
      from public.profiles p
      where p.role = 'cliente' and p.full_name is not null
    )
  order by lower(trim(sr.client_name)), sr.created_at desc;
$$;
