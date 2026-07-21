import { supabase } from './supabase';

// Admin-configurable list of required/optional vendor document types (see
// migration 0014) — public read (a vendor's Documents tab needs the current
// list), admin-only write.

function rowToDocType(row) {
  return { id: row.id, label: row.label, required: row.required, sortOrder: row.sort_order };
}

export async function fetchDocTypes() {
  const { data, error } = await supabase.from('vendor_doc_types').select('*').order('sort_order');
  if (error) throw error;
  return (data || []).map(rowToDocType);
}

export async function insertDocType({ id, label, required, sortOrder }) {
  const { error } = await supabase.from('vendor_doc_types').insert({ id, label, required, sort_order: sortOrder });
  if (error) throw error;
}

export async function deleteDocType(id) {
  const { error } = await supabase.from('vendor_doc_types').delete().eq('id', id);
  if (error) throw error;
}

export async function updateDocTypeRequired(id, required) {
  const { error } = await supabase.from('vendor_doc_types').update({ required }).eq('id', id);
  if (error) throw error;
}
