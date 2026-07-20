import { supabase, isSupabaseConfigured } from './supabase';
import { splitPayKey } from './helpers';

// Data layer for the `payments` and `deposits` tables (kept together — the
// app treats them as one money flow: a fully-paid total that included the
// one-time RM100 deposit also settles the deposit).
//
// Unlike vendors/events/applications, a payment's real-vs-demo character is
// derived from the KEY's two halves (vendor.userId + event.remote), not from
// a marker on the record — the DB row may not exist yet when the first write
// happens (records are created lazily via upsert on the unique
// vendor_id+event_id pair). Same idea for deposits (keyed by vendor alone).

// ── payments ────────────────────────────────────────────────────────────────

function rowToPaymentRec(row) {
  return {
    remote: true,
    status: row.status,
    paid: Number(row.paid) || 0,
    advice: row.advice || null,
    advice2: row.advice2 || null,
    invoice: row.invoice || null,
    receipt: row.receipt || null,
    scans: row.scans || {},
  };
}

const paymentsToMap = (rows) => Object.fromEntries(
  (rows || []).map(r => [`${r.vendor_id}-${r.event_id}`, rowToPaymentRec(r)])
);

// Admin session (RLS is_admin) — every payment row, keyed for MERGE_PAYMENTS.
export async function fetchAllPayments() {
  const { data, error } = await supabase.from('payments').select('*');
  if (error) throw error;
  return paymentsToMap(data);
}

// A vendor's own payment rows (RLS payments_self_read).
export async function fetchPaymentsByVendorId(vendorId) {
  const { data, error } = await supabase.from('payments').select('*').eq('vendor_id', vendorId);
  if (error) throw error;
  return paymentsToMap(data);
}

export async function upsertPayment(vendorId, eventId, rec) {
  const { error } = await supabase.from('payments').upsert({
    vendor_id: vendorId,
    event_id: eventId,
    status: rec.status || 'unpaid',
    paid: rec.paid || 0,
    advice: rec.advice || null,
    advice2: rec.advice2 || null,
    invoice: rec.invoice || null,
    receipt: rec.receipt || null,
    scans: rec.scans || {},
    updated_at: new Date().toISOString(),
  }, { onConflict: 'vendor_id,event_id' });
  if (error) throw error;
}

// ── deposits ────────────────────────────────────────────────────────────────

function rowToDepositRec(row) {
  return {
    remote: true,
    status: row.status,
    inv: row.inv || '',
    payDate: row.pay_date || '',
    refundDate: row.refund_date || '',
  };
}

export async function fetchAllDeposits() {
  const { data, error } = await supabase.from('deposits').select('*');
  if (error) throw error;
  return Object.fromEntries((data || []).map(r => [r.vendor_id, rowToDepositRec(r)]));
}

export async function fetchDepositByVendorId(vendorId) {
  const { data, error } = await supabase.from('deposits').select('*').eq('vendor_id', vendorId).maybeSingle();
  if (error) throw error;
  return data ? { [vendorId]: rowToDepositRec(data) } : null;
}

export async function upsertDeposit(vendorId, rec) {
  const { error } = await supabase.from('deposits').upsert({
    vendor_id: vendorId,
    status: rec.status || 'unpaid',
    inv: rec.inv || null,
    pay_date: rec.payDate || null,       // date columns reject '' — null means unset
    refund_date: rec.refundDate || null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'vendor_id' });
  if (error) throw error;
}

// ── refunds ─────────────────────────────────────────────────────────────────
// Same keying convention as payments (vendor_id+event_id), admin-write-only —
// no vendor-side mutation exists in the app, only a read of their own row.

function rowToRefundRec(row) {
  return {
    remote: true,
    refCode: row.ref_code || '',
    date: row.refund_date || '',
    time: row.refund_time || '',
    status: row.status,
  };
}

const refundsToMap = (rows) => Object.fromEntries(
  (rows || []).map(r => [`${r.vendor_id}-${r.event_id}`, rowToRefundRec(r)])
);

export async function fetchAllRefunds() {
  const { data, error } = await supabase.from('refunds').select('*');
  if (error) throw error;
  return refundsToMap(data);
}

export async function fetchRefundsByVendorId(vendorId) {
  const { data, error } = await supabase.from('refunds').select('*').eq('vendor_id', vendorId);
  if (error) throw error;
  return refundsToMap(data);
}

export async function upsertRefund(vendorId, eventId, rec) {
  const { error } = await supabase.from('refunds').upsert({
    vendor_id: vendorId,
    event_id: eventId,
    ref_code: rec.refCode || null,
    refund_date: rec.date || null,       // date columns reject '' — null means unset
    refund_time: rec.time || null,
    status: rec.status || 'completed',
    updated_at: new Date().toISOString(),
  }, { onConflict: 'vendor_id,event_id' });
  if (error) throw error;
}

export async function saveRefundRecord(payKey, rec, ctx) {
  const { vendors, events, dispatch, showToast } = ctx;
  const [vid, eid] = splitPayKey(payKey);
  const v = vendors.find(x => x.id === vid);
  const ev = events.find(x => x.id === eid);
  if (isSupabaseConfigured && v?.userId && ev?.remote) {
    try { await upsertRefund(vid, eid, rec); rec = { ...rec, remote: true }; }
    catch (e) { showToast("Couldn't save the refund — " + e.message, 'lock'); return false; }
  }
  dispatch({ type: 'MERGE_REFUNDS', payload: { [payKey]: rec } });
  return true;
}

// ── write-then-reflect persistence helpers ──────────────────────────────────
// Payment mutations are spread across four files (PayModal in App.jsx, the
// admin Payments tab, DocPreviewModal, payScan's auto-record), so the shared
// write-first logic lives here rather than being redefined per component —
// same ctx-argument style as payScan's scanAndRecord. Both return true when
// local state was updated (server accepted the write, or the record is demo
// data and stays local-only), false when the server rejected it (an error
// toast has been shown and local state is untouched).

export async function savePaymentRecord(payKey, rec, ctx) {
  const { vendors, events, dispatch, showToast } = ctx;
  const [vid, eid] = splitPayKey(payKey);
  const v = vendors.find(x => x.id === vid);
  const ev = events.find(x => x.id === eid);
  if (isSupabaseConfigured && v?.userId && ev?.remote) {
    try { await upsertPayment(vid, eid, rec); rec = { ...rec, remote: true }; }
    catch (e) { showToast("Couldn't save the payment — " + e.message, 'lock'); return false; }
  }
  dispatch({ type: 'MERGE_PAYMENTS', payload: { [payKey]: rec } });
  return true;
}

export async function saveDepositRecord(vendorId, rec, ctx) {
  const { vendors, dispatch, showToast } = ctx;
  const v = vendors.find(x => x.id === vendorId);
  if (isSupabaseConfigured && v?.userId) {
    try { await upsertDeposit(vendorId, rec); rec = { ...rec, remote: true }; }
    catch (e) { showToast("Couldn't save the deposit — " + e.message, 'lock'); return false; }
  }
  dispatch({ type: 'MERGE_DEPOSITS', payload: { [vendorId]: rec } });
  return true;
}
