-- ============================================================
--  SIMEC Service Reports – Unlinked client directory now includes Eventos
--  get_unlinked_report_clients() (023, last touched 027) and
--  get_all_report_clients() (051) both only ever drew their "unlinked"
--  half (a client typed free-text, never picked via a portal account)
--  from service_reports -- a client entered only on an Evento (035)
--  never showed up in Clientes.jsx's "Todos los clientes" table, nor
--  as an autofill option in the "Cliente registrado" dropdown on
--  either Nuevo Reporte or Nuevo Evento.
--
--  Both now pull from a UNION of service_reports and service_events,
--  deduplicated the same case/whitespace-insensitive way as before
--  (lower(trim(client_name))), keeping whichever row is most recent
--  when the same client name appears in both.
--
--  service_events has no is_report_technician()-equivalent helper --
--  inlined the same visibility rule as "events: select" (035) instead:
--  technician_id = auth.uid(), created_by = auth.uid(), or admin.
--  Run after 001-057.
-- ============================================================

create or replace function public.get_unlinked_report_clients()
returns table (client_name text, client_email text, client_address text)
language sql
security definer
set search_path = public
as $$
  select distinct on (lower(trim(client_name)))
    client_name, client_email, client_address
  from (
    select sr.client_name, sr.client_email, sr.client_address, sr.created_at
    from public.service_reports sr
    where public.is_report_technician(sr.id)
      and sr.client_user_id is null
      and sr.client_name is not null
      and trim(sr.client_name) <> ''

    union all

    select se.client_name, se.client_email, se.client_address, se.created_at
    from public.service_events se
    where (se.technician_id = auth.uid() or se.created_by = auth.uid() or public.is_admin())
      and se.client_user_id is null
      and se.client_name is not null
      and trim(se.client_name) <> ''
  ) combined
  where lower(trim(client_name)) not in (
    select lower(trim(p.full_name))
    from public.profiles p
    where p.role = 'cliente' and p.full_name is not null
  )
  order by lower(trim(client_name)), created_at desc;
$$;

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
    select distinct on (lower(trim(client_name)))
      client_name, client_email, client_address, client_phone
    from (
      select sr.client_name, sr.client_email, sr.client_address, sr.client_phone, sr.created_at
      from public.service_reports sr
      where public.is_report_technician(sr.id)
        and sr.client_user_id is null
        and sr.client_name is not null
        and trim(sr.client_name) <> ''

      union all

      select se.client_name, se.client_email, se.client_address, se.client_phone, se.created_at
      from public.service_events se
      where (se.technician_id = auth.uid() or se.created_by = auth.uid() or public.is_admin())
        and se.client_user_id is null
        and se.client_name is not null
        and trim(se.client_name) <> ''
    ) combined
    where lower(trim(client_name)) not in (
      select lower(trim(p.full_name))
      from public.profiles p
      where p.role = 'cliente' and p.full_name is not null
    )
    order by lower(trim(client_name)), created_at desc
  ) u

  order by full_name;
$$;
