-- Sulap Artisan — migration 0006: refunds + activity log
-- =============================================================================
-- Two of the remaining migration-0002-scope tables, done together since both
-- are small and low-risk (see supaPayments.js / supaActivity.js for the app
-- side).
--
-- HOW TO RUN: Supabase Dashboard → SQL Editor → paste this whole file → Run.
-- Safe to re-run (IF NOT EXISTS / DROP POLICY IF EXISTS).
-- =============================================================================

-- ── Refunds (one per vendor+event, mirrors payments/deposits) ───────────────
-- Only ever written by admin (Arrange refund → Modals.jsx RefundModal, then
-- Close case → AdminDashboard.jsx) — no vendor-side write path exists in the
-- app, but a vendor reads their own row to see refund status on their
-- Payments tab.
create table if not exists public.refunds (
  vendor_id   uuid not null references public.vendors(id) on delete cascade,
  event_id    uuid not null references public.events(id) on delete cascade,
  ref_code    text,
  refund_date date,
  refund_time text,
  status      text not null default 'completed' check (status in ('completed','closed')),
  updated_at  timestamptz not null default now(),
  primary key (vendor_id, event_id)
);
alter table public.refunds enable row level security;
drop policy if exists refunds_self_read on public.refunds;
drop policy if exists refunds_admin_all on public.refunds;
create policy refunds_self_read on public.refunds for select using (public.owns_vendor(vendor_id) or public.is_admin());
create policy refunds_admin_all on public.refunds for all    using (public.is_admin()) with check (public.is_admin());

-- ── Activity log (append-only audit trail) ──────────────────────────────────
-- Written by BOTH admin and vendor sessions (every logActivity() call in the
-- app, centralized in store.jsx) but only ever READ by the admin console's
-- Activity tab — no vendor-facing screen shows this log. Insert is allowed
-- for any authenticated user (not gated to is_admin()) specifically because
-- vendor-side actions (apply, submit E-Invoice, register, etc.) also log —
-- adding a per-row owner check would require threading a vendor_id through
-- every one of ~20 call sites across 3 files for a plain audit trail, which
-- isn't proportionate here; forging a log entry isn't a privilege escalation
-- (it grants no access), it would just be noise in an internal report.
create table if not exists public.activity (
  id         uuid primary key default gen_random_uuid(),
  who        text not null,
  what       text not null,
  tint       text not null default '#F3E4CC',
  icon       text not null default 'check',
  type       text not null default 'admin' check (type in ('admin','vendor')),
  created_at timestamptz not null default now()
);
create index if not exists activity_created_at_idx on public.activity(created_at desc);
alter table public.activity enable row level security;
drop policy if exists activity_admin_read on public.activity;
drop policy if exists activity_authed_insert on public.activity;
create policy activity_admin_read     on public.activity for select using (public.is_admin());
create policy activity_authed_insert  on public.activity for insert with check ((select auth.uid()) is not null);

-- =============================================================================
-- End migration 0006.
-- =============================================================================
