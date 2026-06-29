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
    collected: ['#E8F5F0', '#2D6A4F', 'Collected'],
    returned:  ['#F8E9EE', '#A6364E', 'Returned'],
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

export function dayCount(start, end) {
  if (!start || !end) return 0;
  const d = (new Date(end) - new Date(start)) / 86400000;
  return d >= 0 ? d + 1 : 0;
}
