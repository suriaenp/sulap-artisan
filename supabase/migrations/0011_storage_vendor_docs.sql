-- Sulap Artisan — migration 0011: Storage bucket for vendor documents
-- =============================================================================
-- First of the Storage-bucket migrations — moves vendor SSM/Halal/extra
-- documents off base64-in-jsonb onto a real private Supabase Storage bucket.
-- Files land at `${vendor_auth_uid}/${timestamp}-${filename}`, which lets the
-- policies below check the path's first segment against auth.uid() directly
-- (no join back to the vendors table needed for the owner policy).
--
-- Vendor docs are vendor-uploaded only (admin just downloads/reviews them),
-- but admin still gets full access here for consistency with every other
-- bucket/table's "admin can do everything" convention.
--
-- HOW TO RUN: Supabase Dashboard → SQL Editor → paste this whole file → Run.
-- Safe to re-run (ON CONFLICT / DROP POLICY IF EXISTS).
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('vendor-docs', 'vendor-docs', false)
on conflict (id) do nothing;

drop policy if exists vendor_docs_owner_all on storage.objects;
drop policy if exists vendor_docs_admin_all on storage.objects;

create policy vendor_docs_owner_all on storage.objects for all
  using (bucket_id = 'vendor-docs' and (select auth.uid())::text = (storage.foldername(name))[1])
  with check (bucket_id = 'vendor-docs' and (select auth.uid())::text = (storage.foldername(name))[1]);

create policy vendor_docs_admin_all on storage.objects for all
  using (bucket_id = 'vendor-docs' and public.is_admin())
  with check (bucket_id = 'vendor-docs' and public.is_admin());

-- =============================================================================
-- End migration 0011. Payment files and Vendor Pass photos get their own
-- buckets in follow-up migrations (same pattern, next batches).
-- =============================================================================
