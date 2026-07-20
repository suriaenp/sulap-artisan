-- Sulap Artisan — migration 0012: Storage bucket for payment files
-- =============================================================================
-- Second Storage bucket — payment advice (vendor-uploaded, x2) + invoice and
-- receipt (admin-uploaded). Same path convention as vendor-docs: files land
-- at `${vendor_auth_uid}/${timestamp}-${filename}` for ALL four fields, even
-- the admin-uploaded ones — an invoice is filed under the VENDOR's auth uid
-- (not the acting admin's), so the vendor can still read their own invoice/
-- receipt afterward via the owner policy, while admin writes regardless of
-- whose folder via the is_admin() policy below.
--
-- HOW TO RUN: Supabase Dashboard → SQL Editor → paste this whole file → Run.
-- Safe to re-run (ON CONFLICT / DROP POLICY IF EXISTS).
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('payment-files', 'payment-files', false)
on conflict (id) do nothing;

drop policy if exists payment_files_owner_all on storage.objects;
drop policy if exists payment_files_admin_all on storage.objects;

create policy payment_files_owner_all on storage.objects for all
  using (bucket_id = 'payment-files' and (select auth.uid())::text = (storage.foldername(name))[1])
  with check (bucket_id = 'payment-files' and (select auth.uid())::text = (storage.foldername(name))[1]);

create policy payment_files_admin_all on storage.objects for all
  using (bucket_id = 'payment-files' and public.is_admin())
  with check (bucket_id = 'payment-files' and public.is_admin());

-- =============================================================================
-- End migration 0012. Vendor Pass photos get their own bucket in the next
-- migration, closing out the Storage-bucket work.
-- =============================================================================
