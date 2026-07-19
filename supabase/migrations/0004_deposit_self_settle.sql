-- Sulap Artisan — migration 0004: let a vendor's own payment settle their deposit
-- =============================================================================
-- Gap discovered while wiring payments/deposits (Phase 2 batch 2g): when a
-- vendor uploads a payment advice, the auto-scan (payScan.scanAndRecord) can
-- record a fully-paid total — and a fully-paid total that included the
-- one-time RM100 deposit also marks deposits.status = 'paid', from the
-- VENDOR's session. Migration 0001 made deposits admin-write-only, so that
-- write would always fail RLS.
--
-- Narrow allowance, not a general write grant: a vendor may insert/update
-- ONLY their own deposit row, and ONLY to status = 'paid' — never back to
-- 'unpaid', never to 'refunded' (refunds stay admin-only).
--
-- HOW TO RUN: Supabase Dashboard → SQL Editor → paste this whole file → Run.
-- Safe to re-run (DROP POLICY IF EXISTS first).
-- =============================================================================

drop policy if exists deposits_self_settle_insert on public.deposits;
drop policy if exists deposits_self_settle_update on public.deposits;

create policy deposits_self_settle_insert on public.deposits
  for insert with check (public.owns_vendor(vendor_id) and status = 'paid');

create policy deposits_self_settle_update on public.deposits
  for update using (public.owns_vendor(vendor_id))
  with check (public.owns_vendor(vendor_id) and status = 'paid');
