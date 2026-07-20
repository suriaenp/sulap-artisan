import { supabase } from './supabase';

// Mirrors the app's flat-map shape (key `${vendorId}-${eventId}-${dayIndex}`
// → serial string) — see migration 0009 for why the key is normalized into
// real columns at the DB layer while staying a flat map in the app.

const rowsToMap = (rows) => Object.fromEntries(
  (rows || []).map(r => [`${r.vendor_id}-${r.event_id}-${r.day_index}`, r.serial || ''])
);

export async function fetchAllParking() {
  const { data, error } = await supabase.from('parking').select('*');
  if (error) throw error;
  return rowsToMap(data);
}

export async function fetchParkingByVendorId(vendorId) {
  const { data, error } = await supabase.from('parking').select('*').eq('vendor_id', vendorId);
  if (error) throw error;
  return rowsToMap(data);
}

export async function upsertParkingSerial(vendorId, eventId, dayIndex, serial) {
  const { error } = await supabase.from('parking').upsert({
    vendor_id: vendorId,
    event_id: eventId,
    day_index: dayIndex,
    serial,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'vendor_id,event_id,day_index' });
  if (error) throw error;
}
