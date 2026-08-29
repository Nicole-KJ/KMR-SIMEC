-- ============================================================
--  SIMEC Service Reports – Consolidated baseline schema
--  Equivalent end-state of supabase/migrations/001_*.sql through
--  056_remove_inventario_equipos.sql, collapsed into ONE file so a
--  brand-new Supabase project can be bootstrapped in a single run
--  instead of applying all 56 migrations one by one.
--
--  USE THIS FILE ONLY ON A FRESH, EMPTY SUPABASE PROJECT.
--  Run it once in the SQL Editor (or `supabase db execute -f`).
--  Do NOT also run supabase/migrations/001-054 afterwards — this
--  file already contains their combined final effect.
--
--  The existing project this schema was extracted from keeps using
--  the numbered migrations in supabase/migrations/ as its real
--  history (already applied there, tracked in
--  supabase_migrations.schema_migrations) — this file is a snapshot
--  for a *different* Supabase account, not a replacement for that
--  history. Any future schema change should still be added as a new
--  numbered file in supabase/migrations/ for both projects.
--
--  Not covered here (do separately on the new project):
--    - Deploying the Edge Functions in supabase/functions/
--      (admin-users, client-users, send-report-email)
--    - Setting their secrets/env vars (e.g. RESEND_API_KEY)
--    - Creating the first admin user (sign up normally, then run
--      `update public.profiles set role = 'admin' where id = '<uuid>';`)
-- ============================================================

begin;

-- ============================================================
--  PART 1 — EXTENSIONS
-- ============================================================

create extension if not exists "pgcrypto";

-- ============================================================
--  PART 2 — TABLES
-- ============================================================

