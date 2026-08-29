-- ============================================================
--  SIMEC Service Reports – Unlinked clients visible to their own técnico
--  Backs ClienteDetail.jsx's "Editar" affordance for clients that
--  aren't vinculado al portal: a técnico can only ever read/edit their
--  own reports (RLS), so they need to see their own unlinked clients too,
--  not just admins seeing every technician's.
--  Run after 001-025.
-- ============================================================

create or replace function public.get_unlinked_report_clients()
returns table (client_name text, client_email text, client_address text)
language sql
security definer
set search_path = public
as $$
  select distinct on (lower(trim(sr.client_name)))
    sr.client_name, sr.client_email, sr.client_address
  from public.service_reports sr
  where (public.is_admin() or sr.technician_id = auth.uid())
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
