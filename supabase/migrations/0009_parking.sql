-- Sulap Artisan — migration 0009: parking
-- =============================================================================
-- Backs the Parking tab's per-day serial numbers. The mock shape is a flat
-- map keyed by a composite string `${vendorId}-${eventId}-${dayIndex}` — this
-- normalizes those three dimensions into real columns with a composite
-- primary key instead of trying to preserve the literal string.
--
-- A vendor reads their own rows (their portal shows their assigned serial per
-- day); only admin writes.
--
-- HOW TO RUN: Supabase Dashboard → SQL Editor → paste this whole file → Run.
-- Safe to re-run (IF NOT EXISTS / DROP POLICY IF EXISTS).
-- =============================================================================

create table if not exists public.parking (
  vendor_id  uuid not null references public.vendors(id) on delete cascade,
  event_id   uuid not null references public.events(id) on delete cascade,
  day_index  int  not null,
  serial     text not null default '',
  updated_at timestamptz not null default now(),
  primary key (vendor_id, event_id, day_index)
);

alter table public.parking enable row level security;
drop policy if exists parking_self_read on public.parking;
drop policy if exists parking_admin_all on public.parking;
create policy parking_self_read on public.parking for select using (public.owns_vendor(vendor_id) or public.is_admin());
create policy parking_admin_all on public.parking for all    using (public.is_admin()) with check (public.is_admin());

-- =============================================================================
-- End migration 0009.
-- =============================================================================
