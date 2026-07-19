-- Sulap Artisan — admin permissions (migration 0002)
-- =============================================================================
-- Adds per-tab admin permissions to profiles, plus a trigger that makes
-- role/perms escalation impossible via the API: only a session that is
-- ALREADY a super admin can change anyone's role or perms — including their
-- own. Everyone else's update requests to those two columns are silently
-- reverted to the existing value, no matter what they send.
--
-- HOW TO RUN: same as 0001 — Supabase Dashboard → SQL Editor → paste → Run.
-- Idempotent, safe to re-run.
-- =============================================================================

alter table public.profiles add column if not exists perms jsonb not null default '{}'::jsonb;

create or replace function public.protect_profile_role_perms()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_super() then
    new.role := old.role;
    new.perms := old.perms;
  end if;
  return new;
end; $$;

drop trigger if exists protect_role_perms on public.profiles;
create trigger protect_role_perms
  before update on public.profiles
  for each row execute function public.protect_profile_role_perms();

-- Lets a super admin manage other admins' role/perms (self-updates already
-- work via profiles_self_update from migration 0001). Scoped to is_super(),
-- not is_admin(), since only super admins manage other accounts in the UI —
-- the trigger above is the real backstop either way.
drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update on public.profiles for update using (public.is_super()) with check (public.is_super());

-- =============================================================================
-- End migration 0002. Creating/removing admin accounts still needs a
-- privileged server-side call (auth.admin.createUser/deleteUser via a
-- service-role Edge Function) — out of scope here. For now, create an admin
-- the same way the first super-admin was created: Dashboard → Authentication
-- → Users → Add user, then promote/grant via SQL (see supabase/README.md).
-- =============================================================================
