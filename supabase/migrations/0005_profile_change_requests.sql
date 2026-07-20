-- Sulap Artisan — migration 0005: profile change requests
-- =============================================================================
-- Backs rule 17 (Vendor Profile's request-approval queue): a vendor's edits to
-- "Vendor details" (business/owner/category/email/phone/plate/desc) and to an
-- already-complete E-Invoice & bank details record aren't written directly —
-- they queue here for admin review (Approve applies the change to `vendors`;
-- Reject just marks the request decided, vendor record untouched).
--
-- NOT used for a vendor's *first-ever* E-Invoice completion (batch 2h — that
-- writes straight to `vendors.einvoice`, since there's nothing yet to
-- "change") or for product photos / social+power supply (never request-gated
-- — see batches 2i and this one).
--
-- HOW TO RUN: Supabase Dashboard → SQL Editor → paste this whole file → Run.
-- Safe to re-run (IF NOT EXISTS / DROP POLICY IF EXISTS).
-- =============================================================================

create table if not exists public.profile_change_requests (
  id           uuid primary key default gen_random_uuid(),
  vendor_id    uuid not null references public.vendors(id) on delete cascade,
  section      text not null check (section in ('details','einvoice')),
  changes      jsonb not null,
  status       text not null default 'pending' check (status in ('pending','approved','rejected')),
  submitted_at timestamptz not null default now(),
  decided_at   timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists profile_change_requests_vendor_idx on public.profile_change_requests(vendor_id);

alter table public.profile_change_requests enable row level security;
drop policy if exists pcr_self_read on public.profile_change_requests;
drop policy if exists pcr_self_insert on public.profile_change_requests;
drop policy if exists pcr_admin_all on public.profile_change_requests;

-- A vendor reads and submits only their own requests; no self-update policy
-- (there's no vendor-side "cancel a pending request" feature) — only admin
-- can transition status pending -> approved/rejected.
create policy pcr_self_read   on public.profile_change_requests for select using (public.owns_vendor(vendor_id) or public.is_admin());
create policy pcr_self_insert on public.profile_change_requests for insert with check (public.owns_vendor(vendor_id) and status = 'pending');
create policy pcr_admin_all   on public.profile_change_requests for all    using (public.is_admin()) with check (public.is_admin());

-- =============================================================================
-- End migration 0005.
-- =============================================================================
