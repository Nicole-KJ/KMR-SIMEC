-- ============================================================
--  SIMEC Service Reports – Nuevo Evento: auto-coded, status-tiered required fields
--  1) Código del Evento is now auto-generated (get_next_event_code(),
--     called by the client the moment Nuevo Evento opens) and unique --
--     never hand-typed. A plain sequence, not report_number-style
--     identity-on-insert, since the UI needs to show the code *before*
--     the row exists.
--  2) Mandatory-field rules are now tiered by status: Pendiente only
--     needs event_name/event_date/event_time/client_name/
--     client_address/client_email; técnico is only required once the
--     event moves to en_progreso or beyond (enforced app-side in
--     NewEvento.jsx). service_type and technician_id were NOT NULL at
--     the DB level, which would have silently overridden that -- both
--     dropped to nullable so an honestly-optional-for-Pendiente field
--     actually is. equipment_type/client_phone were already nullable.
--     service_type's existing CHECK doesn't need touching: a NULL
--     value satisfies a CHECK constraint in Postgres regardless (only
--     an explicit FALSE fails it).
--  Run after 001-047.
-- ============================================================

create sequence if not exists public.service_event_code_seq;

create or replace function public.get_next_event_code()
returns text
language sql
security definer
set search_path to 'public'
as $$
  select 'EVT-' || lpad(nextval('public.service_event_code_seq')::text, 4, '0');
$$;

grant execute on function public.get_next_event_code() to authenticated;

alter table public.service_events
  add constraint service_events_event_code_unique unique (event_code);

alter table public.service_events
  alter column service_type drop not null,
  alter column technician_id drop not null;

drop policy if exists "events: insert" on public.service_events;
create policy "events: insert" on public.service_events
  for insert with check (
    created_by = auth.uid()
    and (technician_id = auth.uid() or technician_id is null or public.is_admin())
  );
