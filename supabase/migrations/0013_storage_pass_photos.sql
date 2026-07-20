-- Sulap Artisan — migration 0013: Storage bucket for Vendor Pass photos
-- =============================================================================
-- Third and last Storage bucket. Pass-holder photos are used for at-the-door
-- identity verification (Vendor Pass grants after-hours mall entry), so
-- unlike vendor docs/payment files there is no compression anywhere in this
-- pipeline — full fidelity is preserved end to end (see supaVendorPasses.js
-- and the submit-time upload step in VendorDashboard.jsx).
--
-- Same path convention as the other two buckets:
-- `${vendor_auth_uid}/${timestamp}-${filename}`.
--
-- HOW TO RUN: Supabase Dashboard → SQL Editor → paste this whole file → Run.
-- Safe to re-run (ON CONFLICT / DROP POLICY IF EXISTS).
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('pass-photos', 'pass-photos', false)
on conflict (id) do nothing;

drop policy if exists pass_photos_owner_all on storage.objects;
drop policy if exists pass_photos_admin_all on storage.objects;

create policy pass_photos_owner_all on storage.objects for all
  using (bucket_id = 'pass-photos' and (select auth.uid())::text = (storage.foldername(name))[1])
  with check (bucket_id = 'pass-photos' and (select auth.uid())::text = (storage.foldername(name))[1]);

create policy pass_photos_admin_all on storage.objects for all
  using (bucket_id = 'pass-photos' and public.is_admin())
  with check (bucket_id = 'pass-photos' and public.is_admin());

-- =============================================================================
-- End migration 0013. This closes out the Storage-bucket work — every file
-- type in the app (docs, payment files, pass photos) now lives in a real
-- private bucket instead of base64-in-jsonb.
-- =============================================================================
