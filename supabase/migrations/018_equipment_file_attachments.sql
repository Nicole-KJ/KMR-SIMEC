-- ============================================================
--  SIMEC Service Reports – Storage bucket for equipment measurement file
--  attachments (e.g. Batería's "Mediciones" section)
-- ============================================================

insert into storage.buckets (id, name, public)
values ('equipment-files', 'equipment-files', false)
on conflict (id) do nothing;

-- Objects are stored as `${report_id}/${filename}`, same convention as
-- report-photos/report-pdfs. Policies mirror the current (post-015) shape
-- for those buckets: read is owner, admin, or the report's client; write is
-- owner-only while the report isn't signed.
create policy "equipment-files: read via report" on storage.objects
  for select using (
    bucket_id = 'equipment-files' and exists (
      select 1 from public.service_reports r
      where r.id::text = (storage.foldername(name))[1]
        and (r.technician_id = auth.uid() or r.client_user_id = auth.uid() or public.is_admin())
    )
  );

create policy "equipment-files: insert via report" on storage.objects
  for insert with check (
    bucket_id = 'equipment-files' and exists (
      select 1 from public.service_reports r
      where r.id::text = (storage.foldername(name))[1]
        and r.technician_id = auth.uid() and r.status <> 'signed'
    )
  );

create policy "equipment-files: delete via report" on storage.objects
  for delete using (
    bucket_id = 'equipment-files' and exists (
      select 1 from public.service_reports r
      where r.id::text = (storage.foldername(name))[1]
        and r.technician_id = auth.uid() and r.status <> 'signed'
    )
  );