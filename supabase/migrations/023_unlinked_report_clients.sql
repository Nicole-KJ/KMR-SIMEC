-- ============================================================
--  SIMEC Service Reports – Clients that only exist as free text
--  Backs "Todos los clientes" including clients picked/typed on a
--  report without using the "Cliente registrado" portal-account link.
--  Run after 001-022.
-- ============================================================

-- ─── UNLINKED CLIENT DIRECTORY ───────────────────────────────────
-- service_reports.client_name/client_email/client_address are always
-- free text (see NewReport.jsx) -- client_user_id (015) only gets set
-- when the technician also picks a "Cliente registrado" account. This
-- returns the distinct clients that never got that link, so Clientes.jsx
-- can show them alongside real portal accounts with "Vinculado al
-- portal" = No.
--
-- Admin-only, same spirit as getAllReports(): this is a cross-technician
-- view of every client name ever entered, not just the caller's own
-- reports. Expressed as a WHERE-clause gate (returns zero rows for a
-- non-admin) rather than raising, so the page doesn't need special-case
-- error handling for a técnico viewing it.
--
-- Excludes any name that already matches a "cliente" portal account's
-- full_name (case/whitespace-insensitive) -- otherwise the same real
-- client could show up twice: once linked, once not, if a technician
-- ever typed their name free-text instead of picking them from the
-- dropdown on some report.
create or replace function public.get_unlinked_report_clients()
returns table (client_name text, client_email text, client_address text)
language sql
security definer
set search_path = public
as $$
  select distinct on (lower(trim(sr.client_name)))
    sr.client_name, sr.client_email, sr.client_address
  from public.service_reports sr
  where public.is_admin()
    and sr.client_user_id is null
    and sr.client_name is not null
    and trim(sr.client_name) <> ''
    and lower(trim(sr.client_name)) not in (
      select lower(trim(p.full_name))
      from public.profiles p
      where p.role = 'cliente' and p.full_name is not null
    )
  order by lower(trim(sr.client_name)), sr.created_at desc;
$$;

revoke execute on function public.get_unlinked_report_clients() from public;
grant execute on function public.get_unlinked_report_clients() to authenticated;
