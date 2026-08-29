-- ============================================================
--  SIMEC Service Reports – Foto del equipo (Inventario, 052)
--  One photo per equipo, stored as `${equipo_id}/photo.<ext>` (upsert on
--  re-upload, same convention as avatars, 005) -- private rather than
--  public like avatars, since this is business data about a client's
--  equipment, not a user's own profile picture. Staff-only, mirroring
--  052's is_staff() gate on the equipos table itself (not scoped to
--  whoever uploaded it, since equipos is shared equally by every
--  admin/técnico).
--  Run after 001-052.
-- ============================================================

alter table public.equipos
  add column if not exists photo_path text;

insert into storage.buckets (id, name, public)
values ('equipo-photos', 'equipo-photos', false)
on conflict (id) do nothing;

create policy "equipo-photos: staff select" on storage.objects
  for select using (bucket_id = 'equipo-photos' and public.is_staff());

create policy "equipo-photos: staff insert" on storage.objects
  for insert with check (bucket_id = 'equipo-photos' and public.is_staff());

create policy "equipo-photos: staff update" on storage.objects
  for update using (bucket_id = 'equipo-photos' and public.is_staff());

create policy "equipo-photos: staff delete" on storage.objects
  for delete using (bucket_id = 'equipo-photos' and public.is_staff());
