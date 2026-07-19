import { supabase } from './supabase';

// Bridges the `profiles` table (role='staff'|'super') and the app's existing
// admin shape (was a hardcoded mock array — see mockData.js's INITIAL_ADMINS).
// Real accounts carry no `password` field and `mustReset` is always false —
// both are mock-only concepts (Supabase Auth owns credentials and its own
// first-login/reset flows now).
export function rowToAdmin(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name || '(unnamed admin)',
    role: row.role, // 'staff' | 'super'
    perms: row.perms || {},
    avatar: row.avatar_url ? { url: row.avatar_url } : null,
    mustReset: false,
  };
}

export async function fetchProfileByUserId(userId) {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data;
}

// Every staff/super profile — lets the Admin Roles tab show the real, full
// list instead of only whoever has happened to log in this session.
export async function fetchAllAdminProfiles() {
  const { data, error } = await supabase.from('profiles').select('*').in('role', ['staff', 'super']);
  if (error) throw error;
  return (data || []).map(rowToAdmin);
}

export async function updateAdminPerms(id, perms) {
  const { error } = await supabase.from('profiles').update({ perms }).eq('id', id);
  if (error) throw error;
}

export async function updateAdminRole(id, patch) {
  const { error } = await supabase.from('profiles').update(patch).eq('id', id);
  if (error) throw error;
}

export async function updateAdminName(id, name) {
  const { error } = await supabase.from('profiles').update({ name }).eq('id', id);
  if (error) throw error;
}