-- ─── PROFILES (extends auth.users) ────────────────────────────
create table if not exists public.profiles (
  id            uuid primary key references auth.users on delete cascade,
  full_name     text,
  phone         text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  role          text not null default 'tecnico'
                  -- No 'cliente' role in this deployment (055) -- admin/técnico only.
                  -- The client-portal schema below (client_user_id, "reports: client
                  -- read own", etc.) is kept but permanently unreachable rather than
                  -- ripped out.
                  constraint profiles_role_check check (role in ('admin', 'tecnico')),
  avatar_url    text,
  address       text,
  contact_email text
);

-- ─── CLIENTS (legacy table, admin-only, unused by the current app) ─
create table if not exists public.clients (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  address     text,
  id_number   text,
  created_at  timestamptz default now()
);

-- ─── SERVICE EVENTS (scheduled visits) ─────────────────────────
create table if not exists public.service_events (
  id              uuid primary key default gen_random_uuid(),
  event_date      date not null,
  event_time      time,
  client_name     text,
  client_address  text,
  client_user_id  uuid references public.profiles(id),
  technician_id   uuid references public.profiles(id),
  technician_name text,
  notes           text,
  status          text not null default 'pendiente'
                    constraint service_events_status_check
                    check (status in ('pendiente', 'en_progreso', 'completado', 'cancelado')),
  created_by      uuid not null references public.profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  service_type    text
                    constraint service_events_service_type_check
                    check (service_type in ('preventivo', 'correctivo', 'arranque')),
  event_code      text constraint service_events_event_code_unique unique,
  event_name      text,
  client_phone    text,
  client_email    text,
  equipment_type  text
                    constraint service_events_equipment_type_check
                    check (equipment_type is null or equipment_type in
                      ('ups', 'ac', 'generador', 'bateria', 'ats', 'tablero', 'trabajos_varios'))
);

create index if not exists service_events_date_idx on public.service_events (event_date);

create sequence if not exists public.service_event_code_seq;

-- ─── SERVICE REPORTS ──────────────────────────────────────────
create table if not exists public.service_reports (
  id                      uuid primary key default gen_random_uuid(),
  report_number           serial unique,
  sc_code                 text,
  project_name            text,
  report_date             date default current_date,

  equipment_type          text not null
                            constraint service_reports_equipment_type_check
                            check (equipment_type in
                              ('ups','ac','generador','bees','microdatacenter','bateria','ats','tablero','trabajos_varios')),
  service_type            text not null
                            constraint service_reports_service_type_check
                            check (service_type in ('preventivo','correctivo','arranque','varios')),

  client_id               uuid references public.clients(id),
  client_name             text,
  client_address          text,

  brand                   text,
  model                   text,
  serial_number           text,
  asset_number            text,
  location                text,

  work_description        text,
  observations            text,

  status                  text default 'draft' check (status in ('draft','completed','signed')),

  client_signer_name      text,
  client_signer_id        text,
  client_signature_url    text,
  signed_at               timestamptz,

  technician_id           uuid references public.profiles(id),
  technician_name         text,

  created_at              timestamptz default now(),
  updated_at              timestamptz default now(),

  equipment_data          jsonb default '{}',
  pdf_storage_path        text,
  client_email            text,
  client_user_id          uuid references public.profiles(id),
  client_email_secondary  text,
  client_phone            text,
  event_id                uuid references public.service_events(id) on delete set null
);

comment on column public.service_reports.equipment_data is
  'JSONB column storing equipment-specific data. Structure varies by equipment_type (ups/ac/etc.).';

create index if not exists service_reports_event_id_idx on public.service_reports (event_id);

-- ─── REPORT TECHNICIANS ────────────────────────────────────────
create table if not exists public.report_technicians (
  id                uuid primary key default gen_random_uuid(),
  report_id         uuid not null references public.service_reports(id) on delete cascade,
  technician_name   text,
  fault_time        time,
  arrival_pdv       time,
  departure_pdv     time,
  arrival_plant     time,
  technician_id     uuid references public.profiles(id)
);

-- ─── REPORT PARTS ─────────────────────────────────────────────
create table if not exists public.report_parts (
  id          uuid primary key default gen_random_uuid(),
  report_id   uuid not null references public.service_reports(id) on delete cascade,
  quantity    numeric,
  description text,
  part_code   text
);

-- ─── REPORT PHOTOS ────────────────────────────────────────────
create table if not exists public.report_photos (
  id            uuid primary key default gen_random_uuid(),
  report_id     uuid not null references public.service_reports(id) on delete cascade,
  storage_path  text not null,
  caption       text,
  uploaded_at   timestamptz default now(),
  photo_type    text not null default 'equipo' check (photo_type in ('equipo','antes','despues'))
);

-- ─── COMPANY SETTINGS (singleton row, app branding) ────────────
create table if not exists public.company_settings (
  id                boolean primary key default true check (id),
  company_name      text,
  company_emails    text,
  address           text,
  phone             text,
  website           text,
  logo_storage_path text,
  updated_at        timestamptz not null default now(),
  updated_by        uuid references public.profiles(id),
  report_color      text
);

-- ============================================================
--  PART 3 — FUNCTIONS & TRIGGERS (dependency order)
-- ============================================================

-- ─── is_admin() ─────────────────────────────────────────────────
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ─── prevent_self_role_escalation() ─────────────────────────────
create or replace function public.prevent_self_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and auth.role() <> 'service_role'
     and not public.is_admin() then
    raise exception 'Solo un administrador puede cambiar el rol de un usuario';
  end if;
  return new;
end;
$$;

revoke execute on function public.prevent_self_role_escalation() from public, anon, authenticated;

-- ─── handle_new_user() — auto-creates a profile row on signup ──
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ─── set_updated_at() ───────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─── get_report_for_signature() — public signing page ──────────
create or replace function public.get_report_for_signature(p_report_id uuid)
returns table (
  id uuid,
  report_number int,
  client_name text,
  technician_name text,
  report_date date,
  service_type text,
  equipment_type text,
  brand text,
  model text,
  location text,
  work_description text,
  status text,
  client_signer_name text,
  client_signer_id text,
  client_signature_url text,
  signed_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select id, report_number, client_name, technician_name, report_date,
         service_type, equipment_type, brand, model, location, work_description,
         status, client_signer_name, client_signer_id, client_signature_url, signed_at
  from public.service_reports
  where id = p_report_id;
$$;

revoke execute on function public.get_report_for_signature(uuid) from public;
grant execute on function public.get_report_for_signature(uuid) to anon, authenticated;

-- ─── is_report_technician() — can this user *see* this report? ─
create or replace function public.is_report_technician(p_report_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.service_reports r
    where r.id = p_report_id
      and (
        r.technician_id = auth.uid()
        or public.is_admin()
        or exists (
          select 1 from public.report_technicians rt
          where rt.report_id = r.id and rt.technician_id = auth.uid()
        )
      )
  );
$$;

revoke execute on function public.is_report_technician(uuid) from public;
grant execute on function public.is_report_technician(uuid) to authenticated;

-- ─── can_edit_report() — same, plus not yet signed ──────────────
create or replace function public.can_edit_report(p_report_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_report_technician(p_report_id) and exists (
    select 1 from public.service_reports r where r.id = p_report_id and r.status <> 'signed'
  );
$$;

revoke execute on function public.can_edit_report(uuid) from public;
grant execute on function public.can_edit_report(uuid) to authenticated;

-- ─── can_edit_report_content() — owner/admin/listed técnico, not signed ─
create or replace function public.can_edit_report_content(p_report_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.service_reports r
    where r.id = p_report_id
      and r.status <> 'signed'
      and (
        r.technician_id = auth.uid()
        or public.is_admin()
        or exists (
          select 1 from public.report_technicians rt
          where rt.report_id = r.id and rt.technician_id = auth.uid()
        )
      )
  );
$$;

revoke execute on function public.can_edit_report_content(uuid) from public;
grant execute on function public.can_edit_report_content(uuid) to authenticated;

-- ─── enforce_report_edit_scope() — column-scoped UPDATE guard ──
create or replace function public.enforce_report_edit_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- sign_report()/set_report_pdf_path() set this right before their own
  -- update -- both are narrowly-scoped, already-gated flows in their own
  -- right and aren't subject to this rule at all.
  if current_setting('app.bypass_report_edit_scope', true) = 'true' then
    return new;
  end if;

  -- Owner or listed técnico (or admin), not yet signed: full edit.
  if public.can_edit_report_content(old.id) then
    return new;
  end if;

  -- Otherwise this can only be a client contact-snapshot fix
  -- (updateReportClientInfo) on an unlinked client, at ANY status
  -- including signed -- every column other than the client contact
  -- fields (+ the cache path, which that edit also resets) must be
  -- unchanged.
  if public.is_report_technician(old.id)
    and old.client_user_id is null
    and new.report_number          is not distinct from old.report_number
    and new.sc_code                is not distinct from old.sc_code
    and new.project_name           is not distinct from old.project_name
    and new.report_date            is not distinct from old.report_date
    and new.equipment_type         is not distinct from old.equipment_type
    and new.service_type           is not distinct from old.service_type
    and new.client_id              is not distinct from old.client_id
    and new.brand                  is not distinct from old.brand
    and new.model                  is not distinct from old.model
    and new.serial_number          is not distinct from old.serial_number
    and new.asset_number           is not distinct from old.asset_number
    and new.location               is not distinct from old.location
    and new.work_description       is not distinct from old.work_description
    and new.observations           is not distinct from old.observations
    and new.status                 is not distinct from old.status
    and new.client_signer_name     is not distinct from old.client_signer_name
    and new.client_signer_id       is not distinct from old.client_signer_id
    and new.client_signature_url   is not distinct from old.client_signature_url
    and new.signed_at              is not distinct from old.signed_at
    and new.technician_id          is not distinct from old.technician_id
    and new.technician_name        is not distinct from old.technician_name
    and new.equipment_data         is not distinct from old.equipment_data
    and new.client_user_id         is not distinct from old.client_user_id
    and new.client_email_secondary is not distinct from old.client_email_secondary
  then
    return new;
  end if;

  raise exception 'No tienes permiso para editar el contenido de este reporte';
end;
$$;

-- ─── sign_report() — public signing RPC, bypasses the edit-scope guard ─
create or replace function public.sign_report(
  p_report_id uuid,
  p_signer_name text,
  p_signer_id text,
  p_signature_url text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('app.bypass_report_edit_scope', 'true', true);
  update public.service_reports
  set client_signer_name   = p_signer_name,
      client_signer_id     = p_signer_id,
      client_signature_url = p_signature_url,
      signed_at             = now(),
      status                = 'signed',
      pdf_storage_path      = null
  where id = p_report_id
    and status <> 'signed';
end;
$$;

revoke execute on function public.sign_report(uuid, text, text, text) from public;
grant execute on function public.sign_report(uuid, text, text, text) to anon, authenticated;

-- ─── set_report_pdf_path() — PDF cache write-through ────────────
create or replace function public.set_report_pdf_path(p_report_id uuid, p_path text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('app.bypass_report_edit_scope', 'true', true);
  update public.service_reports
  set pdf_storage_path = p_path
  where id = p_report_id
    and public.is_report_technician(p_report_id);
end;
$$;

revoke execute on function public.set_report_pdf_path(uuid, text) from anon;
grant execute on function public.set_report_pdf_path(uuid, text) to authenticated;

-- ─── get_technicians() / get_clients() — dropdown directories ──
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

create or replace function public.get_clients()
returns table (id uuid, full_name text)
language sql
security definer
set search_path = public
as $$
  select id, full_name
  from public.profiles
  where role = 'cliente'
  order by full_name;
$$;

grant execute on function public.get_clients() to authenticated;

-- ─── get_company_branding() — public read of branding fields ──
create or replace function public.get_company_branding()
returns table (
  company_name text,
  company_emails text,
  address text,
  phone text,
  website text,
  logo_storage_path text,
  report_color text
)
language sql
security definer
set search_path = public
as $$
  select company_name, company_emails, address, phone, website, logo_storage_path, report_color
  from public.company_settings
  where id = true;
$$;

revoke execute on function public.get_company_branding() from public;
grant execute on function public.get_company_branding() to anon, authenticated;

-- ─── get_unlinked_report_clients() — clients never linked to a portal account ─
create or replace function public.get_unlinked_report_clients()
returns table (client_name text, client_email text, client_address text)
language sql
security definer
set search_path = public
as $$
  select distinct on (lower(trim(sr.client_name)))
    sr.client_name, sr.client_email, sr.client_address
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
  order by lower(trim(sr.client_name)), sr.created_at desc;
$$;

revoke execute on function public.get_unlinked_report_clients() from public;
grant execute on function public.get_unlinked_report_clients() to authenticated;

-- ─── get_staff_directory() — admin's técnico/admin picker ───────
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

-- ─── Almacenamiento (Configuración page) admin RPCs ─────────────
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

grant execute on function public.get_storage_usage() to authenticated;

create or replace function public.get_report_pdf_stats()
returns table (total_reports bigint, reports_with_cached_pdf bigint)
language sql
stable security definer
set search_path to 'public'
as $$
  select count(*) as total_reports, count(pdf_storage_path) as reports_with_cached_pdf
  from public.service_reports
  where public.is_admin();
$$;

grant execute on function public.get_report_pdf_stats() to authenticated;

create or replace function public.get_database_size()
returns table (total_bytes bigint)
language sql
stable security definer
set search_path to 'public'
as $$
  select pg_database_size(current_database()) as total_bytes
  where public.is_admin();
$$;

grant execute on function public.get_database_size() to authenticated;

create or replace function public.get_database_table_sizes()
returns table (table_name text, row_count bigint, table_bytes bigint)
language plpgsql
stable security definer
set search_path to 'public'
as $$
declare
  r record;
begin
  if not public.is_admin() then
    return;
  end if;

  for r in
    select c.relname as tbl, c.oid
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
  loop
    return query execute format(
      'select %L::text, count(*)::bigint, pg_total_relation_size(%L)::bigint from public.%I',
      r.tbl, r.tbl, r.tbl
    );
  end loop;
end;
$$;

grant execute on function public.get_database_table_sizes() to authenticated;

-- ─── get_next_event_code() — auto-generated Código del Evento ──
create or replace function public.get_next_event_code()
returns text
language sql
security definer
set search_path to 'public'
as $$
  select 'EVT-' || lpad(nextval('public.service_event_code_seq')::text, 4, '0');
$$;

grant execute on function public.get_next_event_code() to authenticated;

-- ─── get_all_report_clients() — full client picker (linked + unlinked) ─
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

-- ─── TRIGGERS ────────────────────────────────────────────────────
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

drop trigger if exists service_reports_updated_at on public.service_reports;
create trigger service_reports_updated_at
  before update on public.service_reports
  for each row execute procedure public.set_updated_at();

drop trigger if exists profiles_prevent_self_role_escalation on public.profiles;
create trigger profiles_prevent_self_role_escalation
  before update on public.profiles
  for each row execute procedure public.prevent_self_role_escalation();

drop trigger if exists service_reports_enforce_edit_scope on public.service_reports;
create trigger service_reports_enforce_edit_scope
  before update on public.service_reports
  for each row execute procedure public.enforce_report_edit_scope();

-- ============================================================
--  PART 4 — ROW LEVEL SECURITY
-- ============================================================

alter table public.profiles          enable row level security;
alter table public.clients           enable row level security;
alter table public.service_reports   enable row level security;
alter table public.report_technicians enable row level security;
alter table public.report_parts      enable row level security;
alter table public.report_photos     enable row level security;
alter table public.company_settings  enable row level security;
alter table public.service_events    enable row level security;

-- ─── profiles ────────────────────────────────────────────────────
create policy "profiles: own read"   on public.profiles for select using (auth.uid() = id);
create policy "profiles: own update" on public.profiles for update using (auth.uid() = id);
create policy "profiles: admin read all" on public.profiles
  for select using (public.is_admin());
create policy "profiles: admin update all" on public.profiles
  for update using (public.is_admin()) with check (public.is_admin());

-- ─── clients (admin-only) ────────────────────────────────────────
create policy "clients: admin read" on public.clients
  for select using (public.is_admin());
create policy "clients: admin insert" on public.clients
  for insert with check (public.is_admin());
create policy "clients: admin update" on public.clients
  for update using (public.is_admin()) with check (public.is_admin());

-- ─── service_reports ─────────────────────────────────────────────
create policy "reports: own read"   on public.service_reports for select using (auth.uid() = technician_id);
create policy "reports: own insert" on public.service_reports for insert with check (auth.uid() = technician_id);
create policy "reports: admin read all" on public.service_reports
  for select using (public.is_admin());
create policy "reports: admin delete all" on public.service_reports
  for delete using (public.is_admin());
create policy "reports: client read own" on public.service_reports
  for select using (auth.uid() = client_user_id);
create policy "reports: listed technician read" on public.service_reports
  for select using (
    exists (
      select 1 from public.report_technicians rt
      where rt.report_id = service_reports.id and rt.technician_id = auth.uid()
    )
  );
create policy "reports: staff update" on public.service_reports
  for update
  using (public.is_report_technician(id))
  with check (public.is_report_technician(id));

-- ─── report_technicians ──────────────────────────────────────────
create policy "technicians: read via report" on public.report_technicians
  for select using (public.is_report_technician(report_id));
create policy "technicians: insert via report" on public.report_technicians
  for insert with check (public.can_edit_report(report_id));
create policy "technicians: update via report" on public.report_technicians
  for update using (public.can_edit_report(report_id));
create policy "technicians: delete via report" on public.report_technicians
  for delete using (public.can_edit_report(report_id));

-- ─── report_parts ────────────────────────────────────────────────
create policy "parts: read via report" on public.report_parts
  for select using (public.is_report_technician(report_id));
create policy "parts: insert via report" on public.report_parts
  for insert with check (public.can_edit_report_content(report_id));
create policy "parts: update via report" on public.report_parts
  for update using (public.can_edit_report_content(report_id));
create policy "parts: delete via report" on public.report_parts
  for delete using (public.can_edit_report_content(report_id));

-- ─── report_photos (no update policy — never added) ─────────────
create policy "photos: read via report" on public.report_photos
  for select using (public.is_report_technician(report_id));
create policy "photos: insert via report" on public.report_photos
  for insert with check (public.can_edit_report_content(report_id));
create policy "photos: delete via report" on public.report_photos
  for delete using (public.can_edit_report_content(report_id));

-- ─── company_settings (admin-only) ───────────────────────────────
create policy "company_settings: admin read" on public.company_settings
  for select using (public.is_admin());
create policy "company_settings: admin insert" on public.company_settings
  for insert with check (public.is_admin());
create policy "company_settings: admin update" on public.company_settings
  for update using (public.is_admin()) with check (public.is_admin());

-- ─── service_events ──────────────────────────────────────────────
create policy "events: select" on public.service_events
  for select using (
    technician_id = auth.uid() or created_by = auth.uid() or public.is_admin()
  );
create policy "events: insert" on public.service_events
  for insert with check (
    created_by = auth.uid()
    and (technician_id = auth.uid() or technician_id is null or public.is_admin())
  );
create policy "events: update" on public.service_events
  for update
  using (technician_id = auth.uid() or created_by = auth.uid() or public.is_admin())
  with check (technician_id = auth.uid() or public.is_admin());
create policy "events: delete" on public.service_events
  for delete using (
    technician_id = auth.uid() or created_by = auth.uid() or public.is_admin()
  );

-- ============================================================
--  PART 5 — STORAGE BUCKETS & POLICIES
-- ============================================================

insert into storage.buckets (id, name, public) values
  ('report-photos',   'report-photos',   false),
  ('avatars',         'avatars',         true),
  ('signatures',      'signatures',      true),
  ('report-pdfs',     'report-pdfs',     false),
  ('equipment-files', 'equipment-files', false),
  ('company-logo',    'company-logo',    true)
on conflict (id) do nothing;

-- ─── report-photos: `${report_id}/${filename}` ───────────────────
create policy "report-photos: read via report" on storage.objects
  for select using (
    bucket_id = 'report-photos' and public.is_report_technician(((storage.foldername(name))[1])::uuid)
  );
create policy "report-photos: insert via report" on storage.objects
  for insert with check (
    bucket_id = 'report-photos' and public.can_edit_report_content(((storage.foldername(name))[1])::uuid)
  );
create policy "report-photos: delete via report" on storage.objects
  for delete using (
    bucket_id = 'report-photos' and public.can_edit_report_content(((storage.foldername(name))[1])::uuid)
  );

-- ─── avatars: `${user_id}/avatar.<ext>`, public read via bucket flag ─
create policy "avatars: user manages own avatar" on storage.objects
  for all
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ─── signatures: `${report_id}/${filename}`, public bucket ───────
create policy "signatures: public read" on storage.objects
  for select using (bucket_id = 'signatures');
create policy "signatures: upload while report unsigned" on storage.objects
  for insert with check (
    bucket_id = 'signatures'
    and exists (
      select 1 from public.service_reports r
      where r.id::text = (storage.foldername(name))[1]
        and r.status <> 'signed'
    )
  );

-- ─── report-pdfs: `${report_id}/${filename}`, no signed-lock ─────
create policy "report-pdfs: read via report" on storage.objects
  for select using (
    bucket_id = 'report-pdfs' and (
      public.is_report_technician(((storage.foldername(name))[1])::uuid)
      or exists (
        select 1 from public.service_reports r
        where r.id::text = (storage.foldername(name))[1] and r.client_user_id = auth.uid()
      )
    )
  );
create policy "report-pdfs: insert via report" on storage.objects
  for insert with check (
    bucket_id = 'report-pdfs' and public.is_report_technician(((storage.foldername(name))[1])::uuid)
  );
create policy "report-pdfs: update via report" on storage.objects
  for update using (
    bucket_id = 'report-pdfs' and public.is_report_technician(((storage.foldername(name))[1])::uuid)
  );
create policy "report-pdfs: delete via report" on storage.objects
  for delete using (
    bucket_id = 'report-pdfs' and public.is_report_technician(((storage.foldername(name))[1])::uuid)
  );

-- ─── equipment-files: `${report_id}/${filename}` ─────────────────
create policy "equipment-files: read via report" on storage.objects
  for select using (
    bucket_id = 'equipment-files' and exists (
      select 1 from public.service_reports r
      where r.id::text = (storage.foldername(name))[1]
        and (r.technician_id = auth.uid() or r.client_user_id = auth.uid() or public.is_admin())
    )
  );
create policy "equipment-files: insert via report" on storage.objects
  for insert with check (
    bucket_id = 'equipment-files' and exists (
      select 1 from public.service_reports r
      where r.id::text = (storage.foldername(name))[1]
        and r.technician_id = auth.uid() and r.status <> 'signed'
    )
  );
create policy "equipment-files: delete via report" on storage.objects
  for delete using (
    bucket_id = 'equipment-files' and exists (
      select 1 from public.service_reports r
      where r.id::text = (storage.foldername(name))[1]
        and r.technician_id = auth.uid() and r.status <> 'signed'
    )
  );

-- ─── company-logo: public read, admin write ───────────────────────
create policy "company-logo: public read" on storage.objects
  for select using (bucket_id = 'company-logo');
create policy "company-logo: admin insert" on storage.objects
  for insert with check (bucket_id = 'company-logo' and public.is_admin());
create policy "company-logo: admin update" on storage.objects
  for update using (bucket_id = 'company-logo' and public.is_admin());
create policy "company-logo: admin delete" on storage.objects
  for delete using (bucket_id = 'company-logo' and public.is_admin());

commit;
