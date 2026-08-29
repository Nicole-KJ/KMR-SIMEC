-- ============================================================
--  SIMEC Service Reports – Inventario de Equipos: client self-service
--  Lets a "cliente" (015) register their own equipment ("Mis Equipos")
--  and see only equipos they created or are linked to -- mirrors the
--  client_user_id read/write split 015 set up for service_reports, adapted
--  to equipos' many-to-many equipo_clients join (052) instead of a direct
--  column.
--  A client can edit/attach a photo to only the equipos *they* created,
--  never someone else's, and never gets the admin-only delete (052). They
--  can only ever link *themselves* on equipo_clients, never another client.
--  Run after 001-053.
-- ============================================================

-- ─── CLIENT-CHECK HELPER ────────────────────────────────────────
create or replace function public.is_client()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'cliente'
  );
$$;

grant execute on function public.is_client() to authenticated;

-- ─── EQUIPOS: CLIENT READ/WRITE OWN ─────────────────────────────
-- Each policy is dropped first (015's convention) so this file can be
-- re-run safely -- unlike `create or replace function` above, Postgres has
-- no `create or replace policy`.
-- created_by = auth.uid() is what makes createEquipo's `.insert().select()`
-- work at all: at the instant of insert there's no equipo_clients row yet
-- (linkClients only runs right after, once the id comes back), so without
-- this branch a client couldn't see the row they just made and Postgres
-- would reject the RETURNING with the same "violates row-level security
-- policy" error as a rejected insert, even though the insert itself was
-- allowed.
drop policy if exists "equipos: client select own" on public.equipos;
create policy "equipos: client select own" on public.equipos
  for select using (
    created_by = auth.uid()
    or exists (
      select 1 from public.equipo_clients ec
      where ec.equipo_id = equipos.id and ec.client_user_id = auth.uid()
    )
  );

-- A client registers their own equipo unlinked (created_by = auth.uid());
-- the matching equipo_clients row (inserted right after, same request) is
-- what actually links it to them -- see "equipo_clients: client insert own"
-- below.
drop policy if exists "equipos: client insert own" on public.equipos;
create policy "equipos: client insert own" on public.equipos
  for insert with check (public.is_client() and created_by = auth.uid());

-- Update stays scoped to rows the client themselves created -- needed for
-- uploadEquipoPhoto's photo_path write right after insert (equiposService.js),
-- and incidentally lets them fix their own equipo's details afterwards too.
-- No client delete policy -- removing an equipo entirely stays admin-only (052).
drop policy if exists "equipos: client update own" on public.equipos;
create policy "equipos: client update own" on public.equipos
  for update using (public.is_client() and created_by = auth.uid())
  with check (public.is_client() and created_by = auth.uid());

-- ─── EQUIPO_CLIENTS: CLIENT READ/WRITE OWN LINK ─────────────────
drop policy if exists "equipo_clients: client select own" on public.equipo_clients;
create policy "equipo_clients: client select own" on public.equipo_clients
  for select using (client_user_id = auth.uid());

-- with check pins both client_user_id AND created_by to auth.uid(), so a
-- client can only ever link themselves -- never another client, and never
-- as someone else's created_by.
drop policy if exists "equipo_clients: client insert own" on public.equipo_clients;
create policy "equipo_clients: client insert own" on public.equipo_clients
  for insert with check (
    public.is_client() and client_user_id = auth.uid() and created_by = auth.uid()
  );

-- ─── equipo-photos: CLIENT READ/WRITE OWN (053) ─────────────────
-- Path is `${equipo_id}/photo.<ext>` (053); same storage.foldername
-- via-parent-row pattern as report-photos (015).
drop policy if exists "equipo-photos: client select own" on storage.objects;
create policy "equipo-photos: client select own" on storage.objects
  for select using (
    bucket_id = 'equipo-photos' and exists (
      select 1 from public.equipo_clients ec
      where ec.equipo_id::text = (storage.foldername(name))[1] and ec.client_user_id = auth.uid()
    )
  );

drop policy if exists "equipo-photos: client insert own" on storage.objects;
create policy "equipo-photos: client insert own" on storage.objects
  for insert with check (
    bucket_id = 'equipo-photos' and exists (
      select 1 from public.equipos eq
      where eq.id::text = (storage.foldername(name))[1] and eq.created_by = auth.uid()
    )
  );
