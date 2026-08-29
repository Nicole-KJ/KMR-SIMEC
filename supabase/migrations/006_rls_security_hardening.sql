-- ============================================================
--  SIMEC Service Reports – RLS security hardening
--  Run after 001-005. Fixes found in a manual audit + `supabase
--  db advisors --linked --type security`. See findings below.
-- ============================================================

-- ─── FIX 1 (CRITICAL): SELF ROLE ESCALATION ────────────────────
-- "profiles: own update" (001) has no WITH CHECK, so it defaults to the
-- USING clause (auth.uid() = id) — meaning any technician can
-- PATCH /rest/v1/profiles?id=eq.<self> with {"role":"admin"} directly and
-- self-promote. The app UI never exposes this, but RLS is the real
-- boundary; a direct API call bypasses the UI entirely.
--
-- Fixed with a trigger rather than WITH CHECK because RLS operates on
-- whole rows, not columns: a technician legitimately needs to update their
-- own full_name/avatar_url in the same UPDATE that role must stay locked.
create or replace function public.prevent_self_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Solo un administrador puede cambiar el rol de un usuario';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_self_role_escalation on public.profiles;
create trigger profiles_prevent_self_role_escalation
  before update on public.profiles
  for each row execute procedure public.prevent_self_role_escalation();

-- ─── FIX 2: ADMIN COULDN'T SEE REPORT CHILDREN ─────────────────
-- "technicians/parts/photos: via report" (001) only grant the owning
-- technician access. Migration 004 gave admins SELECT on service_reports
-- itself, but not on these child tables — so getReport()'s embedded
-- technicians/parts/photos silently came back empty (RLS-filtered, no
-- error) when an admin opened another technician's report, breaking
-- "view every report" for anything beyond the top-level fields.
--
-- ─── FIX 3: SIGNED-LOCK DIDN'T REACH REPORT CHILDREN ───────────
-- Migration 004 blocks UPDATEs to service_reports once status = 'signed',
-- but report_technicians/report_parts/report_photos had no equivalent
-- check — a technician could still insert/update/delete a signed report's
-- technicians, parts, or photos via a direct API call, even though the
-- app's own edit screen won't let them.
--
-- Both fixed together by splitting each table's single "for all" policy
-- into an unrestricted-by-status SELECT (owner or admin) and a
-- status-restricted INSERT/UPDATE/DELETE (owner only, not signed).

drop policy if exists "technicians: via report" on public.report_technicians;
drop policy if exists "parts: via report" on public.report_parts;
drop policy if exists "photos: via report" on public.report_photos;

create policy "technicians: read via report" on public.report_technicians
  for select using (
    exists (select 1 from public.service_reports r where r.id = report_id
      and (r.technician_id = auth.uid() or public.is_admin()))
  );
create policy "technicians: insert via report" on public.report_technicians
  for insert with check (
    exists (select 1 from public.service_reports r where r.id = report_id
      and r.technician_id = auth.uid() and r.status <> 'signed')
  );
create policy "technicians: update via report" on public.report_technicians
  for update using (
    exists (select 1 from public.service_reports r where r.id = report_id
      and r.technician_id = auth.uid() and r.status <> 'signed')
  );
create policy "technicians: delete via report" on public.report_technicians
  for delete using (
    exists (select 1 from public.service_reports r where r.id = report_id
      and r.technician_id = auth.uid() and r.status <> 'signed')
  );

create policy "parts: read via report" on public.report_parts
  for select using (
    exists (select 1 from public.service_reports r where r.id = report_id
      and (r.technician_id = auth.uid() or public.is_admin()))
  );
create policy "parts: insert via report" on public.report_parts
  for insert with check (
    exists (select 1 from public.service_reports r where r.id = report_id
      and r.technician_id = auth.uid() and r.status <> 'signed')
  );
create policy "parts: update via report" on public.report_parts
  for update using (
    exists (select 1 from public.service_reports r where r.id = report_id
      and r.technician_id = auth.uid() and r.status <> 'signed')
  );
create policy "parts: delete via report" on public.report_parts
  for delete using (
    exists (select 1 from public.service_reports r where r.id = report_id
      and r.technician_id = auth.uid() and r.status <> 'signed')
  );

create policy "photos: read via report" on public.report_photos
  for select using (
    exists (select 1 from public.service_reports r where r.id = report_id
      and (r.technician_id = auth.uid() or public.is_admin()))
  );
