import { supabase } from './supabase';

// Activity is an append-only audit trail — unlike every other slice, the
// mock shape stores a pre-formatted display string (`when`, e.g.
// 'Today 10:42 AM' or '28 Jun 9:15 AM') rather than a real timestamp, so
// there's nothing to preserve there; the DB stores a real `created_at` and
// this formats it the same way at read time.
function formatWhen(createdAt) {
  const d = new Date(createdAt);
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  const isToday = d.toDateString() === new Date().toDateString();
  return isToday ? `Today ${time}` : `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} ${time}`;
}

export function rowToActivity(row) {
  return {
    id: row.id,
    who: row.who,
    what: row.what,
    tint: row.tint,
    icon: row.icon,
    type: row.type,
    when: formatWhen(row.created_at),
    remote: true,
  };
}

// Admin-only read (RLS: activity_admin_read) — no vendor screen shows this log.
export async function fetchAllActivity() {
  const { data, error } = await supabase.from('activity').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(rowToActivity);
}

// Any authenticated session (vendor or admin) may insert — see migration
// 0006's comment on why this isn't scoped to is_admin().
//
// logActivity() (store.jsx) fires this without awaiting it, so it can run
// concurrently with other in-flight requests from the same call site (e.g.
// payScan.js's OCR flow: a Storage upload immediately followed by this
// insert). Live testing surfaced a case where the request reached Supabase
// with a well-formed Authorization: Bearer JWT (confirmed in the browser's
// Network tab) but the server logged auth_user: null and RLS correctly
// rejected the write — a client-side auth-attachment race in supabase-js
// under concurrent requests, not a session or policy problem (getSession()
// showed a valid session throughout; the RLS policy itself was verified
// correct in the dashboard). Retrying once after an explicit refreshSession()
// works around it without needing to pin down the exact internal cause.
async function tryInsert({ who, what, tint, icon, type }) {
  return supabase.from('activity').insert({ who, what, tint, icon, type }).select().single();
}

export async function insertActivity({ who, what, tint, icon, type }) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { console.warn('Activity log skipped: no active session'); return null; }
  let { data, error } = await tryInsert({ who, what, tint, icon, type });
  if (error?.code === '42501') {
    await supabase.auth.refreshSession();
    ({ data, error } = await tryInsert({ who, what, tint, icon, type }));
  }
  if (error) throw error;
  return rowToActivity(data);
}
