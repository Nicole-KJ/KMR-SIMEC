-- ============================================================
--  SIMEC Service Reports – Fix 007: revoking from PUBLIC wasn't
--  enough. Supabase grants EXECUTE on every function created in
--  the `public` schema directly to anon/authenticated (via a
--  schema-level default privilege), independent of the PUBLIC
--  pseudo-role — so `revoke ... from public` alone left both
--  roles with access. Revoking from them explicitly instead.
-- ============================================================

revoke execute on function public.handle_new_user() from anon, authenticated;
revoke execute on function public.prevent_self_role_escalation() from anon, authenticated;
