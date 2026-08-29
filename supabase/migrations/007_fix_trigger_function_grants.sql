-- ============================================================
--  SIMEC Service Reports – Fix grant ordering from 006
--  `CREATE OR REPLACE FUNCTION` resets a function's ACL back to
--  Postgres' default (EXECUTE to PUBLIC) — 006 revoked PUBLIC from
--  handle_new_user() in one statement, then replaced it (for the
--  search_path fix) in a later statement, silently undoing the
--  revoke. Also missed revoking PUBLIC from the new
--  prevent_self_role_escalation() trigger function entirely.
--  Neither function is meant to be called directly via RPC; both
--  are trigger-only and fire regardless of these grants.
-- ============================================================

revoke execute on function public.handle_new_user() from public;
revoke execute on function public.prevent_self_role_escalation() from public;
