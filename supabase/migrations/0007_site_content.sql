-- Sulap Artisan — migration 0007: site content
-- =============================================================================
-- Backs the admin Content tab / public home page copy+images (`state.content`
-- in mockData.js — hero/coming-soon/why-join/gallery/CTA/footer text+images
-- plus the rich-text market terms). One flat object today (no per-field
-- reducer case even in the mock — the whole thing is read/written together),
-- so this is modeled as a single-row jsonb blob rather than one column per
-- field, same idea as vendors.einvoice/docs.
--
-- Public-read (incl. anon) — PublicHome.jsx renders this with no auth at all,
-- same as categories/events. Admin-write-only.
--
-- HOW TO RUN: Supabase Dashboard → SQL Editor → paste this whole file → Run.
-- Safe to re-run (IF NOT EXISTS / DROP POLICY IF EXISTS).
-- =============================================================================

create table if not exists public.site_content (
  id         int primary key default 1 check (id = 1),  -- singleton row
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.site_content enable row level security;
drop policy if exists site_content_read on public.site_content;
drop policy if exists site_content_write on public.site_content;
create policy site_content_read  on public.site_content for select using (true);
create policy site_content_write on public.site_content for all    using (public.is_admin()) with check (public.is_admin());

-- =============================================================================
-- End migration 0007. No seed row inserted — the app treats an empty/missing
-- row as "nothing saved yet" and keeps its own INITIAL_CONTENT defaults until
-- an admin hits Save once (see supaContent.js).
-- =============================================================================
