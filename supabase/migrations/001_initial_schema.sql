-- ============================================================
--  SIMEC Service Reports – Initial Schema
--  Run this in Supabase SQL Editor when ready to go live
-- ============================================================

-- Enable UUID extension (usually already enabled in Supabase)
create extension if not exists "pgcrypto";

-- ─── PROFILES (extends auth.users) ────────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  full_name   text,
  phone       text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- Auto-create profile on new user signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── CLIENTS ──────────────────────────────────────────────────
create table if not exists public.clients (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  address     text,
  id_number   text,
  created_at  timestamptz default now()
);

-- ─── SERVICE REPORTS ──────────────────────────────────────────
create table if not exists public.service_reports (
  id                      uuid primary key default gen_random_uuid(),
  report_number           serial unique,
  sc_code                 text,
  project_name            text,
  report_date             date default current_date,

  -- Type
  equipment_type          text not null check (equipment_type in ('ups','ac','generador','bees','microdatacenter')),
  service_type            text not null check (service_type in ('preventivo','correctivo','arranque')),

  -- Client (snapshot + FK)
  client_id               uuid references public.clients(id),
  client_name             text,
  client_address          text,

  -- Equipment
  brand                   text,
  model                   text,
  serial_number           text,
  asset_number            text,
  location                text,

  -- Work
  work_description        text,
  observations            text,

  -- Status
  status                  text default 'draft' check (status in ('draft','completed','signed')),

  -- Signature
  client_signer_name      text,
  client_signer_id        text,
  client_signature_url    text,
  signed_at               timestamptz,

  -- Technician
  technician_id           uuid references public.profiles(id),
  technician_name         text,

  created_at              timestamptz default now(),
  updated_at              timestamptz default now()
);

-- ─── REPORT TECHNICIANS ────────────────────────────────────────
create table if not exists public.report_technicians (
  id                uuid primary key default gen_random_uuid(),
  report_id         uuid not null references public.service_reports(id) on delete cascade,
  technician_name   text,
  fault_time        time,
  arrival_pdv       time,
  departure_pdv     time,
  arrival_plant     time
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
  uploaded_at   timestamptz default now()
);

-- ─── AUTO-UPDATE updated_at ───────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger service_reports_updated_at
  before update on public.service_reports
  for each row execute procedure public.set_updated_at();

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────
alter table public.profiles         enable row level security;
alter table public.clients          enable row level security;
alter table public.service_reports  enable row level security;
alter table public.report_technicians enable row level security;
alter table public.report_parts     enable row level security;
alter table public.report_photos    enable row level security;

-- Profiles: users can read/update their own
create policy "profiles: own read"   on public.profiles for select using (auth.uid() = id);
create policy "profiles: own update" on public.profiles for update using (auth.uid() = id);

-- Clients: any authenticated user
create policy "clients: auth read"   on public.clients for select using (auth.role() = 'authenticated');
create policy "clients: auth insert" on public.clients for insert with check (auth.role() = 'authenticated');
create policy "clients: auth update" on public.clients for update using (auth.role() = 'authenticated');

-- Reports: only the creator can read/write their reports
create policy "reports: own read"   on public.service_reports for select using (auth.uid() = technician_id);
create policy "reports: own insert" on public.service_reports for insert with check (auth.uid() = technician_id);
create policy "reports: own update" on public.service_reports for update using (auth.uid() = technician_id);

-- Report children: inherit access from parent report
create policy "technicians: via report" on public.report_technicians for all
  using (exists (select 1 from public.service_reports r where r.id = report_id and r.technician_id = auth.uid()));

create policy "parts: via report" on public.report_parts for all
  using (exists (select 1 from public.service_reports r where r.id = report_id and r.technician_id = auth.uid()));

create policy "photos: via report" on public.report_photos for all
  using (exists (select 1 from public.service_reports r where r.id = report_id and r.technician_id = auth.uid()));

-- ─── STORAGE BUCKETS (run in Supabase Storage UI or here) ─────
-- insert into storage.buckets (id, name, public) values ('report-photos', 'report-photos', false);
-- insert into storage.buckets (id, name, public) values ('signatures', 'signatures', false);

-- Storage RLS: technician can upload to their own report folder
-- create policy "photos upload" on storage.objects for insert with check (
--   auth.role() = 'authenticated' and bucket_id = 'report-photos'
-- );
