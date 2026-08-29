-- ============================================================
--  SIMEC Service Reports – Client-editable contact info on profiles
--  Backs ProfileModal.jsx's new "Datos del cliente" section (Dirección,
--  Teléfono del cliente, Correo del cliente), shown only for role =
--  'cliente'. "Nombre del cliente" needs no new column -- it's the
--  existing profiles.full_name, already editable in the modal.
--
--  contact_email is deliberately its own column, NOT auth.users.email:
--  the modal already shows the real login email read-only (an auth email
--  change needs Supabase's own confirmation flow, out of scope here), and
--  every other "client_email" in this schema (service_reports) has always
--  been free-text contact info decoupled from the portal login anyway --
--  same idea here, just on profiles instead of a report.
--
--  profiles.phone already existed (001) but nothing wrote to it until now.
--  No RLS changes needed: "profiles: own update" (001) already lets a user
--  update any column on their own row except role (locked by the
--  prevent_self_role_escalation trigger, 006) -- address/contact_email
--  fall right under that existing policy.
--  Run after 001-029.
-- ============================================================

alter table public.profiles
  add column if not exists address text,
  add column if not exists contact_email text;
