-- ============================================================
--  SIMEC Service Reports – Eventos (scheduled visits)
--  A new, standalone table for visits scheduled ahead of time -- not
--  connected to service_reports yet (a report is still created
--  separately once the visit actually happens). Admin and técnico
--  only for now, same as most of the app; clients get no access at
--  all here.
--
--  Client fields mirror service_reports' pattern (free-text name/
--  address + optional client_user_id link to a portal account) for
--  consistency, but deliberately without equipment/service-type
--  fields -- those aren't usually known yet at scheduling time, and
--  can be added later if wanted.
--
--  A técnico can only ever schedule a visit for themself
--  (technician_id = auth.uid(), enforced by the insert/update WITH
--  CHECK below) -- same "no assigning someone else's work" rule as
--  NewReport.jsx's técnico dropdown (027). Admin can schedule for any
--  técnico (or themself).
--  Run after 001-034.
-- ============================================================

create table if not exists public.service_events (
  id              uuid primary key default gen_random_uuid(),
  event_date      date not null,
  event_time      time,
  client_name     text,
  client_address  text,
  client_user_id  uuid references public.profiles(id),
  technician_id   uuid not null references public.profiles(id),
  technician_name text,
  notes           text,
  status          text not null default 'programado'
                    check (status in ('programado', 'completado', 'cancelado')),
  created_by      uuid not null references public.profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists service_events_date_idx on public.service_events (event_date);

alter table public.service_events enable row level security;

create policy "events: select" on public.service_events
  for select using (
    technician_id = auth.uid() or created_by = auth.uid() or public.is_admin()
  );

create policy "events: insert" on public.service_events
  for insert with check (
    created_by = auth.uid()
    and (technician_id = auth.uid() or public.is_admin())
  );

create policy "events: update" on public.service_events
  for update
  using (technician_id = auth.uid() or created_by = auth.uid() or public.is_admin())
  with check (technician_id = auth.uid() or public.is_admin());

create policy "events: delete" on public.service_events
  for delete using (
    technician_id = auth.uid() or created_by = auth.uid() or public.is_admin()
  );
