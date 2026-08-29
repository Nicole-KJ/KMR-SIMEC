-- ============================================================
--  SIMEC Service Reports – Inventario de Equipos
--  A persistent registry of physical equipment (UPS, Aires de Precisión y
--  Aires Confort, Generador, Batería, ATS, Tablero Eléctrico) that exists
--  independently of any one report -- unlike service_reports.equipment_data
--  (002, a per-visit snapshot), this is the equipment's own identity:
--  brand/model/serial/asset number plus the same equipmentInfoFields
--  captured on the report form (see src/constants/equipmentModules),
--  deliberately without location -- a piece of equipment can move between
--  sites, so it isn't part of its identity here.
--
--  equipo_clients is a many-to-many join: the same physical equipo can
--  serve more than one client (shared/leased equipment, or a site with
--  more than one billing entity), same free-text-name-plus-optional-
--  portal-link pattern already used by service_reports/service_events'
--  client fields (015/035).
--
--  Shared equally by every admin/técnico rather than owned by whoever
--  created it (unlike service_events, which is técnico-scoped) -- the
--  first table that needs that, hence the new is_staff() helper
--  alongside the existing is_admin() (004).
--  Run after 001-051.
-- ============================================================

-- ─── STAFF-CHECK HELPER (admin OR técnico) ─────────────────────
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role in ('admin', 'tecnico')
  );
$$;

grant execute on function public.is_staff() to authenticated;

-- ─── EQUIPOS ────────────────────────────────────────────────────
create table if not exists public.equipos (
  id              uuid primary key default gen_random_uuid(),
  equipment_type  text not null check (equipment_type in ('ups','ac','generador','bateria','ats','tablero')),
  brand           text,
  model           text,
  serial_number   text,
  asset_number    text,
  equipment_data  jsonb not null default '{}',
  notes           text,
  created_by      uuid not null references public.profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on column public.equipos.equipment_data is
  'JSONB column storing the type-specific identity fields (equipmentInfoFields) for this equipo. Structure varies by equipment_type, same convention as service_reports.equipment_data (002).';

-- Dedup key: same type + serial number (case/whitespace-insensitive) is
-- the same physical unit. This is the real enforcement behind
-- equiposService.findEquipoBySerial's client-side check, which offers
-- linking the existing row to an extra client instead of surfacing a raw
-- constraint-violation error. No-op for blank serials -- nothing reliable
-- to dedup on without one.
create unique index if not exists equipos_type_serial_unique
  on public.equipos (equipment_type, lower(trim(serial_number)))
  where serial_number is not null and trim(serial_number) <> '';

create index if not exists equipos_type_idx on public.equipos (equipment_type);

alter table public.equipos enable row level security;

create policy "equipos: staff select" on public.equipos
  for select using (public.is_staff());

create policy "equipos: staff insert" on public.equipos
  for insert with check (public.is_staff() and created_by = auth.uid());

create policy "equipos: staff update" on public.equipos
  for update using (public.is_staff()) with check (public.is_staff());

-- Deleting a whole equipo (vs. just unlinking a client) is admin-only --
-- more destructive than anything else on this table, same conservative
-- default as banning a portal client (Clientes.jsx/clientUsersService).
create policy "equipos: admin delete" on public.equipos
  for delete using (public.is_admin());

-- ─── EQUIPO_CLIENTS (many-to-many) ─────────────────────────────
create table if not exists public.equipo_clients (
  id              uuid primary key default gen_random_uuid(),
  equipo_id       uuid not null references public.equipos(id) on delete cascade,
  client_user_id  uuid references public.profiles(id),
  client_name     text not null,
  created_by      uuid not null references public.profiles(id),
  created_at      timestamptz not null default now()
);

-- Same link twice is a harmless no-op from the UI's point of view (e.g.
-- re-picking an already-linked client) -- these let equiposService.linkClients
-- swallow the resulting unique_violation instead of erroring.
create unique index if not exists equipo_clients_linked_unique
  on public.equipo_clients (equipo_id, client_user_id)
  where client_user_id is not null;

create unique index if not exists equipo_clients_unlinked_unique
  on public.equipo_clients (equipo_id, lower(trim(client_name)))
  where client_user_id is null;

create index if not exists equipo_clients_equipo_idx on public.equipo_clients (equipo_id);

alter table public.equipo_clients enable row level security;

create policy "equipo_clients: staff select" on public.equipo_clients
  for select using (public.is_staff());

create policy "equipo_clients: staff insert" on public.equipo_clients
  for insert with check (public.is_staff() and created_by = auth.uid());

-- Unlinking a client is low-risk/reversible (the client can always be
-- re-added), so técnico gets this too, unlike deleting the equipo itself.
create policy "equipo_clients: staff delete" on public.equipo_clients
  for delete using (public.is_staff());
