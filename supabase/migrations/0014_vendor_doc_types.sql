-- Sulap Artisan — migration 0014: admin-configurable vendor document types
-- =============================================================================
-- Previously "SSM Registration" (required) and "Halal / Food Cert" (optional)
-- were hardcoded fields in VendorDashboard.jsx — no way for admin to add a
-- new required document type or retire one without a code change. This makes
-- the list itself admin-editable, same pattern as offense_types (migration
-- 0008): a public-read, admin-write dictionary.
--
-- Public read — a vendor's own Documents tab needs the current list to know
-- what to ask for. Seeds the existing two defaults so nothing changes for
-- vendors until an admin actually edits the list.
--
-- HOW TO RUN: Supabase Dashboard → SQL Editor → paste this whole file → Run.
-- Safe to re-run (IF NOT EXISTS / DROP POLICY IF EXISTS / ON CONFLICT).
-- =============================================================================

create table if not exists public.vendor_doc_types (
  id         text primary key,   -- slug, e.g. 'ssm', 'halal', or 'dt<timestamp>' for admin-added
  label      text not null,
  required   boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.vendor_doc_types enable row level security;
drop policy if exists vendor_doc_types_read on public.vendor_doc_types;
drop policy if exists vendor_doc_types_write on public.vendor_doc_types;
create policy vendor_doc_types_read  on public.vendor_doc_types for select using (true);
create policy vendor_doc_types_write on public.vendor_doc_types for all    using (public.is_admin()) with check (public.is_admin());

insert into public.vendor_doc_types (id, label, required, sort_order) values
  ('ssm',   'SSM Registration',    true,  1),
  ('halal', 'Halal / Food Cert',   false, 2)
on conflict (id) do nothing;

-- =============================================================================
-- End migration 0014. Existing vendor rows keep their docs under the old
-- {ssm, halal, extra} shape until they next save — the app normalizes both
-- shapes at render time (see normalizeDocs() in lib/helpers.js), so no data
-- migration/backfill is needed here.
-- =============================================================================
