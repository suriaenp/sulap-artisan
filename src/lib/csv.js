import { downloadBlob } from './photoFiles';

// Real CSV export for the admin console's Export buttons (they used to be
// toast-only mocks — see "fake buttons" in the 2026-07 audit). Client-side
// only: builds the file from the store data the tab is already showing.

const escCell = (v) => {
  const s = String(v ?? '');
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

// headers: array of column labels; rows: array of arrays (same order).
// The leading BOM makes Excel open UTF-8 (vendor names, "—", RM totals) cleanly.
export function downloadCsv(filename, headers, rows) {
  const csv = [headers, ...rows].map(r => r.map(escCell).join(',')).join('\r\n');
  downloadBlob(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }), filename);
}
