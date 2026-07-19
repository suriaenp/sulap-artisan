-- Sulap Artisan — initial schema (migration 0001)
-- =============================================================================
-- Covers the security-critical spine: identity + roles, vendors, events,
-- categories, applications, payments, deposits. Remaining tables (offences,
-- vendor passes, parking, profile-change requests, activity log, site content)
-- land in migration 0002 alongside their feature wiring.
--
-- HOW TO RUN: Supabase Dashboard → SQL Editor → paste this whole file → Run.
-- Safe to re-run (idempotent: IF NOT EXISTS / CREATE OR REPLACE / DROP POLICY).
-- =============================================================================

-- ── Roles & identity ────────────────────────────────────────────────────────
-- Every login (vendor OR admin) is a row in Supabase's built-in auth.users.
-- public.profiles mirrors it 1:1 with an app role. A self-service signup is
-- ALWAYS a 'vendor' — the trigger below hardcodes that so a malicious signup
-- can't request role:'super' via metadata (privilege-escalation guard).
-- Admins are promoted manually (see supabase/README.md).

create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  role       text not null default 'vendor' check (role in ('vendor','staff','super')),
  name       text not null default '',
  avatar_url text,
  created_at timestamptz not null default now()
);

-- Create the matching profile row whenever a new auth user signs up. Role is
-- forced to 'vendor' here regardless of any client-supplied metadata.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', ''), 'vendor')
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Role-check helpers. SECURITY DEFINER so they read profiles as the table owner
-- and bypass profiles' own RLS — this is what prevents infinite recursion when
-- other tables' policies call is_admin() (which would otherwise re-trigger
-- profiles' policies, which might call is_admin() again, ...).
create or replace function public.is_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role in ('staff','super')
  );
$$;

create or replace function public.is_super()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'super'
  );
$$;

alter table public.profiles enable row level security;
drop policy if exists profiles_self_read on public.profiles;
drop policy if exists profiles_admin_read on public.profiles;
drop policy if exists profiles_self_update on public.profiles;
-- You can always read your own profile; admins can read everyone's.
create policy profiles_self_read  on public.profiles for select using (id = (select auth.uid()));
create policy profiles_admin_read on public.profiles for select using (public.is_admin());
-- You can update your own name/avatar. NOTE: role is intentionally updatable
-- only via SQL/service-role (no policy grants role changes), so no user can
-- escalate their own role through the API.
create policy profiles_self_update on public.profiles for update using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- ── Categories (public read, admin write) ───────────────────────────────────
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  icon        text not null default 'folder',
  description text not null default '',
  created_at  timestamptz not null default now()
);
alter table public.categories enable row level security;
drop policy if exists categories_read on public.categories;
drop policy if exists categories_write on public.categories;
create policy categories_read  on public.categories for select using (true);           -- incl. anon: shown on public site
create policy categories_write on public.categories for all    using (public.is_admin()) with check (public.is_admin());

-- ── Events (public read, admin write) ───────────────────────────────────────
create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  location    text not null default 'Suria Sabah Mall',
  date_range  text,
  days        int  not null default 1,
  fnb         numeric(10,2) not null default 0,
  nonfnb      numeric(10,2) not null default 0,
  start_time  text,
  end_time    text,
  last_app    date,
  start_date  date,
  end_date    date,
  img         text,
  created_at  timestamptz not null default now()
);
alter table public.events enable row level security;
drop policy if exists events_read on public.events;
drop policy if exists events_write on public.events;
create policy events_read  on public.events for select using (true);                    -- incl. anon: public "Coming Soon"
create policy events_write on public.events for all    using (public.is_admin()) with check (public.is_admin());

