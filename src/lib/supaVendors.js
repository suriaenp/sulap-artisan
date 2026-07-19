import { supabase } from './supabase';
import { EMPTY_EINVOICE } from '../data/mockData';

// Bridges the Supabase `vendors` table (snake_case columns) and the app's
// existing camelCase vendor shape (unchanged from the Phase 1 mock, so the
// rest of the UI needs no changes as this table comes online). Deliberately
// has no `password` field — Supabase Auth owns credentials now, not this row.
export function rowToVendor(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    business: row.business,
    owner: row.owner,
    category: row.category,
    email: row.email,
    phone: row.phone,
    ig: row.ig || '', fb: row.fb || '', tiktok: row.tiktok || '',
    plate: row.plate || '',
    status: row.status,
    power: row.power || 'None',
    desc: row.description || '',
    regDate: row.reg_date || '',
    tcAcceptedAt: row.tc_accepted_at || '',
    logo: row.logo || null,
    productPhotos: row.product_photos || [],
    docs: row.docs || { ssm: null, halal: null, extra: [] },
    einvoice: row.einvoice && Object.keys(row.einvoice).length ? row.einvoice : { ...EMPTY_EINVOICE },
  };
}

export async function fetchVendorByUserId(userId) {
  const { data, error } = await supabase.from('vendors').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return rowToVendor(data);
}

// Every real vendor — lets the admin console show the actual pending/
// approved/rejected/suspended roster instead of only whichever vendor has
// happened to log in during this session. Only readable by an admin session
// (RLS: vendors_admin_read requires is_admin()).
export async function fetchAllVendors() {
  const { data, error } = await supabase.from('vendors').select('*');
  if (error) throw error;
  return (data || []).map(rowToVendor);
}

export async function updateVendorStatus(id, status) {
  const { error } = await supabase.from('vendors').update({ status }).eq('id', id);
  if (error) throw error;
}

// `v` is any subset of the app-shape vendor fields (business, owner, category,
// email, phone, ig/fb/tiktok, plate, power, desc, regDate, tcAcceptedAt, and
// optionally logo/productPhotos/docs/einvoice). Always inserts as 'pending' —
// matches the vendors_self_insert RLS policy's with-check.
export async function insertVendor(userId, v) {
  const { data, error } = await supabase.from('vendors').insert({
    user_id: userId,
    business: v.business, owner: v.owner, category: v.category,
    email: v.email, phone: v.phone,
    ig: v.ig || '', fb: v.fb || '', tiktok: v.tiktok || '',
    plate: v.plate || '', power: v.power || 'None', description: v.desc || '',
    reg_date: v.regDate, tc_accepted_at: v.tcAcceptedAt,
    logo: v.logo || null, product_photos: v.productPhotos || [],
    docs: v.docs || { ssm: null, halal: null, extra: [] },
    einvoice: v.einvoice || { ...EMPTY_EINVOICE },
  }).select().single();
  if (error) throw error;
  return rowToVendor(data);
}

// ── Registration draft (bridges signUp() → email confirmation → first login) ──
// When email confirmation is required, `signUp()` returns no active session,
// so the vendor row can't be inserted yet (RLS needs an authenticated
// auth.uid()). We stash the form fields locally and create the row once a
// confirmed session appears for this same email (see store.jsx's auth
// listener). Deliberately excludes photos — base64 data URLs risk blowing
// localStorage's quota; they're added afterward from the dashboard instead.
const DRAFT_KEY = 'sulap_pending_vendor_draft';

export function stashRegistrationDraft(fields) {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(fields)); } catch {}
}

export async function completeRegistrationFromDraft(session) {
  let draft;
  try { draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch { draft = null; }
  if (!draft || (draft.email || '').toLowerCase() !== (session.user.email || '').toLowerCase()) return null;
  localStorage.removeItem(DRAFT_KEY);
  return insertVendor(session.user.id, draft);
}
