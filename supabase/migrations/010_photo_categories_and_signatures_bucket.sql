-- ============================================================
--  SIMEC Service Reports – Photo categories (equipo/antes/despues)
--  + real Storage bucket for signature images
-- ============================================================

alter table public.report_photos
  add column if not exists photo_type text not null default 'equipo'
  check (photo_type in ('equipo','antes','despues'));

-- Public, same reasoning as avatars (005): a signature image isn't more
-- sensitive than what's already exposed via the public signing/report link,
-- and public avoids a signed-URL round trip on every render.
insert into storage.buckets (id, name, public)
values ('signatures', 'signatures', true)
on conflict (id) do nothing;

create policy "signatures: public read" on storage.objects
  for select using (bucket_id = 'signatures');

-- Mirrors sign_report's own guard (status <> 'signed'): anyone who knows a
-- report's UUID can upload its signature image exactly while it's unsigned.
-- Same trust boundary the RPC already relies on -- no new exposure.
create policy "signatures: upload while report unsigned" on storage.objects
  for insert with check (
    bucket_id = 'signatures'
    and exists (
      select 1 from public.service_reports r
      where r.id::text = (storage.foldername(name))[1]
        and r.status <> 'signed'
    )
  );
