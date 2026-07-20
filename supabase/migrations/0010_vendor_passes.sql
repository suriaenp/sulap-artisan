-- Sulap Artisan — migration 0010: vendor passes
-- =============================================================================
-- The last of the original migration-0002 scope. Two tables, since the mock
-- shape (`passApps[i].people[]`) is a genuine one-to-many: one pass
-- application per vendor+event, each with its own independently-approved
-- pass holders (own status/rejectReason/decidedAt, no app-level status).
--
-- The mock always rewrote the ENTIRE passApps array on every mutation
-- (dispatch({type:'MERGE_PASS_APPS', payload: <whole array>})) — harmless
-- with one in-memory session, but two real tables (rather than one row with
-- a jsonb people[] column) avoids carrying that whole-array-rewrite race into
-- a shared multi-admin database.
--
-- RLS follows the same trust boundary as payments/deposits elsewhere in this
-- app: a vendor can fully manage rows under their OWN pass (insert new people,
-- edit-and-resubmit resets a person to pending, delete for the "reset for
-- testing" link) — the app's own code, not a DB trigger, is what ensures only
-- admin's code path ever sets a person's status to approved/rejected, same
-- convention already used for payments_self_write.
--
-- HOW TO RUN: Supabase Dashboard → SQL Editor → paste this whole file → Run.
-- Safe to re-run (IF NOT EXISTS / DROP POLICY IF EXISTS).
-- =============================================================================

create table if not exists public.vendor_passes (
  id             uuid primary key default gen_random_uuid(),
  vendor_id      uuid not null references public.vendors(id) on delete cascade,
  event_id       uuid not null references public.events(id) on delete cascade,
  extra_approved int  not null default 0,
  booth_number   text not null default '',
  submitted_at   timestamptz not null default now(),
  unique (vendor_id, event_id)
);
create index if not exists vendor_passes_vendor_idx on public.vendor_passes(vendor_id);

alter table public.vendor_passes enable row level security;
drop policy if exists vp_self_read on public.vendor_passes;
drop policy if exists vp_self_insert on public.vendor_passes;
drop policy if exists vp_self_delete on public.vendor_passes;
drop policy if exists vp_admin_all on public.vendor_passes;
create policy vp_self_read   on public.vendor_passes for select using (public.owns_vendor(vendor_id) or public.is_admin());
create policy vp_self_insert on public.vendor_passes for insert with check (public.owns_vendor(vendor_id));
create policy vp_self_delete on public.vendor_passes for delete using (public.owns_vendor(vendor_id));
create policy vp_admin_all   on public.vendor_passes for all    using (public.is_admin()) with check (public.is_admin());

create table if not exists public.vendor_pass_people (
  id            uuid primary key default gen_random_uuid(),
  pass_id       uuid not null references public.vendor_passes(id) on delete cascade,
  name          text not null,
  photo         jsonb,
  status        text not null default 'pending' check (status in ('pending','approved','rejected')),
  reject_reason text,
  decided_at    timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists vendor_pass_people_pass_idx on public.vendor_pass_people(pass_id);

alter table public.vendor_pass_people enable row level security;
drop policy if exists vpp_self_all on public.vendor_pass_people;
drop policy if exists vpp_admin_all on public.vendor_pass_people;
-- A vendor may manage people rows under a pass they own (subquery, since
-- ownership lives one level up on vendor_passes, not on this table directly).
create policy vpp_self_all on public.vendor_pass_people for all using (
  exists (select 1 from public.vendor_passes vp where vp.id = pass_id and public.owns_vendor(vp.vendor_id))
) with check (
  exists (select 1 from public.vendor_passes vp where vp.id = pass_id and public.owns_vendor(vp.vendor_id))
);
create policy vpp_admin_all on public.vendor_pass_people for all using (public.is_admin()) with check (public.is_admin());

-- =============================================================================
-- End migration 0010. This closes out the original migration-0002 scope —
-- everything that started this Phase 2 migration is now wired, minus
-- Storage buckets (docs/payment files/pass photos are still base64 jsonb).
-- =============================================================================
