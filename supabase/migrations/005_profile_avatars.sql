-- ============================================================
--  SIMEC Service Reports – Profile pictures
--  Run after 001-004.
-- ============================================================

alter table public.profiles
  add column if not exists avatar_url text;

-- ─── AVATARS BUCKET ─────────────────────────────────────────────
-- Public, unlike report-photos/report-photos RLS (D-6 in CLAUDE.md) — a
-- profile picture isn't sensitive business data, and making it public
-- avoids every avatar render needing a signed-URL round trip.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatars: public read" on storage.objects
  for select using (bucket_id = 'avatars');

-- Objects are stored as `${user_id}/avatar.<ext>` — a user manages only
-- their own folder, same convention as report-photos (D-5).
create policy "avatars: user manages own avatar" on storage.objects
  for all
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
