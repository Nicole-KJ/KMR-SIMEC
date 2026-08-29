-- ============================================================
--  SIMEC Service Reports – Nuevo/Editar Reporte: full client picker
--  "Cliente registrado (opcional)" used to only offer portal-linked
--  clients (get_clients, id + full_name only). Now offers every known
--  client -- linked (profiles) and unlinked (distinct free-text names
--  off past reports, same as get_unlinked_report_clients) -- with
--  enough fields (address/phone/email) for NewReport.jsx to autofill
--  Datos del Cliente on selection. A separate function from those two
--  rather than a replacement -- Clientes.jsx/ClienteDetail.jsx still
--  use the originals for their own linked-vs-unlinked management UI.
--  Linked half is unscoped (any staff member can link a report to any
--  registered client, same as get_clients always allowed); unlinked
--  half stays scoped to the caller's own reports (is_report_technician)
--  or everything if admin, same privacy scoping get_unlinked_report_
--  clients already had.
--  Run after 001-050.
-- ============================================================

create or replace function public.get_all_report_clients()
returns table (client_user_id uuid, full_name text, address text, phone text, email text)
language sql
security definer
set search_path to 'public'
as $$
  select p.id as client_user_id, p.full_name, p.address, p.phone, p.contact_email as email
  from public.profiles p
  where p.role = 'cliente'

  union all

  select null::uuid as client_user_id, u.client_name as full_name, u.client_address as address, u.client_phone as phone, u.client_email as email
  from (
    select distinct on (lower(trim(sr.client_name)))
      sr.client_name, sr.client_email, sr.client_address, sr.client_phone
    from public.service_reports sr
    where public.is_report_technician(sr.id)
      and sr.client_user_id is null
      and sr.client_name is not null
      and trim(sr.client_name) <> ''
      and lower(trim(sr.client_name)) not in (
        select lower(trim(p.full_name))
        from public.profiles p
        where p.role = 'cliente' and p.full_name is not null
      )
    order by lower(trim(sr.client_name)), sr.created_at desc
  ) u

  order by full_name;
$$;

grant execute on function public.get_all_report_clients() to authenticated;
