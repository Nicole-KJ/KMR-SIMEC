-- ============================================================
--  SIMEC Service Reports – Permanent PDF archive
-- ============================================================

alter table public.service_reports
  add column if not exists pdf_storage_path text;

-- Private, same reasoning as report-photos (003): a report PDF is client
-- business data, not a low-sensitivity image.
insert into storage.buckets (id, name, public)
values ('report-pdfs', 'report-pdfs', false)
on conflict (id) do nothing;

create policy "report-pdfs: technician manages own report's pdf"
on storage.objects for all
using (
  bucket_id = 'report-pdfs'
  and exists (
    select 1 from public.service_reports r
    where r.id::text = (storage.foldername(name))[1]
      and r.technician_id = auth.uid()
  )
)
with check (
  bucket_id = 'report-pdfs'
  and exists (
    select 1 from public.service_reports r
    where r.id::text = (storage.foldername(name))[1]
      and r.technician_id = auth.uid()
  )
);

-- Re-create sign_report (003) to also null out any cached PDF on signing,
-- since the signed PDF must include the signature block.
create or replace function public.sign_report(
  p_report_id uuid,
  p_signer_name text,
  p_signer_id text,
  p_signature_url text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.service_reports
  set client_signer_name   = p_signer_name,
      client_signer_id     = p_signer_id,
      client_signature_url = p_signature_url,
      signed_at             = now(),
      status                = 'signed',
      pdf_storage_path      = null
  where id = p_report_id
    and status <> 'signed';
end;
$$;
