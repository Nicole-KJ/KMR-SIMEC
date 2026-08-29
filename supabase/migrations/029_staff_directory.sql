-- ============================================================
--  SIMEC Service Reports – Staff directory for admin's "Nombre del técnico"
--  get_technicians() (013) only ever returns role = 'tecnico', which is
--  correct for a técnico filling out their own report, but an admin
--  needs to be able to list any admin or técnico (including themself) as
--  one of the técnicos who worked a job. Kept as its own narrow,
--  admin-gated RPC rather than widening get_technicians() itself, so a
--  técnico's dropdown never fetches (or could ever see) admin accounts.
--  Run after 001-028.
-- ============================================================

create or replace function public.get_staff_directory()
returns table (id uuid, full_name text, role text)
language sql
security definer
set search_path = public
as $$
  select id, full_name, role
  from public.profiles
  where public.is_admin() and role in ('tecnico', 'admin')
  order by full_name;
$$;

revoke execute on function public.get_staff_directory() from public;
grant execute on function public.get_staff_directory() to authenticated;
