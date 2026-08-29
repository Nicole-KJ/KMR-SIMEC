-- Any authenticated user needs to see the list of technicians (id, full_name)
-- to populate the "Nombre del técnico" dropdown when creating a report.
-- Existing RLS on profiles only allows reading your own row (or all rows if
-- admin), so this narrow SECURITY DEFINER RPC exposes just the two columns
-- needed, for role = 'tecnico' rows only — same pattern as
-- get_report_for_signature / sign_report in 003_storage_and_public_signature.sql.
create or replace function public.get_technicians()
returns table (id uuid, full_name text)
language sql
security definer
set search_path = public
as $$
  select id, full_name
  from public.profiles
  where role = 'tecnico'
  order by full_name;
$$;

grant execute on function public.get_technicians() to authenticated;