-- ── Vendors ─────────────────────────────────────────────────────────────────
-- One row per vendor business, linked to the auth user that owns it. A vendor
-- reads/updates only their own row; admins see and manage all.
create table if not exists public.vendors (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid unique references auth.users(id) on delete set null,
  business      text not null,
  owner         text not null,
  category      text not null default 'Others',
  email         text not null,
  phone         text,
  ig            text, fb text, tiktok text,
  plate         text,
  status        text not null default 'pending' check (status in ('pending','approved','rejected','suspended')),
  power         text default 'None',
  description   text default '',
  reg_date      text,
  tc_accepted_at text,
  logo          jsonb,               -- { id, name, url } (moves to Storage when uploads are wired)
  product_photos jsonb not null default '[]'::jsonb,
  docs          jsonb not null default '{"ssm":null,"halal":null,"extra":[]}'::jsonb,
  einvoice      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists vendors_user_id_idx on public.vendors(user_id);
create index if not exists vendors_status_idx  on public.vendors(status);

alter table public.vendors enable row level security;
drop policy if exists vendors_self_read on public.vendors;
drop policy if exists vendors_admin_read on public.vendors;
drop policy if exists vendors_self_insert on public.vendors;
drop policy if exists vendors_self_update on public.vendors;
drop policy if exists vendors_admin_all on public.vendors;
-- A vendor sees only their own row; admins see all.
create policy vendors_self_read  on public.vendors for select using (user_id = (select auth.uid()));
create policy vendors_admin_read on public.vendors for select using (public.is_admin());
-- At registration the signed-up user inserts their own vendor row as 'pending'.
create policy vendors_self_insert on public.vendors for insert with check (user_id = (select auth.uid()) and status = 'pending');
-- A vendor can update their own row; admins can update any. (Field-level "locked"
-- rules — business/category/email needing admin approval — are enforced in the
-- app via profile-change requests, migration 0002.)
create policy vendors_self_update on public.vendors for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy vendors_admin_all   on public.vendors for all    using (public.is_admin()) with check (public.is_admin());

-- Reusable predicate: does the current user own this vendor_id?
create or replace function public.owns_vendor(v uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.vendors where id = v and user_id = (select auth.uid()));
$$;

-- ── Applications ────────────────────────────────────────────────────────────
create table if not exists public.applications (
  id         uuid primary key default gen_random_uuid(),
  vendor_id  uuid not null references public.vendors(id) on delete cascade,
  event_id   uuid not null references public.events(id) on delete cascade,
  status     text not null default 'pending' check (status in ('pending','shortlisted','approved','rejected')),
  shared     boolean not null default false,
  partners   uuid[] not null default '{}',
  tier       text check (tier in ('F&B','Non-F&B')),   -- snapshotted at apply time (see payCalc)
  applied_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (vendor_id, event_id)
);
create index if not exists applications_event_idx  on public.applications(event_id);
create index if not exists applications_vendor_idx on public.applications(vendor_id);

alter table public.applications enable row level security;
drop policy if exists applications_self_read on public.applications;
drop policy if exists applications_self_insert on public.applications;
drop policy if exists applications_admin_all on public.applications;
create policy applications_self_read   on public.applications for select using (public.owns_vendor(vendor_id) or public.is_admin());
create policy applications_self_insert on public.applications for insert with check (public.owns_vendor(vendor_id));
create policy applications_admin_all   on public.applications for all    using (public.is_admin()) with check (public.is_admin());

-- ── Payments (one per vendor+event) ─────────────────────────────────────────
create table if not exists public.payments (
  id         uuid primary key default gen_random_uuid(),
  vendor_id  uuid not null references public.vendors(id) on delete cascade,
  event_id   uuid not null references public.events(id) on delete cascade,
  status     text not null default 'unpaid' check (status in ('unpaid','partial','paid')),
  paid       numeric(10,2) not null default 0,
  advice     jsonb, advice2 jsonb, invoice jsonb, receipt jsonb,   -- file refs (Storage later)
  scans      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (vendor_id, event_id)
);
alter table public.payments enable row level security;
drop policy if exists payments_self_read on public.payments;
drop policy if exists payments_self_write on public.payments;
drop policy if exists payments_admin_all on public.payments;
-- Vendor reads their own payment rows and may upload their own advice (write to
-- their own row); admins do everything (record amounts, issue invoices, etc.).
create policy payments_self_read  on public.payments for select using (public.owns_vendor(vendor_id) or public.is_admin());
create policy payments_self_write on public.payments for all    using (public.owns_vendor(vendor_id)) with check (public.owns_vendor(vendor_id));
create policy payments_admin_all  on public.payments for all    using (public.is_admin()) with check (public.is_admin());

-- ── Deposits (one per vendor) ───────────────────────────────────────────────
create table if not exists public.deposits (
  vendor_id   uuid primary key references public.vendors(id) on delete cascade,
  status      text not null default 'unpaid' check (status in ('unpaid','paid','refunded')),
  inv         text,
  pay_date    date,
  refund_date date,
  updated_at  timestamptz not null default now()
);
alter table public.deposits enable row level security;
drop policy if exists deposits_self_read on public.deposits;
drop policy if exists deposits_admin_all on public.deposits;
create policy deposits_self_read on public.deposits for select using (public.owns_vendor(vendor_id) or public.is_admin());
create policy deposits_admin_all on public.deposits for all    using (public.is_admin()) with check (public.is_admin());

-- =============================================================================
-- End migration 0001. After running, follow supabase/README.md to (1) seed the
-- categories + a first super-admin, (2) confirm RLS with the anon vs. a signed-in
-- vendor. Migration 0002 adds offences, passes, parking, requests, activity,
-- site content, and Storage buckets.
-- =============================================================================
