export function money(n) {
  return Number(n || 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmt(n) {
  return Number(n || 0).toLocaleString('en-MY');
}

export function fmtShort(d) {
  try { return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); }
  catch { return d; }
}

export function fmtTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ap = h >= 12 ? 'pm' : 'am';
  const hh = ((h + 11) % 12) + 1;
  return m ? `${hh}.${String(m).padStart(2, '0')}${ap}` : `${hh}${ap}`;
}

export function badge(status) {
  const map = {
    pending:   ['#FEF8EC', '#B7770D', 'Pending'],
    approved:  ['#E8F5F0', '#2D6A4F', 'Approved'],
    rejected:  ['#FDEEEC', '#B03A2E', 'Rejected'],
    suspended: ['#F2EDE6', '#8B6F4E', 'Suspended'],
    collected: ['#E8F5F0', '#2D6A4F', 'Collected'],
    returned:  ['#F3E4CC', '#9A5B26', 'Returned'],
    paid:      ['#E8F5F0', '#2D6A4F', 'Paid'],
    partial:   ['#FFF3E0', '#C76A0D', 'Partial'],
    refunded:  ['#EEF1FB', '#3D5BC4', 'Refunded'],
    unpaid:    ['#FEF8EC', '#B7770D', 'Unpaid'],
  };
  const [bg, color, label] = map[status] || ['#F2EDE6', '#6B6560', status];
  return { bg, color, label };
}

export function payCalc(vendor, ev, depositStatus) {
  const tier = vendor?.category === 'Food & Beverage' ? 'F&B' : 'Non-F&B';
  const rate = tier === 'F&B' ? (ev?.fnb || 0) : (ev?.nonfnb || 0);
  const days = ev?.days || 1;
  const base = rate * days;
  const sst  = base * 0.06;
  const needsDeposit = depositStatus !== 'paid';
  const deposit = needsDeposit ? 100 : 0;
  return { tier, rate, days, base, sst, deposit, needsDeposit, total: base + sst + deposit };
}

// "12 Jul 2026, 3:42 PM" — recorded the moment a vendor accepts the market
// terms at registration; printed on their downloadable sign-up form.
export function tcTimestamp(d = new Date()) {
  const date = d.toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit', hour12:true });
  return `${date}, ${time}`;
}

export function dayCount(start, end) {
  if (!start || !end) return 0;
  const d = (new Date(end) - new Date(start)) / 86400000;
  return d >= 0 ? d + 1 : 0;
}

// E-Invoice & bank info collected once a vendor is approved — required before
// they can apply to any market. Shown/edited from the vendor Profile tab and
// reflected read-only in the admin Vendor Detail modal.
export const EINVOICE_FIELDS = [
  ['companyName', 'Company name', 'Full legal name as per SSM registration'],
  ['regNo',       'Company registration number (new)', '12-digit number, e.g. 202401123456'],
  ['tin',         'Tax Identification Number (TIN)', 'No spacing — Company: C1234567890 · Individual: IG12345678901'],
  ['sstNo',       'Sales and Service Tax (SST) number', 'e.g. S01-2345-67891012 — enter "N/A" if not SST-registered'],
  ['regAddress',  'Business registration address', ''],
  ['bankName',    'Bank name', 'e.g. Maybank'],
  ['bankAccNo',   'Bank account number', ''],
  ['bankHolder',  'Bank account holder name', 'For deposit refunds'],
];

export function einvoiceComplete(v) {
  const e = v?.einvoice;
  if (!e) return false;
  return EINVOICE_FIELDS.every(([k]) => (e[k] || '').trim().length > 0);
}

// Locked profile fields — vendor can request a change but admin must approve it
// (see profileRequests in lib/store.jsx). Everything else (social links + power
// supply) is directly vendor-editable.
export const DETAILS_FIELDS = [
  ['business', 'Brand name'],
  ['owner',    'Contact person (same as NRIC)'],
  ['category', 'Category'],
  ['email',    'Email'],
  ['phone',    'Phone'],
  ['plate',    'Car plate number'],
  ['desc',     'Product description'],
];

// ── Portal tab ordering ──
// A super admin arranges both portals' tab order globally (Settings → Portal
// tab order); the saved order is an array of tab ids (vTabOrder / aTabOrder in
// the store, persisted to localStorage). Ids missing from the saved order
// (e.g. tabs added after the order was saved) keep their code-defined
// position at the end.

export function orderTabs(tabs, order) {
  if (!order || !order.length) return tabs;
  const pos = new Map(order.map((id, i) => [id, i]));
  return [...tabs].sort((a, b) => (pos.get(a.id) ?? order.length) - (pos.get(b.id) ?? order.length));
}

// New order after dragging `dragId` onto `targetId`: dragging downward lands
// after the target, dragging upward lands before it — matches what the drop
// indicator shows.
export function reorderIds(ids, dragId, targetId) {
  const from = ids.indexOf(dragId), to = ids.indexOf(targetId);
  if (from < 0 || to < 0 || dragId === targetId) return ids;
  const next = ids.filter(id => id !== dragId);
  next.splice(next.indexOf(targetId) + (from < to ? 1 : 0), 0, dragId);
  return next;
}