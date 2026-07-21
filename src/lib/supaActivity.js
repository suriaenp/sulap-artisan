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
// 0006's comment on why this isn't scoped to is_admin(). But the table's
// SELECT policy (`activity_admin_read`) *is* scoped to is_admin() — there is
// no `owns_vendor()`-style self-read policy here, unlike every other
// vendor-facing table. Postgres requires a matching SELECT policy to satisfy
// `INSERT ... RETURNING` (see the CREATE POLICY docs: with an INSERT policy
// but no matching SELECT policy, the RETURNING clause itself raises an RLS
// violation, SQLSTATE 42501) — so a `.select()` chained onto this insert was
// deterministically failing for every vendor-triggered call (e.g. payScan.js's
// OCR flow), 100% of the time, regardless of session/auth state. That's why
// two earlier fixes aimed at the client's session (a hydration guard, then a
// refreshSession()-and-retry) didn't help: the session was never the problem.
// Fix: don't ask Postgres to hand the row back at all — the caller already
// has every field it needs to build the entry locally, and nothing reads
// this table from a vendor session anyway (no vendor screen shows this log).
async function tryInsert({ who, what, tint, icon, type }) {
  return supabase.from('activity').insert({ who, what, tint, icon, type });
}

export async function insertActivity({ who, what, tint, icon, type }) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { console.warn('Activity log skipped: no active session'); return null; }
  let { error } = await tryInsert({ who, what, tint, icon, type });
  if (error?.code === '42501') {
    await supabase.auth.refreshSession();
    ({ error } = await tryInsert({ who, what, tint, icon, type }));
  }
  if (error) throw error;
  return { who, what, tint, icon, type, when: formatWhen(new Date().toISOString()), remote: true };
}
