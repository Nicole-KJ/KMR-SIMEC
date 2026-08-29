-- ============================================================
--  SIMEC Service Reports – Public read of company branding
--  Run after 001-020. See CLAUDE.md section 4 for the RLS/RPC
--  conventions this follows.
-- ============================================================

-- ─── PUBLIC BRANDING RPC ─────────────────────────────────────────
-- company_settings (020) is admin-only, by design -- but the branding it
-- holds now needs to show up on Login (no session at all) and in the nav
-- bar for "cliente" sessions (not admin). Rather than loosen the table's
-- RLS, follow the same pattern as get_report_for_signature (003): a
-- narrow SECURITY DEFINER RPC that exposes only these fields. All of them
-- are the business's own public-facing contact/branding info, not
-- sensitive, so anon + authenticated both get EXECUTE.
create or replace function public.get_company_branding()
returns table (
  company_name text,
  company_emails text,
  address text,
  phone text,
  website text,
  logo_storage_path text
)
language sql
security definer
set search_path = public
as $$
  select company_name, company_emails, address, phone, website, logo_storage_path
  from public.company_settings
  where id = true;
$$;

revoke execute on function public.get_company_branding() from public;
grant execute on function public.get_company_branding() to anon, authenticated;
