-- ============================================================
--  SIMEC Service Reports – Admin content-edit requires técnico involvement
--  Until now can_edit_report() (027) gave an admin full write access to
--  ANY report, técnico or not -- correct for the narrow "fix a client's
--  contact snapshot" case (ClienteDetail.jsx's Editar Datos del cliente,
--  via updateReportClientInfo), but too broad for the full edit screen:
--  an admin uninvolved in a job shouldn't be able to rewrite its
--  equipment data, técnicos, parts, photos or work description.
--
--  RLS alone can't express "this role may touch these columns but not
--  those" on a single UPDATE -- policies gate whole rows, not columns --
--  so this is enforced with a BEFORE UPDATE trigger instead, same
--  approach as prevent_self_role_escalation (006) uses for
--  profiles.role. Two other RPCs (sign_report, set_report_pdf_path) also
--  update service_reports as narrowly-scoped, already-gated flows of
--  their own (public signing page; PDF cache) -- they opt out of this
--  trigger via a session-local flag rather than being duplicated into
--  its allowed-column list.
--
--  report_technicians/report_parts/report_photos (+ the report-photos
--  bucket) have no such narrow-admin use case at all, so they're just
--  tightened outright to técnico-only.
--  Run after 001-030.
-- ============================================================

-- ─── CONTENT-EDIT CHECK (técnico/owner only -- no admin bypass) ────────
create or replace function public.can_edit_report_content(p_report_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.service_reports r
    where r.id = p_report_id
      and r.status <> 'signed'
      and (
        r.technician_id = auth.uid()
        or exists (
          select 1 from public.report_technicians rt
          where rt.report_id = r.id and rt.technician_id = auth.uid()
        )
      )
  );
$$;

revoke execute on function public.can_edit_report_content(uuid) from public;
grant execute on function public.can_edit_report_content(uuid) to authenticated;

-- ─── COLUMN-SCOPED GUARD ON service_reports ─────────────────────────────
create or replace function public.enforce_report_edit_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- sign_report()/set_report_pdf_path() set this right before their own
  -- update -- both are narrowly-scoped, already-gated flows in their own
  -- right (one of them anon-reachable by design, for the public
  -- /firma/:id page) and aren't subject to this rule at all.
  if current_setting('app.bypass_report_edit_scope', true) = 'true' then
    return new;
  end if;

  -- Owner or listed técnico, not yet signed: full edit, same as before.
  if public.can_edit_report_content(old.id) then
    return new;
  end if;

  -- Otherwise this can only be an admin fixing a client's contact
  -- snapshot (updateReportClientInfo) -- every column other than the
  -- client contact fields (+ the cache path, which that edit also
  -- resets, + updated_at) must be unchanged.
  if public.is_admin()
    and old.status <> 'signed'
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

drop trigger if exists service_reports_enforce_edit_scope on public.service_reports;
create trigger service_reports_enforce_edit_scope
  before update on public.service_reports
  for each row execute procedure public.enforce_report_edit_scope();

-- ─── sign_report (011) opts out via the bypass flag ─────────────────────
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

-- ─── set_report_pdf_path (027) opts out via the bypass flag ─────────────
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

-- ─── report_technicians / report_parts / report_photos: técnico-only now ─
drop policy if exists "technicians: insert via report" on public.report_technicians;
drop policy if exists "technicians: update via report" on public.report_technicians;
drop policy if exists "technicians: delete via report" on public.report_technicians;

create policy "technicians: insert via report" on public.report_technicians
  for insert with check (public.can_edit_report_content(report_id));
create policy "technicians: update via report" on public.report_technicians
  for update using (public.can_edit_report_content(report_id));
create policy "technicians: delete via report" on public.report_technicians
  for delete using (public.can_edit_report_content(report_id));

drop policy if exists "parts: insert via report" on public.report_parts;
drop policy if exists "parts: update via report" on public.report_parts;
drop policy if exists "parts: delete via report" on public.report_parts;

create policy "parts: insert via report" on public.report_parts
  for insert with check (public.can_edit_report_content(report_id));
create policy "parts: update via report" on public.report_parts
  for update using (public.can_edit_report_content(report_id));
create policy "parts: delete via report" on public.report_parts
  for delete using (public.can_edit_report_content(report_id));

drop policy if exists "photos: insert via report" on public.report_photos;
drop policy if exists "photos: delete via report" on public.report_photos;

create policy "photos: insert via report" on public.report_photos
  for insert with check (public.can_edit_report_content(report_id));
create policy "photos: delete via report" on public.report_photos
  for delete using (public.can_edit_report_content(report_id));

-- ─── storage: report-photos, same narrowing ──────────────────────────────
drop policy if exists "report-photos: insert via report" on storage.objects;
drop policy if exists "report-photos: delete via report" on storage.objects;

create policy "report-photos: insert via report" on storage.objects
  for insert with check (
    bucket_id = 'report-photos' and public.can_edit_report_content(((storage.foldername(name))[1])::uuid)
  );
create policy "report-photos: delete via report" on storage.objects
  for delete using (
    bucket_id = 'report-photos' and public.can_edit_report_content(((storage.foldername(name))[1])::uuid)
  );
