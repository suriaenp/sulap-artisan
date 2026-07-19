import { supabase } from './supabase';
import { EVENT_IMG_PALETTE } from '../data/mockData';

// Bridges the Supabase `events` table (snake_case columns) and the app's
// existing camelCase event shape, same pattern as supaVendors/supaAdmins.
// `remote: true` is the real-vs-demo discriminator (the events counterpart of
// a vendor's `userId`): only rows that came from Supabase carry it, so
// mutations on seeded demo events stay local-only while mutations on real
// events persist. It survives edits because every event update spreads the
// existing object (`{...x, ...}`).
export function rowToEvent(row) {
  if (!row) return null;
  return {
    id: row.id,
    remote: true,
    name: row.name,
    location: row.location || 'Suria Sabah Mall',
    dateRange: row.date_range || 'Dates TBC',
    days: row.days || 1,
    applied: 0,
    fnb: Number(row.fnb) || 0,
    nonfnb: Number(row.nonfnb) || 0,
    startTime: row.start_time || '',
    endTime: row.end_time || '',
    lastApp: row.last_app || '',
    startDate: row.start_date || '',
    endDate: row.end_date || '',
    img: row.img || EVENT_IMG_PALETTE[0],
  };
}

export const isRealEvent = (ev) => !!ev?.remote;

// App shape → DB row. The date columns are real `date` types, so the app's
// empty-string "not set" values must become null or Postgres rejects them.
const toRow = (ev) => ({
  name: ev.name,
  location: ev.location,
  date_range: ev.dateRange,
  days: ev.days,
  fnb: ev.fnb,
  nonfnb: ev.nonfnb,
  start_time: ev.startTime || null,
  end_time: ev.endTime || null,
  last_app: ev.lastApp || null,
  start_date: ev.startDate || null,
  end_date: ev.endDate || null,
  img: ev.img || null,
});

// Events are public-read (RLS: anon included) — no session needed, so this
// also feeds the public home page's "Coming Soon" carousel.
export async function fetchAllEvents() {
  const { data, error } = await supabase.from('events').select('*').order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []).map(rowToEvent);
}

export async function insertEvent(ev) {
  const { data, error } = await supabase.from('events').insert(toRow(ev)).select().single();
  if (error) throw error;
  return rowToEvent(data);
}

export async function updateEvent(id, ev) {
  const { data, error } = await supabase.from('events').update(toRow(ev)).eq('id', id).select().single();
  if (error) throw error;
  return rowToEvent(data);
}
