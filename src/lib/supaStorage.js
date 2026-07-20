import { supabase } from './supabase';

// Shared helpers for the private Storage buckets (vendor-docs, and more to
// follow: payment-files, pass-photos) — replaces the old base64-in-jsonb
// pattern for real files. Every bucket uses the same path convention,
// `${ownerAuthUid}/${timestamp}-${filename}`, so each bucket's RLS policy can
// check the path's first segment against auth.uid() directly.
//
// A signed URL is generated once at upload time and stored in the DB
// (SIGNED_URL_TTL below, currently 1 year) rather than re-signed on every
// read. That's simpler than making every vendor/payment/pass-app fetch
// async just to resolve fresh signed URLs — the trade-off is the URL isn't
// regenerated if the file needs to stay reachable past that window;
// replacing the file (which every "Replace" button already does) is the
// practical workaround. Flagged as a known limitation, not silently glossed
// over — tightening this to per-render signing is a reasonable follow-up if
// ever needed.
const SIGNED_URL_TTL = 60 * 60 * 24 * 365; // 1 year, in seconds

// `ownerAuthUid` must be the auth.users id that owns the destination path
// under RLS — for a vendor's own upload that's their own session's uid; for
// an admin uploading on behalf of a vendor (e.g. an invoice), it's that
// vendor's `userId`, since the bucket's admin policy allows writing under
// any path when the acting session is_admin().
export async function uploadPrivateFile(bucket, ownerAuthUid, file) {
  const path = `${ownerAuthUid}/${Date.now()}-${file.name}`;
  const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, { upsert: false });
  if (upErr) throw upErr;
  const { data, error: signErr } = await supabase.storage.from(bucket).createSignedUrl(path, SIGNED_URL_TTL);
  if (signErr) throw signErr;
  return { id: 'f' + Date.now() + Math.random().toString(36).slice(2, 7), name: file.name, path, url: data.signedUrl };
}

// For flows where the file was already read into a local preview object via
// fileToPhoto() (a data: URL) before the point where it's actually persisted
// — Vendor Pass photos are picked at form-fill time but only uploaded at
// submit time. Re-encodes the same bytes losslessly (fetch().blob() on a
// data: URL is exact, no quality loss) rather than restructuring the picker
// to hold onto the raw File across that gap.
export async function uploadPrivatePhoto(bucket, ownerAuthUid, photo) {
  const res = await fetch(photo.url);
  const blob = await res.blob();
  const file = new File([blob], photo.name, { type: blob.type });
  return uploadPrivateFile(bucket, ownerAuthUid, file);
}

// Best-effort — a failed delete here shouldn't block the caller's own
// mutation (the DB record is the source of truth for what's "current";
// an orphaned Storage object is wasted space, not a correctness problem).
export async function removePrivateFile(bucket, path) {
  if (!path) return;
  try { await supabase.storage.from(bucket).remove([path]); }
  catch (e) { console.error(`Failed to remove ${bucket}/${path}:`, e); }
}
