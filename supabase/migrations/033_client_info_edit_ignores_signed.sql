-- ============================================================
--  SIMEC Service Reports – Client info snapshot fix works on signed
--  reports too, and técnico (not just admin) can do it
--  Clarification on 031's narrow client-fields branch: "a report can't
--  be edited once signed" is a rule about the report's substantive
--  content (equipment data, técnicos, parts, work description, the
--  signature itself) -- it was never meant to block fixing an unlinked
--  client's Nombre/Dirección/Teléfono/Correo from ClienteDetail.jsx.
--  That branch previously required is_admin() and status <> 'signed';
--  now it's is_report_technician(old.id) (admin, owner, or listed
--  técnico -- same "can this person even see this report" check used
--  everywhere else) with no signed-lock, but newly requires the report
--  have no linked client (client_user_id is null) -- a linked client's
--  info is never editable this way regardless of status, since that's
--  the client's own portal profile, not a report snapshot.
--  Run after 001-032.
-- ============================================================

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

  -- Otherwise this can only be a client contact-snapshot fix
  -- (updateReportClientInfo, ClienteDetail.jsx's "Editar Datos del
  -- cliente") -- allowed for admin or any técnico who can see this
  -- report, on an unlinked client, at ANY status including signed --
  -- but every column other than the client contact fields (+ the cache
  -- path, which that edit also resets) must be unchanged.
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
