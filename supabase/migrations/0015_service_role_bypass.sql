-- Sulap Artisan — migration 0015: let the admin Edge Function set role/perms
-- =============================================================================
-- The admin-manage Edge Function (supabase/functions/admin-manage) creates a
-- new admin's auth account, then needs to promote the profiles row the
-- signup trigger just created (forced to role='vendor') to 'staff'/'super'.
-- It does this using the service_role key — but migration 0002/0003's
-- protect_profile_role_perms trigger only lets a session that is_super()
-- through, and a service-role connection has no auth.uid() at all, so
-- is_super() is false and the write would be silently reverted.
--
-- Extends the trigger's bypass condition to also allow auth.role() =
-- 'service_role' — the standard Supabase convention for "this connection is
-- already fully trusted" (service_role already bypasses RLS entirely; this
-- just lets it clear a trigger-level guard too, not just RLS).
--
-- HOW TO RUN: Supabase Dashboard → SQL Editor → paste this whole file → Run.
-- Safe to re-run (CREATE OR REPLACE).
-- =============================================================================

create or replace function public.protect_profile_role_perms()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_super() and auth.role() <> 'service_role' then
    new.role := old.role;
    new.perms := old.perms;
    new.staff_id := old.staff_id;
  end if;
  return new;
end; $$;

-- =============================================================================
-- End migration 0015.
-- =============================================================================
