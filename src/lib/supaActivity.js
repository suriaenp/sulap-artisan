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
// logActivity() (store.jsx) fires this without awaiting it, so it can run at
// any point in a call site's lifecycle — including right after a long CPU-bound
// task (e.g. the OCR scan in payScan.js) where a backgrounded/throttled mobile
// tab may not have finished restoring its persisted session yet. Explicitly
// awaiting getSession() first forces that restore to complete before the
// insert fires, instead of the request silently going out unauthenticated
// (observed live: Supabase's API logs showed auth_user: null on the insert,
// which reads as an RLS violation but is really "no session was attached").
export async function insertActivity({ who, what, tint, icon, type }) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { console.warn('Activity log skipped: no active session'); return null; }
  const { data, error } = await supabase.from('activity')
    .insert({ who, what, tint, icon, type })
    .select().single();
  if (error) throw error;
  return rowToActivity(data);
}
