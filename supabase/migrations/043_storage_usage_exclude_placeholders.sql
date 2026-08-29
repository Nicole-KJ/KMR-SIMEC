-- ============================================================
--  SIMEC Service Reports – Almacenamiento: exclude folder placeholders
--  Supabase Storage leaves a 0-byte ".emptyFolderPlaceholder" object
--  behind in a report's folder in some flows -- harmless (0 bytes) but
--  inflates get_storage_usage()'s file_count in a confusing way (e.g.
--  "9 PDFs de reportes" when only 1 report actually has a cached PDF).
--  Excluded from the count going forward; existing ones are orphaned
--  leftovers from reports deleted before deleteUserReports (041)
--  existed and are cleaned up separately, not by this migration.
--  Run after 001-042.
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
    and name not like '%.emptyFolderPlaceholder'
  group by bucket_id
  order by total_bytes desc;
$$;
