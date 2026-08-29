-- ============================================================
--  SIMEC Service Reports – Roles & authorization (RBAC)
--  Run after 001-003. See CLAUDE.md section 4 for the RLS
--  conventions this follows.
-- ============================================================

-- ─── ROLE COLUMN ────────────────────────────────────────────────
alter table public.profiles
  add column if not exists role text not null default 'tecnico'
    check (role in ('admin', 'tecnico'));

-- ─── ROLE-CHECK HELPER ──────────────────────────────────────────
-- SECURITY DEFINER so it can read the caller's own profiles row without
-- depending on (and recursing through) the RLS policies below.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

grant execute on function public.is_admin() to authenticated;

-- ─── ADMIN: VIEW EVERY REPORT / DELETE REPORTS ─────────────────
-- Additive to the existing "own read"/"own insert"/"own update" policies
-- from 001 — Postgres RLS policies are OR'd together, so this only widens
-- access for admins without touching the technician-scoped ones.
create policy "reports: admin read all" on public.service_reports
  for select using (public.is_admin());

create policy "reports: admin delete all" on public.service_reports
  for delete using (public.is_admin());

-- ─── TECHNICIAN: EDIT OWN REPORTS, BUT NOT ONCE SIGNED ──────────
-- Replaces the original "reports: own update" policy (001) with the same
-- rule plus a status check. A signed report is a finalized, client-facing
-- record — locking it here is enforced at the DB layer, not just hidden in
-- the UI, since the UI alone can't stop a direct API call.
drop policy if exists "reports: own update" on public.service_reports;

create policy "reports: own update" on public.service_reports
  for update
  using (auth.uid() = technician_id and status <> 'signed')
  with check (auth.uid() = technician_id);

-- ─── ADMIN: MANAGE USERS ────────────────────────────────────────
-- Lets an admin list/change roles for any profile via a normal RLS-guarded
-- table update (see setUserRole in supabaseDB.js). Reading other users'
-- emails and inviting/disabling accounts still requires the service_role
-- key (auth.users isn't reachable from the client at all) — that part goes
-- through the admin-users Edge Function instead.
create policy "profiles: admin read all" on public.profiles
  for select using (public.is_admin());

create policy "profiles: admin update all" on public.profiles
  for update using (public.is_admin()) with check (public.is_admin());
