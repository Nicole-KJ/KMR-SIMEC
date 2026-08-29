

hnmnmn-- ============================================================
--  SIMEC Service Reports – "Cliente" role
--  A client can log in and see only reports where they're the client.
--  Linked via service_reports.client_user_id (nullable — reports without
--  a registered client account keep working exactly as before), mirroring
--  the existing technician_id / get_technicians() pattern (013).
-- ============================================================

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('admin', 'tecnico', 'cliente'));

alter table public.service_reports
  add column if not exists client_user_id uuid references public.profiles(id);

-- ─── CLIENT: READ OWN REPORTS ───────────────────────────────────
create policy "reports: client read own" on public.service_reports
  for select using (auth.uid() = client_user_id);

-- ─── CLIENT DIRECTORY (for the "Cliente registrado" dropdown) ──
-- Same pattern as get_technicians() (013): RLS on profiles only allows
-- reading your own row (or all rows if admin), so this narrow
-- SECURITY DEFINER RPC exposes just the two columns needed, for
-- role = 'cliente' rows only.
create or replace function public.get_clients()
returns table (id uuid, full_name text)
language sql
security definer
set search_path = public
as $$
  select id, full_name
  from public.profiles
  where role = 'cliente'
  order by full_name;
$$;

grant execute on function public.get_clients() to authenticated;

-- ─── EXTEND REPORT-CHILDREN READ ACCESS TO THE CLIENT ───────────
-- Same "read via report" policies from 006, plus a client_user_id branch.
-- Only the SELECT policies change — a client never gets INSERT/UPDATE/DELETE
-- on any of this, same as they get no write policy on service_reports itself.
drop policy if exists "technicians: read via report" on public.report_technicians;
create policy "technicians: read via report" on public.report_technicians
  for select using (
    exists (select 1 from public.service_reports r where r.id = report_id
      and (r.technician_id = auth.uid() or r.client_user_id = auth.uid() or public.is_admin()))
  );

drop policy if exists "parts: read via report" on public.report_parts;
create policy "parts: read via report" on public.report_parts
  for select using (
    exists (select 1 from public.service_reports r where r.id = report_id
      and (r.technician_id = auth.uid() or r.client_user_id = auth.uid() or public.is_admin()))
  );

drop policy if exists "photos: read via report" on public.report_photos;
create policy "photos: read via report" on public.report_photos
  for select using (
    exists (select 1 from public.service_reports r where r.id = report_id
      and (r.technician_id = auth.uid() or r.client_user_id = auth.uid() or public.is_admin()))
  );

drop policy if exists "report-photos: read via report" on storage.objects;
create policy "report-photos: read via report" on storage.objects
  for select using (
    bucket_id = 'report-photos' and exists (
      select 1 from public.service_reports r
      where r.id::text = (storage.foldername(name))[1]
        and (r.technician_id = auth.uid() or r.client_user_id = auth.uid() or public.is_admin())
    )
  );

-- ─── report-pdfs HAD THE SAME "NO ADMIN ACCESS" BUG AS 001's report-photos ──
-- 011 (written after the 006 fix) recreated the original single-policy
-- shape for the new report-pdfs bucket, missing both the admin-visibility
-- fix and, now, the client one. Same split-by-command fix as 006.
drop policy if exists "report-pdfs: technician manages own report's pdf" on storage.objects;

create policy "report-pdfs: read via report" on storage.objects
  for select using (
    bucket_id = 'report-pdfs' and exists (
      select 1 from public.service_reports r
      where r.id::text = (storage.foldername(name))[1]
        and (r.technician_id = auth.uid() or r.client_user_id = auth.uid() or public.is_admin())
    )
  );
create policy "report-pdfs: insert via report" on storage.objects
  for insert with check (
    bucket_id = 'report-pdfs' and exists (
      select 1 from public.service_reports r
      where r.id::text = (storage.foldername(name))[1] and r.technician_id = auth.uid()
    )
  );
create policy "report-pdfs: update via report" on storage.objects
  for update using (
    bucket_id = 'report-pdfs' and exists (
      select 1 from public.service_reports r
      where r.id::text = (storage.foldername(name))[1] and r.technician_id = auth.uid()
    )
  );
create policy "report-pdfs: delete via report" on storage.objects
  for delete using (
    bucket_id = 'report-pdfs' and exists (
      select 1 from public.service_reports r
      where r.id::text = (storage.foldername(name))[1] and r.technician_id = auth.uid()
    )
  );
