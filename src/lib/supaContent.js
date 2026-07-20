import { supabase } from './supabase';

// Single-row jsonb blob (see migration 0007) — the app's `state.content` is
// one flat object with no per-field granularity even in the mock (there's no
// MERGE_CONTENT reducer case, just the generic `set({content:...})`), so this
// mirrors that shape 1:1 rather than splitting into columns.

// Public (incl. anon) read — PublicHome.jsx renders this with no session.
// Returns null if the admin has never saved (no row yet, or an empty `data`),
// so the caller can keep INITIAL_CONTENT's defaults instead of blanking the
// public site out on a fresh project.
export async function fetchContent() {
  const { data, error } = await supabase.from('site_content').select('data').eq('id', 1).maybeSingle();
  if (error) throw error;
  return data && data.data && Object.keys(data.data).length ? data.data : null;
}

export async function updateContent(content) {
  const { error } = await supabase.from('site_content')
    .upsert({ id: 1, data: content, updated_at: new Date().toISOString() }, { onConflict: 'id' });
  if (error) throw error;
}
