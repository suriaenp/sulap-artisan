import html2pdf from 'html2pdf.js';
import { safeName } from './photoFiles';
import { getLogo } from './signupForm';

// Vendor Pass report — one PDF per event, listing every approved pass holder
// with their booth number, for the Sulap team / mall security to check
// against at the door. Landscape so the vendor/photo/name/booth/date columns
// all fit on one row without wrapping.

const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function photoCellHtml(photo) {
  if (photo?.url) return `<img src="${photo.url}" alt="" class="pic">`;
  const g = photo?.grad || ['#F0D8DD', '#B97434'];
  return `<div class="pic" style="background:linear-gradient(135deg,${g[0]},${g[1]})"></div>`;
}

export async function buildPassReportHtml(event, rows) {
  const logo = await getLogo();
  const rowsHtml = rows.map(r => `
    <tr>
      <td>${esc(r.vendorName)}</td>
      <td>${photoCellHtml(r.photo)}</td>
      <td>${esc(r.personName)}</td>
      <td>${esc(r.boothNumber || '—')}</td>
      <td>${esc(event.dateRange || '—')}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${esc(event.name)} — Vendor Pass Report</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Georgia, 'Times New Roman', serif; color:#1C1A17; background:#fff; padding:26px 34px; }
  .head { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px solid #9A5B26; padding-bottom:14px; }
  .head img { width:150px; height:auto; }
  .head .doc { text-align:right; font-size:11px; color:#6B6560; line-height:1.6; }
  h1 { font-size:19px; font-weight:600; margin:16px 0 3px; }
  .sub { font-size:12px; color:#6B6560; margin-bottom:16px; }
  table { width:100%; border-collapse:collapse; }
  th { text-align:left; font-size:10.5px; letter-spacing:0.06em; text-transform:uppercase; color:#9A5B26; background:#FBF7F1; border:1px solid #ddd2c4; padding:8px 10px; }
  td { border:1px solid #ddd2c4; padding:7px 10px; font-size:12.5px; vertical-align:middle; }
  .pic { width:44px; height:44px; border-radius:8px; object-fit:cover; display:block; }
  .empty { text-align:center; color:#8a8a8a; padding:20px; }
  .foot { margin-top:16px; padding-top:10px; border-top:1px solid #ddd2c4; font-size:10px; color:#8a8a8a; line-height:1.5; }
</style>
</head>
<body>
  <div class="head">
    ${logo ? `<img src="${logo}" alt="Sulap Artisan">` : `<div style="font-size:20px;font-weight:700">Sulap Artisan</div>`}
    <div class="doc">VENDOR PASS REPORT<br>Generated ${esc(new Date().toLocaleString())}</div>
  </div>

  <h1>${esc(event.name)}</h1>
  <div class="sub">${esc(event.dateRange || '')} · ${rows.length} approved pass holder${rows.length !== 1 ? 's' : ''}</div>

  <table>
    <thead><tr><th>Vendor</th><th>Photo</th><th>Pass holder</th><th>Booth no.</th><th>Event date</th></tr></thead>
    <tbody>
      ${rowsHtml || `<tr><td colspan="5" class="empty">No approved pass holders for this event yet.</td></tr>`}
    </tbody>
  </table>

  <div class="foot">Includes approved pass holders only — pending/rejected applications are not shown. Generated from the Sulap Artisan Admin Console.</div>
</body>
</html>`;
}

const PDF_OPT = (filename) => ({
  margin: [10, 10, 10, 10],
  filename,
  image: { type: 'jpeg', quality: 0.98 },
  html2canvas: { scale: 2, windowWidth: 1120 },
  jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
  pagebreak: { mode: ['css', 'legacy'] },
});

function htmlToElement(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const wrapper = document.createElement('div');
  wrapper.appendChild(doc.querySelector('style').cloneNode(true));
  wrapper.appendChild(doc.body);
  return wrapper;
}

// Builds the report rows (one per approved pass holder for the event) and
// downloads them as a landscape PDF.
export async function downloadPassReport(event, passApps, vendors) {
  const rows = [];
  passApps.filter(p => p.eventId === event.id).forEach(p => {
    const v = vendors.find(x => x.id === p.vendorId) || {};
    p.people.filter(person => person.status === 'approved').forEach(person => {
      rows.push({ vendorName: v.business || 'Unknown vendor', photo: person.photo, personName: person.name, boothNumber: p.boothNumber });
    });
  });
  const html = await buildPassReportHtml(event, rows);
  const element = htmlToElement(html);
  return html2pdf().set(PDF_OPT(`${safeName(event.name)} - Vendor Pass report.pdf`)).from(element).save();
}
