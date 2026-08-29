-- ============================================================
--  Fix: prevent_self_role_escalation (006) blocks the service role
--  Run after 001-018.
-- ============================================================

-- ─── FIX: admin-users EDGE FUNCTION CAN'T SET ROLE ON INVITE ───
-- prevent_self_role_escalation (006) checks public.is_admin(), which reads
-- profiles where id = auth.uid(). The admin-users Edge Function's role write
-- (after invite, for role = 'admin'/'cliente') runs on the service_role
-- client with no user session, so auth.uid() is null and is_admin() is
-- false — the trigger then blocks a write the Edge Function already
-- authorized (it checks the caller is an admin before ever touching
-- adminClient, see admin-users/index.ts). Exempt service_role the same way
-- 001's "clients" policies key off auth.role() = 'authenticated'.
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
