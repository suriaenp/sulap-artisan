-- Sulap Artisan — company-assigned Staff ID, separate from the auth UUID
-- (migration 0003)
-- =============================================================================
-- profiles.id is the Supabase Auth UUID — required for RLS/joins, never
-- meant to be human-facing. The admin UI was showing it as "Staff ID"
-- (batch 2c's mistake), but Staff ID is meant to be an identifier the
-- organization assigns (e.g. "SA-002"), unrelated to auth. This adds a
-- proper column for it, kept distinct from the UUID everywhere.
--
-- HOW TO RUN: same as 0001/0002 — Supabase Dashboard → SQL Editor → paste →
-- Run. Idempotent, safe to re-run.
-- =============================================================================

alter table public.profiles add column if not exists staff_id text;

-- Unique among the ones that are set — a partial index (WHERE staff_id is
-- not null) so multiple unset (null) rows don't collide with each other.
create unique index if not exists profiles_staff_id_key on public.profiles (staff_id) where staff_id is not null;

-- Extends the migration-0002 escalation guard: staff_id is an org-assigned
-- attribute like role/perms, not something an admin should change for
-- themselves — only an existing super admin's session can set it.
create or replace function public.protect_profile_role_perms()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_super() then
    new.role := old.role;
    new.perms := old.perms;
    new.staff_id := old.staff_id;
  end if;
  return new;
end; $$;

-- =============================================================================
-- End migration 0003. After running, set your own super admin's Staff ID
-- (replace both placeholders):
--   update public.profiles set staff_id = 'YOUR-STAFF-ID'
--   where id = (select id from auth.users where email = 'YOUR_EMAIL_HERE');
-- =============================================================================
