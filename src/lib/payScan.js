import { payCalc, money, fmtShort, splitPayKey } from './helpers';
import { savePaymentRecord, saveDepositRecord } from './supaPayments';

// ── text extraction ───────────────────────────────────────────────────────────
// pdfjs and tesseract are loaded lazily so they don't bloat the initial bundle.

// Accepts either a data: URL (demo/mock mode, still base64-encoded locally)
// or a real Storage URL (a real vendor's advice, now uploaded to the
// payment-files bucket) — pdfjs can fetch a remote URL directly, so only the
// data: URL path needs the manual atob() byte conversion.
async function pdfToText(url) {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  let doc;
  if (url.startsWith('data:')) {
    const bin = atob(url.split(',')[1]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    doc = await pdfjs.getDocument({ data: bytes }).promise;
  } else {
    doc = await pdfjs.getDocument({ url }).promise;
  }
  let text = '';
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    text += tc.items.map(it => it.str).join(' ') + '\n';
  }
  return text;
}

// Tesseract.recognize() already accepts either a data: URL or a remote URL
// natively — no branching needed here.
async function imageToText(url) {
  const { default: Tesseract } = await import('tesseract.js');
  const { data } = await Tesseract.recognize(url, 'eng');
  return data.text || '';
}

// ── amount detection ──────────────────────────────────────────────────────────

export function pickAmount(text) {
  if (!text) return null;
  const amounts = [];
  const rmRe = /(?:RM|MYR)\s*([\d,]+(?:\.\d{1,2})?)/gi;
  let m;
  while ((m = rmRe.exec(text))) amounts.push({ val: parseFloat(m[1].replace(/,/g, '')), rm: true, idx: m.index });
  if (!amounts.length) {
    const numRe = /([\d,]{1,12}\.\d{2})(?!\d)/g;
    while ((m = numRe.exec(text))) amounts.push({ val: parseFloat(m[1].replace(/,/g, '')), rm: false, idx: m.index });
  }
  const valid = amounts.filter(a => isFinite(a.val) && a.val > 0 && a.val < 1000000);
  if (!valid.length) return null;
  // prefer amounts near a payment keyword, then RM-prefixed, then the largest
  const kw = /(amount|total|jumlah|transfer|paid|payment|dibayar)/i;
  let best = null;
  for (const a of valid) {
    const ctx = text.slice(Math.max(0, a.idx - 40), a.idx + 12);
    const score = (kw.test(ctx) ? 2 : 0) + (a.rm ? 1 : 0);
    if (!best || score > best.score || (score === best.score && a.val > best.val)) best = { ...a, score };
  }
  return best.val;
}

export async function scanPaymentDoc(doc) {
  try {
    if (!doc?.url) return { amount: null };
    // Storage-backed uploads are a real https URL, not a data: URL, so type
    // detection falls back to the file's extension (doc.name) for those —
    // the data: prefix checks still cover demo/mock-mode uploads unchanged.
    const isPdf = doc.url.startsWith('data:application/pdf') || /\.pdf$/i.test(doc.name || '');
    const isImage = doc.url.startsWith('data:image') || /\.(jpe?g|png|gif|webp|bmp|heic)$/i.test(doc.name || '');
    let text = '';
    if (isPdf) text = await pdfToText(doc.url);
    else if (isImage) text = await imageToText(doc.url);
    else return { amount: null };
    return { amount: pickAmount(text) };
  } catch {
    return { amount: null };
  }
}

// ── auto-record ───────────────────────────────────────────────────────────────
// Scans an uploaded payment advice and records the payment, like admin's
// manual Record Payment. advice2 adds on top of the existing paid amount.

export async function scanAndRecord(doc, payKey, field, ctx) {
  const { payments, vendors, events, deposits, apps, dispatch, showToast, logActivity, who } = ctx;
  const [vid, eid] = splitPayKey(payKey);
  const v = vendors.find(x => x.id === vid) || {};
  const ev = events.find(x => x.id === eid) || {};
  const app = (apps || []).find(a => a.vendorId === vid && a.eventId === eid);
  const dep = deposits[vid] || { status: 'unpaid' };
  const calc = payCalc(v, ev, dep.status, app?.tier);
  const prev = payments[payKey] || { status: 'unpaid', paid: 0 };
  const res = await scanPaymentDoc(doc);
  const at = fmtShort(new Date());
  const persistCtx = { vendors, events, dispatch, showToast };
  if (res.amount != null) {
    const base = field === 'advice2' ? (prev.paid || 0) : 0;
    const paid = +(base + res.amount).toFixed(2);
    const status = paid <= 0 ? 'unpaid' : paid < calc.total ? 'partial' : 'paid';
    const payload = { ...prev, [field]: doc, paid, status, scans: { ...(prev.scans || {}), [field]: { amount: res.amount, at } } };
    // Write-then-reflect: a real vendor+event pair persists to Supabase first
    // (RLS payments_self_write lets the vendor's own session do this); a
    // failed write shows its toast and leaves everything untouched.
    if (!await savePaymentRecord(payKey, payload, persistCtx)) return res;
    // The total being settled included the one-time RM100 deposit (it's only
    // added while the deposit record isn't 'paid') — so a full payment also
    // settles the deposit. Mark the Deposit Record tab's entry paid in the
    // same action, otherwise the next event's total would charge RM100 again.
    // (Vendor-side sessions need migration 0004's deposits_self_settle
    // policies for this write to pass RLS.)
    if (status === 'paid' && calc.needsDeposit) {
      const ok = await saveDepositRecord(vid, { ...dep, status: 'paid', payDate: new Date().toISOString().slice(0, 10) }, persistCtx);
      if (ok) logActivity('System', `marked ${v.business}'s RM100 security deposit as paid — settled within their ${ev.name} payment.`, { icon: 'wallet', tint: '#EEF1FB' });
    }
    logActivity(who || v.business, `uploaded a payment advice for ${ev.name} — auto-scan read RM ${money(res.amount)} and recorded the payment.`, { icon: 'receipt', tint: '#E8F5F0', type: 'vendor' });
    showToast(`Scanned RM ${money(res.amount)} — payment recorded`, 'check');
  } else {
    const payload = { ...prev, [field]: doc, scans: { ...(prev.scans || {}), [field]: { amount: null, at } } };
    if (!await savePaymentRecord(payKey, payload, persistCtx)) return res;
    logActivity(who || v.business, `uploaded a payment advice for ${ev.name} — auto-scan couldn't read an amount.`, { icon: 'file', tint: '#FEF8EC', type: 'vendor' });
    showToast("Uploaded — couldn't read an amount, to be verified manually", 'info');
  }
  return res;
}

// ── discrepancy notice ────────────────────────────────────────────────────────
// Returns null (nothing to say), or { kind:'unread' | 'match' | 'short' | 'over',
// scanned, due, overridden } for a faint notice on the payment card.

export function scanNotice(rec, calc) {
  const scans = rec.scans || {};
  const hasScan = scans.advice || scans.advice2;
  if (!hasScan) return null;
  const latest = scans.advice2 || scans.advice;
  if (latest.amount == null) return { kind: 'unread' };
  const scanned = +(((scans.advice?.amount) || 0) + ((scans.advice2?.amount) || 0)).toFixed(2);
  const overridden = Math.abs((rec.paid || 0) - scanned) > 0.005;
  const diff = +(scanned - calc.total).toFixed(2);
  if (Math.abs(diff) <= 0.005) return { kind: 'match', scanned, due: calc.total, overridden };
  return { kind: diff < 0 ? 'short' : 'over', scanned, due: calc.total, diff: Math.abs(diff), overridden };
}
