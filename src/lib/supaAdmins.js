import { supabase, isSupabaseConfigured } from './supabase';

// Bridges the `profiles` table (role='staff'|'super') and the app's existing
// admin shape (was a hardcoded mock array — see mockData.js's INITIAL_ADMINS).
// Real accounts carry no `password` field and `mustReset` is always false —
// both are mock-only concepts (Supabase Auth owns credentials and its own
// first-login/reset flows now).
export function rowToAdmin(row) {
  if (!row) return null;
  return {
    id: row.id, // Supabase Auth UUID — internal only, never shown as "Staff ID"
    staffId: row.staff_id || null, // company-assigned identifier — this is what the UI displays
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

export async function updateAdminStaffId(id, staffId) {
  const { error } = await supabase.from('profiles').update({ staff_id: staffId || null }).eq('id', id);
  if (error) throw error;
}

// ── admin-manage Edge Function (create/reset-password/remove) ──────────────
// The one thing this data layer can't do with just the anon key + RLS —
// creating another person's auth account, resetting someone else's
// password, or removing an admin outright all need the service_role key,
// which only runs server-side. `functions.invoke()` automatically attaches
// the caller's own access token, which the function verifies server-side
// before doing anything privileged (see supabase/functions/admin-manage).
async function invokeAdminManage(action, payload) {
  const { data, error } = await supabase.functions.invoke('admin-manage', { body: { action, ...payload } });
  // A non-2xx response still resolves (not throws) with `error` set and the
  // function's own JSON body available via error.context — surface that
  // message instead of the generic "Edge Function returned a non-2xx status".
  if (error) {
    let message = error.message;
    try { const body = await error.context.json(); if (body?.error) message = body.error; } catch { /* fall back to error.message */ }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export function createAdminAccount({ email, password, name, role, staffId }) {
  return invokeAdminManage('createAdmin', { email, password, name, role, staffId });
}

export function resetAdminPassword(userId, newPassword) {
  return invokeAdminManage('resetPassword', { userId, newPassword });
}

export function removeAdminAccount(userId) {
  return invokeAdminManage('removeAdmin', { userId });
}

// What the UI should show as "Staff ID". Mock-mode admins (mockData.js)
// don't have a staffId field at all — their short id ('admin'/'staff01') IS
// the human-facing identifier by design, so it's the fallback there. A real
// Supabase admin's `id` is a UUID and must NEVER be shown as their Staff ID —
// falling back to it would reproduce the exact bug this field exists to fix.
export function displayStaffId(admin) {
  if (admin.staffId) return admin.staffId;
  return isSupabaseConfigured ? 'Not assigned yet' : admin.id;
}
