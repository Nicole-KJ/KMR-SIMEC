-- ============================================================
--  SIMEC Service Reports – Let admins write the PDF cache too
--  015 gave admins/clients read access to report-pdfs (so their
--  downloads can reuse a cached copy), but the write-back after
--  generating a fresh PDF was still technician-only, at both the
--  storage policy and the set_report_pdf_path RPC. Not a format bug
--  (the download itself already always succeeds and is a real PDF,
--  regenerated fresh when there's no usable cache) -- just meant an
--  admin's download could never populate/reuse the cache the way a
--  technician's can. Clients stay read-only; they're pure viewers.
-- ============================================================

drop policy if exists "report-pdfs: insert via report" on storage.objects;
create policy "report-pdfs: insert via report" on storage.objects
  for insert with check (
    bucket_id = 'report-pdfs' and exists (
      select 1 from public.service_reports r
      where r.id::text = (storage.foldername(name))[1]
        and (r.technician_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists "report-pdfs: update via report" on storage.objects;
create policy "report-pdfs: update via report" on storage.objects
  for update using (
    bucket_id = 'report-pdfs' and exists (
      select 1 from public.service_reports r
      where r.id::text = (storage.foldername(name))[1]
        and (r.technician_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists "report-pdfs: delete via report" on storage.objects;
create policy "report-pdfs: delete via report" on storage.objects
  for delete using (
    bucket_id = 'report-pdfs' and exists (
      select 1 from public.service_reports r
      where r.id::text = (storage.foldername(name))[1]
        and (r.technician_id = auth.uid() or public.is_admin())
    )
  );

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
    and (technician_id = auth.uid() or public.is_admin());
end;
$$;

-- CREATE OR REPLACE resets a function's ACL to Postgres/Supabase defaults
-- (EXECUTE granted to anon too) -- make it explicit instead, matching 006.
revoke execute on function public.set_report_pdf_path(uuid, text) from anon;
grant execute on function public.set_report_pdf_path(uuid, text) to authenticated;
