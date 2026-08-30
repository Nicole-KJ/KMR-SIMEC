-- ============================================================
--  SIMEC Service Reports – Eventos support more than one técnico
--  service_events (035) only ever had a single technician_id/
--  technician_name pair -- same limitation service_reports had before
--  report_technicians (001/027) split the roster out into its own
--  table. Same fix here: a new event_technicians join table replaces
--  the scalar columns entirely, so an event's técnicos are a proper
--  add/remove list, all equal (no "primary" técnico) -- same shape
--  Nuevo Reporte's own Técnicos section already has.
--
--  is_event_staff() is the events equivalent of is_report_technician()
--  (027): true for the event's creator, an admin, or anyone listed on
--  it -- used for every service_events/event_technicians policy below,
--  same "who can touch this" pattern as reports. Events have no
--  signed-lock concept, so unlike reports there's no separate
--  can_edit_* variant -- "can see it" and "can edit it" are the same
--  check.
--
--  get_unlinked_report_clients()/get_all_report_clients() (058) also
--  get updated here -- their service_events branch inlined the old
--  "technician_id = auth.uid() or created_by = auth.uid() or is_admin()"
--  check, which no longer compiles once technician_id is dropped.
--  Run after 001-058.
-- ============================================================

-- ─── EVENT_TECHNICIANS ────────────────────────────────────────────
create table if not exists public.event_technicians (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references public.service_events(id) on delete cascade,
  technician_id   uuid references public.profiles(id),
  technician_name text
);

create index if not exists event_technicians_event_idx on public.event_technicians (event_id);

-- Backfill: carry each event's existing single técnico over as its first
-- (and so far only) event_technicians row before the source columns go away.
insert into public.event_technicians (event_id, technician_id, technician_name)
select id, technician_id, technician_name
from public.service_events
where technician_id is not null;

-- ─── is_event_staff() ───────────────────────────────────────────────
create or replace function public.is_event_staff(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.service_events se
    where se.id = p_event_id
      and (
        se.created_by = auth.uid()
        or public.is_admin()
        or exists (
          select 1 from public.event_technicians et
          where et.event_id = se.id and et.technician_id = auth.uid()
        )
      )
  );
$$;

revoke execute on function public.is_event_staff(uuid) from public;
grant execute on function public.is_event_staff(uuid) to authenticated;

-- ─── service_events: replace technician_id-keyed policies ──────────
drop policy if exists "events: select" on public.service_events;
create policy "events: select" on public.service_events
  for select using (public.is_event_staff(id));

-- Plain, direct column comparison alongside the policy above -- needed
-- because is_event_staff() re-queries service_events by id, and that
-- nested scan's snapshot can't see a row this same INSERT statement is
-- still in the middle of writing (discovered as a genuine "new row
-- violates row-level security policy" failure the moment a técnico tried
-- creating their first event: the INSERT itself succeeded, but its own
-- RETURNING failed the SELECT-back check). Evaluating directly against
-- the tuple in hand has no such visibility problem -- same reason
-- service_reports' own "reports: own read" (auth.uid() = technician_id)
-- policy is a plain comparison rather than a function call.
create policy "events: select own" on public.service_events
  for select using (created_by = auth.uid());

-- Técnicos are added via event_technicians right after creation (same
-- create-row-then-insert-roster order as service_reports/report_technicians)
-- -- this only ever needs to gate the event row itself.
drop policy if exists "events: insert" on public.service_events;
create policy "events: insert" on public.service_events
  for insert with check (created_by = auth.uid());

drop policy if exists "events: update" on public.service_events;
create policy "events: update" on public.service_events
  for update using (public.is_event_staff(id)) with check (public.is_event_staff(id));

drop policy if exists "events: delete" on public.service_events;
create policy "events: delete" on public.service_events
  for delete using (public.is_event_staff(id));

-- ─── event_technicians policies ─────────────────────────────────────
alter table public.event_technicians enable row level security;

create policy "event_technicians: select" on public.event_technicians
  for select using (public.is_event_staff(event_id));
create policy "event_technicians: insert" on public.event_technicians
  for insert with check (public.is_event_staff(event_id));
create policy "event_technicians: update" on public.event_technicians
  for update using (public.is_event_staff(event_id));
create policy "event_technicians: delete" on public.event_technicians
  for delete using (public.is_event_staff(event_id));

-- ─── Drop the now-superseded scalar columns ──────────────────────────
alter table public.service_events
  drop column if exists technician_id,
  drop column if exists technician_name;

-- ─── get_unlinked_report_clients() / get_all_report_clients() (058) ──
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
    where public.is_event_staff(se.id)
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
      where public.is_event_staff(se.id)
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
