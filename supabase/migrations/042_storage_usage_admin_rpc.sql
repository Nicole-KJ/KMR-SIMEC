-- ============================================================
--  SIMEC Service Reports – Almacenamiento (Configuración page)
--  Admin wants to keep an eye on Storage usage (Supabase free plan --
--  a fixed, fairly small cap, unlike Pro's pay-as-you-go). Storage
--  size lives in storage.objects.metadata->>'size', a schema/table
--  RLS can't reach from the browser client (storage.objects isn't in
--  the exposed API schemas, and even if it were, per-bucket storage
--  policies don't grant a blanket read across every bucket -- see
--  041's notes on the same gap for delete). A narrow SECURITY
--  DEFINER RPC, same pattern as get_report_for_signature (003),
--  is_admin() etc., is the established way around that: admin-gated
--  internally, callable directly from the browser via .rpc(), no
--  edge function needed since this is a read-only aggregate.
--  Run after 001-041.
-- ============================================================

create or replace function public.get_storage_usage()
returns table (bucket_id text, file_count bigint, total_bytes bigint)
language sql
stable security definer
set search_path to 'public'
as $$
  select bucket_id, count(*) as file_count, coalesce(sum((metadata->>'size')::bigint), 0) as total_bytes
  from storage.objects
  where public.is_admin()
  group by bucket_id
  order by total_bytes desc;
$$;

grant execute on function public.get_storage_usage() to authenticated;