create policy "photos: insert via report" on public.report_photos
  for insert with check (
    exists (select 1 from public.service_reports r where r.id = report_id
      and r.technician_id = auth.uid() and r.status <> 'signed')
  );
create policy "photos: delete via report" on public.report_photos
  for delete using (
    exists (select 1 from public.service_reports r where r.id = report_id
      and r.technician_id = auth.uid() and r.status <> 'signed')
  );

-- Same pair of problems (no admin access, no signed-lock), same fix, for
-- the report-photos Storage objects.
drop policy if exists "report-photos: technician manages own report's photos" on storage.objects;

create policy "report-photos: read via report" on storage.objects
  for select using (
    bucket_id = 'report-photos' and exists (
      select 1 from public.service_reports r
      where r.id::text = (storage.foldername(name))[1]
        and (r.technician_id = auth.uid() or public.is_admin())
    )
  );
create policy "report-photos: insert via report" on storage.objects
  for insert with check (
    bucket_id = 'report-photos' and exists (
      select 1 from public.service_reports r
      where r.id::text = (storage.foldername(name))[1]
        and r.technician_id = auth.uid() and r.status <> 'signed'
    )
  );
create policy "report-photos: delete via report" on storage.objects
  for delete using (
    bucket_id = 'report-photos' and exists (
      select 1 from public.service_reports r
      where r.id::text = (storage.foldername(name))[1]
        and r.technician_id = auth.uid() and r.status <> 'signed'
    )
  );

-- ─── FIX 4: CLIENTS TABLE WIDE OPEN, UNUSED BY THE APP ─────────
-- "clients: auth *" (001) let any authenticated technician read/write
-- every client record. Nothing in the app queries this table today —
-- tightened to admin-only least privilege rather than left exposed.
drop policy if exists "clients: auth read" on public.clients;
drop policy if exists "clients: auth insert" on public.clients;
drop policy if exists "clients: auth update" on public.clients;

create policy "clients: admin read" on public.clients
  for select using (public.is_admin());
create policy "clients: admin insert" on public.clients
  for insert with check (public.is_admin());
create policy "clients: admin update" on public.clients
  for update using (public.is_admin()) with check (public.is_admin());

-- ─── FIX 5: AVATARS "PUBLIC READ" POLICY ALLOWED LISTING ───────
-- Flagged by `supabase db advisors`: the bucket is already public=true, so
-- Storage serves individual objects via /storage/v1/object/public/... with
-- no RLS check needed. The SELECT policy was redundant for that and, as a
-- side effect, let anyone list every filename (i.e. every user id that has
-- an avatar) via the authenticated Storage list API.
drop policy if exists "avatars: public read" on storage.objects;

-- ─── FIX 6: SECURITY DEFINER FUNCTIONS RELIED ON POSTGRES' DEFAULT
--            PUBLIC EXECUTE GRANT INSTEAD OF AN EXPLICIT ONE ────
-- CREATE FUNCTION grants EXECUTE to PUBLIC (i.e. anon + authenticated) by
-- default unless revoked. is_admin()/get_report_for_signature()/
-- sign_report() are meant to be callable by anon and/or authenticated (the
-- public signature flow, and is_admin() being embedded in other tables'
-- RLS policies) — so the net access is unchanged, but it's now explicit
-- rather than an accidental default. handle_new_user() is a trigger-only
-- function that should never be callable directly at all; triggers fire
-- regardless of EXECUTE grants, so revoking PUBLIC access doesn't break it.
revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

revoke execute on function public.get_report_for_signature(uuid) from public;
grant execute on function public.get_report_for_signature(uuid) to anon, authenticated;

revoke execute on function public.sign_report(uuid, text, text, text) from public;
grant execute on function public.sign_report(uuid, text, text, text) to anon, authenticated;

revoke execute on function public.handle_new_user() from public;

-- ─── FIX 7: FUNCTIONS WITH A MUTABLE search_path ───────────────
-- Also flagged by the advisor: without a pinned search_path, a
-- SECURITY DEFINER function is vulnerable to search-path hijacking (a
-- lower-privileged user creates an object earlier in the search path that
-- shadows one the function relies on). Both predate this convention being
-- established in 003/004/005 for newer functions.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

create or replace function public.set_updated_at()
returns trigger language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
