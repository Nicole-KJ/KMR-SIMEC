-- ============================================================
--  SIMEC Service Reports – Almacenamiento: exact row counts
--  045's get_database_table_sizes() used pg_class.reltuples, which is
--  only an ANALYZE-time estimate (shows -1 for a table that's never
--  been analyzed, and was off even for service_reports: 2 instead of
--  17). Switched to a real count(*) per table via dynamic SQL --
--  table counts here are small (this app's own tables), so the cost
--  of an exact count is a non-issue.
--  Run after 001-045.
-- ============================================================

-- CREATE OR REPLACE can't change a function's return signature (row_estimate
-- -> row_count is more honest now that it's an exact count, not an
-- ANALYZE-time estimate) -- drop first.
drop function if exists public.get_database_table_sizes();

create function public.get_database_table_sizes()
returns table (table_name text, row_count bigint, table_bytes bigint)
language plpgsql
stable security definer
set search_path to 'public'
as $$
declare
  r record;
begin
  if not public.is_admin() then
    return;
  end if;

  for r in
    select c.relname as tbl, c.oid
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
  loop
    return query execute format(
      'select %L::text, count(*)::bigint, pg_total_relation_size(%L)::bigint from public.%I',
      r.tbl, r.tbl, r.tbl
    );
  end loop;
end;
$$;

grant execute on function public.get_database_table_sizes() to authenticated;
