-- ============================================================
--  SIMEC Service Reports – Remove the "cliente" role
--  Business decision: this deployment has no client-portal users,
--  only admin and técnico. Tightens profiles.role to just those two
--  going forward.
--
--  This intentionally does NOT touch the client-portal schema itself
--  (client_user_id columns, is_client(), the "client read own"/
--  "client select own" RLS policies, the client-users Edge Function,
--  etc.) -- that code is left in place but permanently unreachable,
--  since no profile can hold role = 'cliente' anymore. A future
--  migration can rip that out properly if it's ever confirmed dead
--  for good.
--
--  Postgres validates a new CHECK constraint against every existing
--  row when it's added -- if any profile still has role = 'cliente',
--  this migration fails outright (transaction rolled back) instead of
--  silently reassigning or orphaning that account. Resolve those rows
--  (reassign role or delete the account) before re-running.
--  Run after 001-054.
-- ============================================================

alter table public.profiles drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check check (role in ('admin', 'tecnico'));
