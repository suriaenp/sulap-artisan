import { supabase } from './supabase';

// Bridges `offense_types` (public, admin-extensible dictionary) and
// `offenses` (log entries FK'd to a type) — see migration 0008.

export async function fetchOffenseTypes() {
  const { data, error } = await supabase.from('offense_types').select('*');
  if (error) throw error;
  return Object.fromEntries((data || []).map(r => [r.id, { label: r.label, color: r.color, bg: r.bg }]));
}

export async function insertOffenseType(id, type) {
  const { error } = await supabase.from('offense_types').insert({ id, label: type.label, color: type.color, bg: type.bg });
  if (error) throw error;
}

export async function deleteOffenseType(id) {
  const { error } = await supabase.from('offense_types').delete().eq('id', id);
  if (error) throw error;
}

function rowToOffense(row) {
  return { id: row.id, vendorId: row.vendor_id, eventId: row.event_id, type: row.type, photos: row.photos || [], remote: true };
}

export async function fetchAllOffenses() {
  const { data, error } = await supabase.from('offenses').select('*');
  if (error) throw error;
  return (data || []).map(rowToOffense);
}

export async function fetchOffensesByVendorId(vendorId) {
  const { data, error } = await supabase.from('offenses').select('*').eq('vendor_id', vendorId);
  if (error) throw error;
  return (data || []).map(rowToOffense);
}

export async function insertOffense({ vendorId, eventId, type, photos = [] }) {
  const { data, error } = await supabase.from('offenses')
    .insert({ vendor_id: vendorId, event_id: eventId, type, photos })
    .select().single();
  if (error) throw error;
  return rowToOffense(data);
}

export async function updateOffensePhotos(id, photos) {
  const { error } = await supabase.from('offenses').update({ photos }).eq('id', id);
  if (error) throw error;
}

export async function deleteOffense(id) {
  const { error } = await supabase.from('offenses').delete().eq('id', id);
  if (error) throw error;
}
