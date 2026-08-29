-- ============================================================
--  SIMEC Service Reports – Almacenamiento: database usage
--  Storage (042) only covers files (photos/PDFs/signatures). The other
--  thing that can hit a plan limit is the Postgres database itself
--  (report rows, equipment_data JSON, etc.) -- admin wants both
--  visible together so they can tell what to delete when either one
--  gets close to a cap. Same narrow SECURITY DEFINER RPC pattern as
--  get_storage_usage/get_report_pdf_stats.
--  Run after 001-044.
-- ============================================================

-- Whole-database size (every schema -- this is what actually counts
-- against the project's Database plan limit, not just `public`).
create or replace function public.get_database_size()
returns table (total_bytes bigint)
language sql
stable security definer
set search_path to 'public'
as $$
  select pg_database_size(current_database()) as total_bytes
  where public.is_admin();
$$;

-- Per-table breakdown of this app's own tables (public schema only) --
-- this is the "what's actually using the space, and what can I delete"
-- view; system/auth/storage-internal tables aren't actionable from here.
create or replace function public.get_database_table_sizes()
returns table (table_name text, row_estimate bigint, table_bytes bigint)
language sql
stable security definer
set search_path to 'public'
as $$
  select c.relname as table_name, c.reltuples::bigint as row_estimate, pg_total_relation_size(c.oid) as table_bytes
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and public.is_admin()
  order by table_bytes desc;
$$;

grant execute on function public.get_database_size() to authenticated;
grant execute on function public.get_database_table_sizes() to authenticated;
