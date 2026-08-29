-- ============================================================
--  SIMEC Service Reports – Remove Inventario de Equipos
--  Business decision: this feature (a persistent equipment registry
--  separate from any one report, added in 052/053/054) is not going
--  to be used. Reverses it completely -- tables, storage bucket, and
--  the two role-check helpers that existed only to gate it.
--
--  is_staff()/is_client() are dropped last, after everything that
--  references them (confirmed here to be exactly the equipos/
--  equipo_clients/equipo-photos policies below and nothing else --
--  see supabase/setup/001_full_schema.sql for the full policy list).
--
--  No storage.objects rows or equipos/equipo_clients rows existed on
--  this project at the time this was written (verified before
--  writing this migration).
--
--  The equipo-photos BUCKET ITSELF is not dropped here -- Supabase's
--  storage.protect_delete() trigger blocks direct SQL DELETEs on
--  storage.buckets/storage.objects ("Use the Storage API instead").
--  Its access policies are dropped below (so nothing can read/write
--  it going forward); removing the now-inert empty bucket row itself
--  needs Dashboard -> Storage -> equipo-photos -> Delete bucket, or
--  the Storage API, done by hand once per project.
--  Run after 001-055.
-- ============================================================

-- ─── STORAGE: equipo-photos ─────────────────────────────────────
drop policy if exists "equipo-photos: staff select" on storage.objects;
drop policy if exists "equipo-photos: staff insert" on storage.objects;
drop policy if exists "equipo-photos: staff update" on storage.objects;
drop policy if exists "equipo-photos: staff delete" on storage.objects;
drop policy if exists "equipo-photos: client select own" on storage.objects;
drop policy if exists "equipo-photos: client insert own" on storage.objects;

-- ─── TABLES: equipo_clients, equipos ─────────────────────────────
-- RLS policies on both tables are dropped automatically along with
-- the tables themselves. CASCADE on equipo_clients also takes
-- "equipos: client select own" with it (equipos' own policy that
-- subqueries equipo_clients) -- the equipos table it lived on is
-- dropped right after anyway.
drop table if exists public.equipo_clients cascade;
drop table if exists public.equipos cascade;

-- ─── HELPERS: only ever used by the policies/tables above ───────
drop function if exists public.is_staff();
drop function if exists public.is_client();
