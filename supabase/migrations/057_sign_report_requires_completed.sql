-- ============================================================
--  SIMEC Service Reports – A report can only be signed once completed
--  sign_report() (003, last touched in 031) only ever blocked
--  re-signing an already-signed report (`status <> 'signed'`) --
--  nothing stopped it from signing a 'draft' report, finalizing work
--  that was never actually marked done. ReportDetail.jsx's own
--  "Firmar Reporte" button already carries a comment claiming this
--  rule ("signing a draft would finalize work that isn't actually
--  done yet"), but the condition backing it only applied to a
--  client viewer -- staff still saw the button (and the share-link
--  button) on a draft. The real boundary belongs here: sign_report()
--  is reachable anonymously from the public /firma/:id page, so a
--  shared draft link was signable regardless of what the UI showed.
--
--  Tightened to require status = 'completed' outright -- this also
--  covers the already-signed case for free (a signed row's status is
--  'signed', never 'completed'), so the old `<> 'signed'` check is
--  just replaced rather than kept alongside.
--  Run after 001-056.
-- ============================================================

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
    and status = 'completed';
end;
$$;
