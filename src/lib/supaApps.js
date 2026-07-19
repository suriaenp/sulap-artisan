import { supabase } from './supabase';

// Bridges the Supabase `applications` table and the app's camelCase event-
// application shape. `remote: true` is the real-vs-demo discriminator, same
// convention as supaEvents — only rows that round-tripped through Supabase
// carry it, so admin decisions on seeded demo applications stay local-only
// while decisions on real ones persist.
export function rowToApp(row) {
  if (!row) return null;
  return {
    id: row.id,
    remote: true,
    vendorId: row.vendor_id,
    eventId: row.event_id,
    status: row.status,
    shared: !!row.shared,
    partners: row.partners || [],
    tier: row.tier || null,
    appliedAt: row.applied_at,
  };
}

export const isRealApp = (a) => !!a?.remote;

// Admin session only (RLS applications_admin_all / _self_read + is_admin()).
export async function fetchAllApps() {
  const { data, error } = await supabase.from('applications').select('*');
  if (error) throw error;
  return (data || []).map(rowToApp);
}

// A vendor's own applications — readable by that vendor's session.
export async function fetchAppsByVendorId(vendorId) {
  const { data, error } = await supabase.from('applications').select('*').eq('vendor_id', vendorId);
  if (error) throw error;
  return (data || []).map(rowToApp);
}

// Inserted by the applying vendor's own session (RLS applications_self_insert:
// owns_vendor(vendor_id)). Status is the column default 'pending'. `partners`
// is a uuid[] — callers must pass only REAL vendor ids (demo partner ids like
// 'v4' aren't UUIDs and would be rejected by Postgres).
export async function insertApp({ vendorId, eventId, shared, partners, tier }) {
  const { data, error } = await supabase.from('applications').insert({
    vendor_id: vendorId,
    event_id: eventId,
    shared: !!shared,
    partners: partners || [],
    tier: tier || null,
  }).select().single();
  if (error) throw error;
  return rowToApp(data);
}

export async function updateAppStatus(id, status) {
  const { error } = await supabase.from('applications').update({ status }).eq('id', id);
  if (error) throw error;
}

export async function deleteApp(id) {
  const { error } = await supabase.from('applications').delete().eq('id', id);
  if (error) throw error;
}
