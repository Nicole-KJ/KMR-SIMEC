-- Adds an optional client email so reports can be sent via production
-- email (Resend) without the sender having to retype the recipient
-- address every time.
alter table public.service_reports
  add column if not exists client_email text;
