-- Sulap Artisan — migration 0008: offences / offense types (Compliance)
-- =============================================================================
-- Two tables: `offense_types` (admin-extensible dictionary — the mock's
-- OFFENSE_TYPES was a plain JS object keyed by slug, admins can add/remove
-- types at runtime) and `offenses` (log entries, FK'd to a type). A vendor
-- reads their own offences + all offense types (their Compliance tab shows
-- their own record); only admin writes either table.
--
-- Seeds the 6 default offense types from mockData.js's OFFENSE_TYPES so the
-- app's existing labels/colors exist from the start (same idea as the
-- categories seed step in supabase/README.md) — safe to re-run, `on conflict
-- do nothing` won't touch a type an admin has since edited... though note
-- the app has no "edit a type" feature, only add/remove, so this is really
-- just idempotent insert protection, not a real edit-preservation concern.
--
-- HOW TO RUN: Supabase Dashboard → SQL Editor → paste this whole file → Run.
-- Safe to re-run (IF NOT EXISTS / DROP POLICY IF EXISTS / ON CONFLICT).
-- =============================================================================

create table if not exists public.offense_types (
  id    text primary key,   -- slug, e.g. 'late_open', or 'ot<timestamp>' for admin-added ones
  label text not null,
  color text not null,
  bg    text not null
);
alter table public.offense_types enable row level security;
drop policy if exists offense_types_read on public.offense_types;
drop policy if exists offense_types_write on public.offense_types;
-- Public read (incl. anon) — harmless label/color dictionary, and a vendor's
-- own Compliance tab needs it to render their offence tags.
create policy offense_types_read  on public.offense_types for select using (true);
create policy offense_types_write on public.offense_types for all    using (public.is_admin()) with check (public.is_admin());

insert into public.offense_types (id, label, color, bg) values
  ('late_open',    'Late opening',                   '#B7770D', '#FEF8EC'),
  ('early_close',  'Early closing',                  '#B03A2E', '#FDEEEC'),
  ('late_pay',     'Late payment',                   '#7C3AED', '#EDE9FE'),
  ('cleanup',      'Poor booth cleanup',              '#2D6A4F', '#E8F5F0'),
  ('no_show',      'No-show / last-minute withdraw', '#9A5B26', '#F3E4CC'),
  ('unsanctioned', 'Unsanctioned selling',           '#1D4ED8', '#DBEAFE')
on conflict (id) do nothing;

create table if not exists public.offenses (
  id         uuid primary key default gen_random_uuid(),
  vendor_id  uuid not null references public.vendors(id) on delete cascade,
  event_id   uuid not null references public.events(id) on delete cascade,
  type       text not null references public.offense_types(id) on delete restrict,
  photos     jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists offenses_vendor_idx on public.offenses(vendor_id);
create index if not exists offenses_event_idx  on public.offenses(event_id);

alter table public.offenses enable row level security;
drop policy if exists offenses_self_read on public.offenses;
drop policy if exists offenses_admin_all on public.offenses;
create policy offenses_self_read on public.offenses for select using (public.owns_vendor(vendor_id) or public.is_admin());
create policy offenses_admin_all on public.offenses for all    using (public.is_admin()) with check (public.is_admin());

-- =============================================================================
-- End migration 0008.
-- =============================================================================
