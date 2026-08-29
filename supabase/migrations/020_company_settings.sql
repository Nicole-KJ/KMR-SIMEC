-- ============================================================
--  SIMEC Service Reports – Company settings (app branding)
--  Backs "Personalizar mis Reportes" on the Personalización page.
--  Run after 001-019. See CLAUDE.md section 4 for the RLS/storage
--  conventions this follows.
-- ============================================================

-- ─── SINGLETON SETTINGS ROW ─────────────────────────────────────
-- One row for the whole app (not per-technician, not per-client) --
-- the boolean primary key locked to `true` is a standard Postgres
-- trick to make a second row physically impossible to insert.
create table public.company_settings (
  id              boolean primary key default true check (id),
  company_name    text,
  company_emails  text,
  address         text,
  phone           text,
  website         text,
  logo_storage_path text,
  updated_at      timestamptz not null default now(),
  updated_by      uuid references public.profiles(id)
);

alter table public.company_settings enable row level security;

-- Admin-only in both directions -- this isn't rendered anywhere a
-- non-admin session can reach yet (see AppCustomization.jsx), and
-- keeping it admin-only by default means a future public-facing use
-- (e.g. showing the logo on /firma/:reportId) has to be an explicit,
-- narrow addition rather than a default-open table.
create policy "company_settings: admin read" on public.company_settings
  for select using (public.is_admin());

create policy "company_settings: admin insert" on public.company_settings
  for insert with check (public.is_admin());

create policy "company_settings: admin update" on public.company_settings
  for update using (public.is_admin()) with check (public.is_admin());

-- ─── LOGO STORAGE ────────────────────────────────────────────────
-- Public read (it's a logo, not sensitive -- same call as the
-- avatars bucket in 005), admin-only write.
insert into storage.buckets (id, name, public)
values ('company-logo', 'company-logo', true)
on conflict (id) do nothing;

create policy "company-logo: public read" on storage.objects
  for select using (bucket_id = 'company-logo');

create policy "company-logo: admin insert" on storage.objects
  for insert with check (bucket_id = 'company-logo' and public.is_admin());

create policy "company-logo: admin update" on storage.objects
  for update using (bucket_id = 'company-logo' and public.is_admin());

create policy "company-logo: admin delete" on storage.objects
  for delete using (bucket_id = 'company-logo' and public.is_admin());
