-- ============================================================
--  SIMEC Service Reports – Custom report accent color
--  Backs "Color de Reporte" on the Personalización page.
--  Run after 001-021.
-- ============================================================

alter table public.company_settings
  add column if not exists report_color text;

-- RETURNS TABLE column lists can't be changed by a plain CREATE OR REPLACE
-- (Postgres errors: "cannot change return type of existing function") --
-- drop and recreate instead, same as any other RETURNS TABLE signature change.
drop function if exists public.get_company_branding();

create function public.get_company_branding()
returns table (
  company_name text,
  company_emails text,
  address text,
  phone text,
  website text,
  logo_storage_path text,
  report_color text
)
language sql
security definer
set search_path = public
as $$
  select company_name, company_emails, address, phone, website, logo_storage_path, report_color
  from public.company_settings
  where id = true;
$$;

revoke execute on function public.get_company_branding() from public;
grant execute on function public.get_company_branding() to anon, authenticated;
