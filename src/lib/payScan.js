import { payCalc, money, fmtShort } from './helpers';

// ── text extraction ───────────────────────────────────────────────────────────
// pdfjs and tesseract are loaded lazily so they don't bloat the initial bundle.

async function pdfToText(dataUrl) {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const bin = atob(dataUrl.split(',')[1]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const doc = await pdfjs.getDocument({ data: bytes }).promise;
  let text = '';
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    text += tc.items.map(it => it.str).join(' ') + '\n';
  }
  return text;
}

async function imageToText(dataUrl) {
  const { default: Tesseract } = await import('tesseract.js');
  const { data } = await Tesseract.recognize(dataUrl, 'eng');
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
    let text = '';
    if (doc.url.startsWith('data:application/pdf')) text = await pdfToText(doc.url);
    else if (doc.url.startsWith('data:image')) text = await imageToText(doc.url);
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
  const { payments, vendors, events, deposits, dispatch, showToast, logActivity, who } = ctx;
  const [vid, eid] = payKey.split('-');
  const v = vendors.find(x => x.id === vid) || {};
  const ev = events.find(x => x.id === eid) || {};
  const dep = deposits[vid] || { status: 'unpaid' };
  const calc = payCalc(v, ev, dep.status);
  const prev = payments[payKey] || { status: 'unpaid', paid: 0 };
  const res = await scanPaymentDoc(doc);
  const at = fmtShort(new Date());
  let payload;
  if (res.amount != null) {
    const base = field === 'advice2' ? (prev.paid || 0) : 0;
    const paid = +(base + res.amount).toFixed(2);
    const status = paid <= 0 ? 'unpaid' : paid < calc.total ? 'partial' : 'paid';
    payload = { ...prev, [field]: doc, paid, status, scans: { ...(prev.scans || {}), [field]: { amount: res.amount, at } } };
    logActivity(who || v.business, `uploaded a payment advice for ${ev.name} — auto-scan read RM ${money(res.amount)} and recorded the payment.`, { icon: 'receipt', tint: '#E8F5F0', type: 'vendor' });
    showToast(`Scanned RM ${money(res.amount)} — payment recorded`, 'check');
  } else {
    payload = { ...prev, [field]: doc, scans: { ...(prev.scans || {}), [field]: { amount: null, at } } };
    logActivity(who || v.business, `uploaded a payment advice for ${ev.name} — auto-scan couldn't read an amount.`, { icon: 'file', tint: '#FEF8EC', type: 'vendor' });
    showToast("Uploaded — couldn't read an amount, to be verified manually", 'info');
  }
  dispatch({ type: 'MERGE_PAYMENTS', payload: { [payKey]: payload } });
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
