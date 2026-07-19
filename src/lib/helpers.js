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
    shortlisted: ['#EEF1FB', '#3D5BC4', 'Shortlisted'],
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

// `tierOverride` is the tier snapshotted on the application record at apply
// time (see ApplyModal) — it wins over the vendor's *current* category so an
// admin category edit can't retroactively reprice an existing application.
// Seeded/legacy apps without a snapshot fall back to the live category.
export function payCalc(vendor, ev, depositStatus, tierOverride) {
  const tier = tierOverride || (vendor?.category === 'Food & Beverage' ? 'F&B' : 'Non-F&B');
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

// Events carry no stored status field (unlike vendor/application records) —
// derived at render time from today vs. the event's own start/end dates.
// `key` is the stable machine-readable form; `label`/`bg`/`color` are the
// admin-console badge presentation. Shared by the admin Events tab and the
// public home page's "Coming Soon" carousel so both agree on what's live.
export function eventStatus(ev) {
  if (!ev.startDate || !ev.endDate) return { key:'tbc', label:'Dates TBC', bg:'var(--bg-subtle)', color:'var(--text-muted)' };
  const today = new Date(); today.setHours(0,0,0,0);
  // parseDateOnly (not `new Date('YYYY-MM-DD')`, which is UTC-anchored) so an
  // event starting "today" reads as ongoing rather than upcoming in positive-
  // UTC-offset timezones, where the UTC-parsed start time lands hours into today.
  const start = parseDateOnly(ev.startDate), end = parseDateOnly(ev.endDate);
  if (today < start) return { key:'upcoming', label:'Upcoming', bg:'var(--tint-amber-bg)', color:'var(--tint-amber-text)' };
  if (today > end) return { key:'concluded', label:'Concluded', bg:'var(--bg-subtle)', color:'var(--text-muted)' };
  return { key:'ongoing', label:'Ongoing', bg:'var(--tint-green-bg)', color:'var(--tint-green-text)' };
}

// ── Parking Pass date/time helpers ──
// Parses a "YYYY-MM-DD" date-only string as local midnight — avoids the
// UTC-vs-local off-by-one `new Date('YYYY-MM-DD')` can cause in negative-UTC
// timezones (that form is spec'd as UTC, but .getDate()/.getMonth() below read
// it back in local time).
export function parseDateOnly(d) {
  const [y, m, day] = String(d).split('-').map(Number);
  return new Date(y, (m || 1) - 1, day || 1);
}

// The calendar date for day N (1-based) of a multi-day event.
export function eventDayDate(startDate, dayIndex) {
  const dt = parseDateOnly(startDate);
  dt.setDate(dt.getDate() + (dayIndex - 1));
  return dt;
}

// "26 JULY" — day number + full uppercase month name, for the Parking Pass design.
export function monthDayLabel(dateObj) {
  const month = dateObj.toLocaleDateString('en-GB', { month: 'long' }).toUpperCase();
  return `${dateObj.getDate()} ${month}`;
}

// "16:00" -> "4:00 PM" — 12-hour with minutes always shown, for the Parking Pass design.
export function fmtTime12(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  const hh = ((h + 11) % 12) + 1;
  return `${hh}:${String(m).padStart(2, '0')} ${ap}`;
}

// Local-time (no timezone designator, so `new Date(...)` parses it back as
// local) datetime string for the given date + "HH:MM" time — the Parking
// Pass countdown target.
export function isoLocal(dateObj, timeHHMM) {
  const yyyy = dateObj.getFullYear();
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const dd = String(dateObj.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${timeHHMM || '23:59'}:00`;
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