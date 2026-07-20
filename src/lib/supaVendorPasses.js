import { supabase } from './supabase';
import { fmtShort } from './helpers';

// Bridges `vendor_passes` + `vendor_pass_people` (see migration 0010) and the
// app's existing nested shape: one pass application per vendor+event, each
// with its own array of independently-approved pass holders.

function rowToPerson(row) {
  return {
    id: row.id,
    name: row.name,
    photo: row.photo || null,
    status: row.status,
    rejectReason: row.reject_reason || null,
    decidedAt: row.decided_at ? fmtShort(row.decided_at) : null,
  };
}

function rowToPass(row) {
  return {
    id: row.id,
    vendorId: row.vendor_id,
    eventId: row.event_id,
    extraApproved: row.extra_approved || 0,
    boothNumber: row.booth_number || '',
    submittedAt: fmtShort(row.submitted_at),
    people: (row.vendor_pass_people || []).map(rowToPerson),
    remote: true,
  };
}

export async function fetchAllPassApps() {
  const { data, error } = await supabase.from('vendor_passes').select('*, vendor_pass_people(*)');
  if (error) throw error;
  return (data || []).map(rowToPass);
}

export async function fetchPassAppsByVendorId(vendorId) {
  const { data, error } = await supabase.from('vendor_passes').select('*, vendor_pass_people(*)').eq('vendor_id', vendorId);
  if (error) throw error;
  return (data || []).map(rowToPass);
}

// First-time application — one pass row + N person rows in one call.
export async function insertPassApp({ vendorId, eventId, people }) {
  const { data: pass, error: e1 } = await supabase.from('vendor_passes')
    .insert({ vendor_id: vendorId, event_id: eventId })
    .select().single();
  if (e1) throw e1;
  const { data: peopleRows, error: e2 } = await supabase.from('vendor_pass_people')
    .insert(people.map(p => ({ pass_id: pass.id, name: p.name, photo: p.photo })))
    .select();
  if (e2) throw e2;
  return rowToPass({ ...pass, vendor_pass_people: peopleRows });
}

// Add one more pass-holder to an existing application (self-service slot or
// an admin-granted extra slot being filled in) — always starts 'pending'.
export async function insertPassPerson(passId, person) {
  const { data, error } = await supabase.from('vendor_pass_people')
    .insert({ pass_id: passId, name: person.name, photo: person.photo })
    .select().single();
  if (error) throw error;
  return rowToPerson(data);
}

// Vendor edits + resubmits one pass holder — resets just that person to
// pending, same as the mock's behavior.
export async function updatePassPerson(personId, { name, photo }) {
  const { error } = await supabase.from('vendor_pass_people')
    .update({ name, photo, status: 'pending', reject_reason: null, decided_at: null })
    .eq('id', personId);
  if (error) throw error;
}

// Admin decides one pass holder.
export async function decidePassPerson(personId, status, rejectReason = null) {
  const { error } = await supabase.from('vendor_pass_people')
    .update({ status, reject_reason: rejectReason, decided_at: new Date().toISOString() })
    .eq('id', personId);
  if (error) throw error;
}

export async function updatePassBooth(passId, boothNumber) {
  const { error } = await supabase.from('vendor_passes').update({ booth_number: boothNumber }).eq('id', passId);
  if (error) throw error;
}

export async function grantExtraPassSlots(passId, extraApproved) {
  const { error } = await supabase.from('vendor_passes').update({ extra_approved: extraApproved }).eq('id', passId);
  if (error) throw error;
}

// "Reset my Vendor Pass (testing)" — cascades to vendor_pass_people via FK.
export async function deletePassApp(passId) {
  const { error } = await supabase.from('vendor_passes').delete().eq('id', passId);
  if (error) throw error;
}
