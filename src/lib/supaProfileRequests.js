import { supabase } from './supabase';
import { fmtShort } from './helpers';

// Bridges the Supabase `profile_change_requests` table and the app's existing
// `state.profileRequests` shape (unchanged since Phase 1 — see rule 17).
// `remote: true` is the same real-vs-demo discriminator convention as events/
// applications (rowToEvent/rowToApp) — requests have no natural FK to lean on.
export function rowToRequest(row) {
  if (!row) return null;
  return {
    id: row.id,
    vendorId: row.vendor_id,
    section: row.section,
    changes: row.changes,
    submittedAt: fmtShort(row.submitted_at),
    status: row.status,
    remote: true,
  };
}

export async function insertProfileRequest({ vendorId, section, changes }) {
  const { data, error } = await supabase.from('profile_change_requests')
    .insert({ vendor_id: vendorId, section, changes })
    .select().single();
  if (error) throw error;
  return rowToRequest(data);
}

// Admin sessions pull every request (RLS: pcr_admin_all via is_admin()).
export async function fetchAllProfileRequests() {
  const { data, error } = await supabase.from('profile_change_requests').select('*');
  if (error) throw error;
  return (data || []).map(rowToRequest);
}

// A vendor's own login pulls just their own, so a pending banner survives a
// refresh (RLS: pcr_self_read via owns_vendor()).
export async function fetchProfileRequestsByVendor(vendorId) {
  const { data, error } = await supabase.from('profile_change_requests').select('*').eq('vendor_id', vendorId);
  if (error) throw error;
  return (data || []).map(rowToRequest);
}

export async function updateProfileRequestStatus(id, status) {
  const { error } = await supabase.from('profile_change_requests')
    .update({ status, decided_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}
