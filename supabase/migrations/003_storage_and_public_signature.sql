-- ============================================================
--  SIMEC Service Reports – Storage bucket + public signature access
--  Run this after 001_initial_schema.sql and 002_equipment_data.sql
-- ============================================================

-- ─── STORAGE BUCKET FOR REPORT PHOTOS ──────────────────────────
insert into storage.buckets (id, name, public)
values ('report-photos', 'report-photos', false)
on conflict (id) do nothing;

-- Objects are stored as `${report_id}/${filename}`. A technician may
-- manage (upload/read/delete) photos only for reports they own.
create policy "report-photos: technician manages own report's photos"
on storage.objects for all
using (
  bucket_id = 'report-photos'
  and exists (
    select 1 from public.service_reports r
    where r.id::text = (storage.foldername(name))[1]
      and r.technician_id = auth.uid()
  )
)
with check (
  bucket_id = 'report-photos'
  and exists (
    select 1 from public.service_reports r
    where r.id::text = (storage.foldername(name))[1]
      and r.technician_id = auth.uid()
  )
);

-- ─── PUBLIC (UNAUTHENTICATED) SIGNATURE ACCESS ─────────────────
-- The /firma/:reportId page is opened by the client on their own device,
-- with no Supabase session. The base RLS policies on service_reports
-- intentionally scope SELECT/UPDATE to the owning technician, so that
-- flow can't just read/update the table directly. These two
-- SECURITY DEFINER functions expose the minimum needed instead:
--   - read-only, non-sensitive fields for display
--   - a signature write that only ever touches signature columns,
--     and only once (report must not already be signed)

create or replace function public.get_report_for_signature(p_report_id uuid)
returns table (
  id uuid,
  report_number int,
  client_name text,
  technician_name text,
  report_date date,
  service_type text,
  equipment_type text,
  brand text,
  model text,
  location text,
  work_description text,
  status text,
  client_signer_name text,
  client_signer_id text,
  client_signature_url text,
  signed_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select id, report_number, client_name, technician_name, report_date,
         service_type, equipment_type, brand, model, location, work_description,
         status, client_signer_name, client_signer_id, client_signature_url, signed_at
  from public.service_reports
  where id = p_report_id;
$$;

grant execute on function public.get_report_for_signature(uuid) to anon, authenticated;

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
      status                = 'signed'
  where id = p_report_id
    and status <> 'signed';
end;
$$;

grant execute on function public.sign_report(uuid, text, text, text) to anon, authenticated;
